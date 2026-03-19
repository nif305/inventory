import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function clearSessionResponse() {
  const response = NextResponse.json({ user: null }, { status: 401 });

  const cookieOptions = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: true,
    path: '/',
    expires: new Date(0),
  };

  response.cookies.set('inventory_platform_session', '', cookieOptions);
  response.cookies.set('user_id', '', cookieOptions);
  response.cookies.set('user_role', '', cookieOptions);
  response.cookies.set('user_status', '', cookieOptions);
  response.cookies.set('user_email', '', cookieOptions);
  response.cookies.set('user_name', '', cookieOptions);
  response.cookies.set('user_department', '', cookieOptions);
  response.cookies.set('user_employee_id', '', cookieOptions);

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;

    if (!userId) {
      return clearSessionResponse();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        undertaking: true,
      },
    });

    if (!user) {
      return clearSessionResponse();
    }

    if (user.status === 'DISABLED') {
      return clearSessionResponse();
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        extension: user.jobTitle || '',
        department: user.department,
        jobTitle: user.jobTitle,
        operationalProject: user.department || '',
        role: user.role.toLowerCase(),
        status: user.status.toLowerCase(),
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: null,
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

    response.cookies.set('user_role', user.role.toLowerCase(), {
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
    return clearSessionResponse();
  }
}