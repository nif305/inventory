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
    fullName: string;
    department: string;
    email: string;
    employeeId: string;
  } | null = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, roles: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: cookieEmail, mode: 'insensitive' } },
      select: { id: true, roles: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, roles: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user) {
    throw new Error('تعذر التحقق من المستخدم الحالي');
  }

  if (!Array.isArray(user.roles) || !user.roles.includes(activeRole)) {
    throw new Error('الدور النشط غير صالح لهذا المستخدم');
  }

  return {
    ...user,
    activeRole,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);

    if (sessionUser.activeRole !== Role.MANAGER) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const drafts = await prisma.emailDraft.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: drafts.map((draft) => ({
        id: draft.id,
        subject: draft.subject,
        to: draft.recipient,
        cc: null,
        body: draft.body,
        status: draft.status === 'COPIED' ? 'READY' : draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.copiedAt || draft.createdAt,
        createdBy: null,
      })),
      stats: {
        total: drafts.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر جلب مسودات البريد' },
      { status: error?.message?.includes('المستخدم') || error?.message?.includes('الدور') ? 401 : 500 }
    );
  }
}
