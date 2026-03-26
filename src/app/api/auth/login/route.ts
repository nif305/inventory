import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type UserRoleValue = 'USER' | 'WAREHOUSE' | 'MANAGER';

function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function normalizeRoleValue(value?: string | null): UserRoleValue {
  const normalized = (value || '').trim().toUpperCase();

  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'WAREHOUSE') return 'WAREHOUSE';
  return 'USER';
}

function normalizeRoles(values?: string[] | null): UserRoleValue[] {
  const rawValues = Array.isArray(values) ? values : [];
  const normalized = Array.from(
    new Set(rawValues.map((value) => normalizeRoleValue(value)))
  );

  if (!normalized.includes('USER')) {
    normalized.unshift('USER');
  }

  return normalized;
}

function getPrimaryRole(roles: UserRoleValue[]): UserRoleValue {
  if (roles.includes('MANAGER')) return 'MANAGER';
  if (roles.includes('WAREHOUSE')) return 'WAREHOUSE';
  return 'USER';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const password = normalizeText(body?.password);

    if (!email) {
      return NextResponse.json({ error: 'يرجى إدخال البريد الإلكتروني' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'يرجى إدخال كلمة المرور' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        undertaking: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    if (user.status === 'DISABLED') {
      return NextResponse.json({ error: 'الحساب موقوف' }, { status: 403 });
    }

    if (user.passwordHash !== password) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const userRoles = normalizeRoles(
      Array.isArray((user as { roles?: string[] }).roles)
        ? (user as { roles?: string[] }).roles
        : [String((user as { role?: string }).role || 'USER')]
    );
    const primaryRole = getPrimaryRole(userRoles);
    const nowIso = new Date().toISOString();

    const response = NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        extension: user.jobTitle || '',
        department: user.department,
        jobTitle: user.jobTitle,
        operationalProject: user.department || '',
        role: primaryRole.toLowerCase(),
        roles: userRoles.map((role) => role.toLowerCase()),
        status: user.status.toLowerCase(),
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: nowIso,
        mustChangePassword: false,
        undertaking: {
          accepted: !!user.undertaking?.accepted,
          acceptedAt: user.undertaking?.acceptedAt
            ? user.undertaking.acceptedAt.toISOString()
            : null,
        },
      },
    });

    response.cookies.set('inventory_platform_session', 'active', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('user_id', user.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('user_role', primaryRole.toLowerCase(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('user_roles', JSON.stringify(userRoles.map((role) => role.toLowerCase())), {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('user_status', user.status.toLowerCase(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('user_email', user.email, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('user_name', user.fullName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('user_department', user.department || '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('user_employee_id', user.employeeId || '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'تعذر تسجيل الدخول' }, { status: 500 });
  }
}
