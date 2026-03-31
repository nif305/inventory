import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function normalizeRoles(roleOrRoles: unknown): string[] {
  if (Array.isArray(roleOrRoles)) {
    const roles = roleOrRoles.map((role) => String(role).toLowerCase()).filter(Boolean);
    return roles.includes('user') ? Array.from(new Set(roles)) : ['user', ...Array.from(new Set(roles))];
  }

  if (typeof roleOrRoles === 'string' && roleOrRoles.trim()) {
    const role = roleOrRoles.toLowerCase();
    return role === 'user' ? ['user'] : ['user', role];
  }

  return ['user'];
}

function getPrimaryRole(roles: string[]): string {
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('warehouse')) return 'warehouse';
  return 'user';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').trim();
    const password = String(body?.password || '').trim();

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      include: {
        undertaking: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const passwordFields = [
      (user as any).password,
      (user as any).passwordHash,
      (user as any).hashedPassword,
    ].filter(Boolean);

    const isValidPassword = passwordFields.some((value) => String(value) === password);

    if (!isValidPassword) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const roles = normalizeRoles((user as any).roles ?? (user as any).role);
    const primaryRole = getPrimaryRole(roles);

    const response = NextResponse.json({
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
        role: primaryRole,
        roles,
        status: String(user.status || 'ACTIVE').toLowerCase(),
        avatar: user.avatar,
        createdAt: user.createdAt?.toISOString?.() || null,
        lastLoginAt: null,
        mustChangePassword: false,
        undertaking: {
          accepted: !!user.undertaking?.accepted,
          acceptedAt: user.undertaking?.acceptedAt ? user.undertaking.acceptedAt.toISOString() : null,
        },
      },
    });

    const cookieOptions = {
      httpOnly: true as const,
      sameSite: 'lax' as const,
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    };

    response.cookies.set('inventory_platform_session', 'active', cookieOptions);
    response.cookies.set('user_id', user.id, cookieOptions);
    response.cookies.set('user_role', primaryRole, cookieOptions);
    response.cookies.set('user_roles', JSON.stringify(roles), cookieOptions);
    response.cookies.set('active_role', primaryRole, cookieOptions);
    response.cookies.set('server_active_role', primaryRole, cookieOptions);
    response.cookies.set('server_user_roles', JSON.stringify(roles), cookieOptions);
    response.cookies.set('user_status', String(user.status || 'ACTIVE').toLowerCase(), cookieOptions);
    response.cookies.set('user_email', user.email || '', cookieOptions);
    response.cookies.set('user_name', user.fullName || '', cookieOptions);
    response.cookies.set('user_department', user.department || '', cookieOptions);
    response.cookies.set('user_employee_id', user.employeeId || '', cookieOptions);

    return response;
  } catch {
    return NextResponse.json({ error: 'تعذر تسجيل الدخول' }, { status: 500 });
  }
}
