import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function mapUser(user: any) {
  return {
    id: user.id,
    employeeId: user.employeeId,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    extension: '',
    department: user.department,
    jobTitle: user.jobTitle,
    operationalProject: user.department,
    role: user.role.toLowerCase(),
    status: user.status.toLowerCase(),
    avatar: user.avatar,
    undertaking: {
      accepted: !!user.undertaking?.accepted,
      acceptedAt: user.undertaking?.acceptedAt
        ? user.undertaking.acceptedAt.toISOString()
        : null,
    },
    createdAt: user.createdAt?.toISOString?.() || null,
    lastLoginAt: null,
    mustChangePassword: false,
  };
}

function toPrismaRole(role?: string) {
  if (role === 'manager') return 'MANAGER';
  if (role === 'warehouse') return 'WAREHOUSE';
  return 'USER';
}

function toPrismaStatus(status?: string) {
  if (status === 'active') return 'ACTIVE';
  if (status === 'disabled') return 'DISABLED';
  if (status === 'pending') return 'PENDING';
  if (status === 'rejected') return 'REJECTED';
  return 'ACTIVE';
}

async function updateUserHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const fullName = normalizeText(body?.fullName);
    const email = normalizeEmail(body?.email);
    const mobile = normalizeText(body?.mobile);
    const department = normalizeText(body?.department);
    const jobTitle = normalizeText(body?.jobTitle);
    const operationalProject = normalizeText(body?.operationalProject);
    const password = normalizeText(body?.password);
    const role = normalizeText(body?.role);
    const status = normalizeText(body?.status);

    const currentUser = await prisma.user.findUnique({
      where: { id },
      include: {
        undertaking: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (email) {
      const duplicated = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id },
        },
      });

      if (duplicated) {
        return NextResponse.json(
          { error: 'البريد الإلكتروني مستخدم من حساب آخر' },
          { status: 409 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        fullName: fullName || currentUser.fullName,
        email: email || currentUser.email,
        mobile: mobile || currentUser.mobile,
        department:
          operationalProject ||
          department ||
          currentUser.department,
        jobTitle: jobTitle || currentUser.jobTitle,
        passwordHash: password || currentUser.passwordHash,
        role: role ? toPrismaRole(role) : currentUser.role,
        status: status ? toPrismaStatus(status) : currentUser.status,
      },
      include: {
        undertaking: true,
      },
    });

    return NextResponse.json({ data: mapUser(updatedUser) });
  } catch {
    return NextResponse.json({ error: 'تعذر تحديث المستخدم' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        undertaking: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ data: mapUser(user) });
  } catch {
    return NextResponse.json({ error: 'تعذر جلب المستخدم' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return updateUserHandler(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return updateUserHandler(request, context);
}