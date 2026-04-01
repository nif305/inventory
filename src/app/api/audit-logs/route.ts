import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
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
  const cookieEmployeeId = decodeURIComponent(request.cookies.get('user_employee_id')?.value || '').trim();
  const cookieRole = decodeURIComponent(request.cookies.get('user_role')?.value || 'user').trim();

  const activeRole = mapRole(cookieRole);

  let user: {
    id: string;
    roles: Role[];
  } | null = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, roles: true },
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
      select: { id: true, roles: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, roles: true },
    });
  }

  if (!user) {
    throw new Error('تعذر التحقق من المستخدم الحالي');
  }

  if (!Array.isArray(user.roles) || !user.roles.includes(activeRole)) {
    throw new Error('الدور النشط غير صالح لهذا المستخدم');
  }

  return {
    id: user.id,
    activeRole,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);

    const where =
      session.activeRole === Role.MANAGER
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
            roles: true,
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
          role:
            Array.isArray(log.user?.roles) && log.user.roles.length > 0
              ? log.user.roles[0]
              : null,
          roles: log.user?.roles || [],
          email: log.user?.email || null,
        },
      })),
      stats: {
        total: logs.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر جلب سجلات التدقيق' },
      { status: error?.message?.includes('المستخدم') || error?.message?.includes('الدور') ? 401 : 500 }
    );
  }
}
