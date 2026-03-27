import { NextRequest, NextResponse } from 'next/server';
import { Role, Status, RequestStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { RequestService } from '@/services/request.service';

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

function normalizeRequestStatus(status: string | null): RequestStatus | undefined {
  if (!status) return undefined;
  const normalized = String(status).trim().toUpperCase();
  if (normalized === RequestStatus.PENDING) return RequestStatus.PENDING;
  if (normalized === RequestStatus.REJECTED) return RequestStatus.REJECTED;
  if (normalized === RequestStatus.ISSUED) return RequestStatus.ISSUED;
  return undefined;
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieName = decodeURIComponent(
    request.cookies.get('user_name')?.value || 'مستخدم النظام'
  ).trim();
  const cookieDepartment = decodeURIComponent(
    request.cookies.get('user_department')?.value || 'إدارة عمليات التدريب'
  ).trim();
  const cookieEmployeeId = decodeURIComponent(
    request.cookies.get('user_employee_id')?.value || ''
  ).trim();
  const activeRoleCookie = decodeURIComponent(request.cookies.get('active_role')?.value || '').trim();
  const fallbackRoleCookie = decodeURIComponent(request.cookies.get('user_role')?.value || 'user').trim();
  const effectiveRole = mapRole(activeRoleCookie || fallbackRoleCookie);

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cookieEmail,
          mode: 'insensitive',
        },
      },
      select: { id: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, department: true, email: true, employeeId: true },
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
        role: effectiveRole,
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
        role: effectiveRole,
        status: Status.ACTIVE,
      },
      select: { id: true, department: true, email: true, employeeId: true },
    });
  }

  return {
    id: user.id,
    role: effectiveRole,
    department: user.department || cookieDepartment,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const searchParams = request.nextUrl.searchParams;

    const result = await RequestService.getAll({
      userId: session.id,
      role: session.role,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: 100,
      status: normalizeRequestStatus(searchParams.get('status')),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر جلب الطلبات' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const body = await request.json();

    const items = Array.isArray(body?.items)
      ? body.items.filter((item: any) => item?.itemId && Number(item?.quantity) > 0)
      : [];

    if (!body?.purpose?.trim()) {
      return NextResponse.json({ error: 'الغرض من الطلب مطلوب' }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'يجب اختيار صنف واحد على الأقل' }, { status: 400 });
    }

    const result = await RequestService.create({
      requesterId: session.id,
      department: session.department,
      purpose: body.purpose.trim(),
      notes: body.notes?.trim() || '',
      items: items.map((item: any) => ({
        itemId: String(item.itemId),
        quantity: Number(item.quantity),
        expectedReturnDate: item.expectedReturnDate || null,
      })),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر إنشاء الطلب' },
      { status: 400 }
    );
  }
}
