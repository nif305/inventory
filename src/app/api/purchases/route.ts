import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PurchaseStatus, Role, Status } from '@prisma/client';

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

async function generatePurchaseCode() {
  const count = await prisma.purchaseRequest.count();
  return `PUR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    const status = request.nextUrl.searchParams.get('status') || '';

    const where =
      sessionUser.role === Role.MANAGER
        ? status
          ? { status: status as PurchaseStatus }
          : {}
        : {
            requesterId: sessionUser.id,
            ...(status ? { status: status as PurchaseStatus } : {}),
          };

    const rows = await prisma.purchaseRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر جلب طلبات الشراء' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionUser = await resolveSessionUser(request);
    const code = await generatePurchaseCode();

    const row = await prisma.purchaseRequest.create({
      data: {
        code,
        requesterId: sessionUser.id,
        items: String(body.items || '').trim(),
        reason: String(body.reason || '').trim(),
        budgetNote: String(body.budgetNote || '').trim() || null,
        estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : null,
        targetDepartment: String(body.targetDepartment || '').trim() || null,
        status: PurchaseStatus.PENDING,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'CREATE_PURCHASE',
        entity: 'PurchaseRequest',
        entityId: row.id,
        details: JSON.stringify({ code: row.code }),
      },
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر إنشاء طلب الشراء' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionUser = await resolveSessionUser(request);

    if (sessionUser.role !== Role.MANAGER) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const requestId = String(body.requestId || '').trim();
    const action = String(body.action || '').trim().toLowerCase();

    if (!requestId || !action) {
      return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 });
    }

    let nextStatus: PurchaseStatus;

    if (action === 'approve') nextStatus = PurchaseStatus.APPROVED;
    else if (action === 'reject') nextStatus = PurchaseStatus.REJECTED;
    else if (action === 'order') nextStatus = PurchaseStatus.ORDERED;
    else if (action === 'receive') nextStatus = PurchaseStatus.RECEIVED;
    else return NextResponse.json({ error: 'الإجراء غير صالح' }, { status: 400 });

    const updated = await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
      },
    });

    if (action === 'approve') {
      await prisma.emailDraft.create({
        data: {
          sourceType: 'purchase',
          sourceId: updated.id,
          recipient: updated.targetDepartment || 'PROCUREMENT',
          subject: `طلب شراء مباشر - ${updated.code}`,
          body: `
سعادة الجهة المختصة حفظها الله،

نفيدكم بحاجة وكالة التدريب إلى توفير/شراء ما يلي:

- رقم الطلب: ${updated.code}
- الأصناف المطلوبة: ${updated.items}
- المبررات: ${updated.reason}
- ملاحظات الميزانية: ${updated.budgetNote || '—'}
- القيمة التقديرية: ${updated.estimatedValue || '—'}

نأمل استكمال اللازم.
          `.trim(),
          status: 'DRAFT',
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'UPDATE_PURCHASE',
        entity: 'PurchaseRequest',
        entityId: updated.id,
        details: JSON.stringify({ code: updated.code, status: nextStatus }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر تحديث طلب الشراء' }, { status: 400 });
  }
}