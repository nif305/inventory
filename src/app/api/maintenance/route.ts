import { NextRequest, NextResponse } from 'next/server';
import { MaintenanceStatus, PrismaClient, Role, Status } from '@prisma/client';

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
  const activeRole = decodeURIComponent(
    request.headers.get('x-active-role') ||
    request.cookies.get('server_active_role')?.value ||
    request.cookies.get('active_role')?.value ||
    request.cookies.get('user_role')?.value ||
    'user'
  ).trim();

  const role = mapRole(activeRole);

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, roles: true, fullName: true, department: true, email: true, employeeId: true, status: true },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: cookieEmail, mode: 'insensitive' } },
      select: { id: true, roles: true, fullName: true, department: true, email: true, employeeId: true, status: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, roles: true, fullName: true, department: true, email: true, employeeId: true, status: true },
    });
  }

  if (!user) {
    throw new Error('تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.');
  }

  if (user.status !== Status.ACTIVE) {
    throw new Error('الحساب غير نشط.');
  }

  return {
    id: user.id,
    fullName: user.fullName || cookieName,
    department: user.department || cookieDepartment,
    email: user.email || cookieEmail,
    employeeId: user.employeeId || cookieEmployeeId,
    role,
    roles: Array.isArray(user.roles) ? user.roles : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    const status = request.nextUrl.searchParams.get('status') || '';

    const where =
      sessionUser.role === Role.MANAGER
        ? status
          ? { status: status as MaintenanceStatus }
          : {}
        : {
            requesterId: sessionUser.id,
            ...(status ? { status: status as MaintenanceStatus } : {}),
          };

    const rows = await prisma.maintenanceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر جلب البلاغات' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionUser = await resolveSessionUser(request);
    const code = await generateMaintenanceCode();

    const row = await prisma.maintenanceRequest.create({
      data: {
        code,
        requesterId: sessionUser.id,
        category: String(body.category || 'TECHNICAL').trim().toUpperCase(),
        description: String(body.description || '').trim(),
        priority: body.priority || 'NORMAL',
        notes: String(body.notes || '').trim() || null,
        itemId: body.itemId || null,
        status: MaintenanceStatus.PENDING,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'CREATE_MAINTENANCE',
        entity: 'MaintenanceRequest',
        entityId: row.id,
        details: JSON.stringify({ code: row.code, category: row.category }),
      },
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر إنشاء البلاغ' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionUser = await resolveSessionUser(request);

    if (sessionUser.role !== Role.MANAGER) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim().toUpperCase() as MaintenanceStatus;
    const notes = String(body.notes || '').trim();

    if (!id || !status) {
      return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 });
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status,
        notes: notes || undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'UPDATE_MAINTENANCE',
        entity: 'MaintenanceRequest',
        entityId: updated.id,
        details: JSON.stringify({ code: updated.code, status }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر تحديث البلاغ' }, { status: 400 });
  }
}