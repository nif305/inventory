import { NextRequest, NextResponse } from 'next/server';
import { Role, Status } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
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
  const cookieRole = decodeURIComponent(request.cookies.get('user_role')?.value || 'user').trim();

  const role = mapRole(cookieRole);

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, role: true, department: true, email: true, employeeId: true },
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
      select: { id: true, role: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, role: true, department: true, email: true, employeeId: true },
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
      select: { id: true, role: true, department: true, email: true, employeeId: true },
    });
  }

  return {
    id: user.id,
    role: user.role,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);

    const where =
      session.role === Role.MANAGER
        ? {}
        : {
            userId: session.id,
          };

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return NextResponse.json({
      data: logs.map((log) => ({
        id: log.id,
        source: 'SERVER',
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        details: log.details,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        user: {
          id: log.user?.id || log.userId || '',
          fullName: log.user?.fullName || 'غير معروف',
          role: log.user?.role || null,
          email: log.user?.email || null,
        },
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر جلب سجلات التدقيق' },
      { status: 500 }
    );
  }
}