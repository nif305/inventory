import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Role, Status } from '@prisma/client';

const prisma = new PrismaClient();

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieName = decodeURIComponent(request.cookies.get('user_name')?.value || 'مستخدم النظام').trim();
  const cookieDepartment = decodeURIComponent(
    request.cookies.get('user_department')?.value || 'إدارة عمليات التدريب'
  ).trim();
  const cookieEmployeeId = decodeURIComponent(
    request.cookies.get('user_employee_id')?.value || ''
  ).trim();
  const cookieRole = decodeURIComponent(request.cookies.get('user_role')?.value || 'user').trim();

  const role = mapRole(cookieRole);

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, role: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: cookieEmail, mode: 'insensitive' } },
      select: { id: true, role: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, role: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user) {
    const safeEmployeeId = cookieEmployeeId || `EMP-${Date.now()}`;
    const safeEmail = cookieEmail || `${safeEmployeeId.toLowerCase()}@agency.local`;

    user = await prisma.user.upsert({
      where: { employeeId: safeEmployeeId },
      update: {
        fullName: cookieName,
        email: safeEmail,
        department: cookieDepartment,
        role,
        status: Status.ACTIVE,
      },
      create: {
        employeeId: safeEmployeeId,
        fullName: cookieName,
        email: safeEmail,
        mobile: '0500000000',
        department: cookieDepartment,
        jobTitle: 'مستخدم',
        passwordHash: 'local-auth',
        role,
        status: Status.ACTIVE,
      },
      select: { id: true, role: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  return user;
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);

    const data = await prisma.notification.findMany({
      where: { userId: sessionUser.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر جلب الإشعارات' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    const body = await request.json();

    const notification = await prisma.notification.findUnique({
      where: { id: String(body.id || '') },
    });

    if (!notification || notification.userId !== sessionUser.id) {
      return NextResponse.json({ error: 'الإشعار غير موجود أو غير مصرح' }, { status: 404 });
    }

    const result = await prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر تحديث الإشعار' }, { status: 400 });
  }
}
