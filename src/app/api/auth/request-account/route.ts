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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const fullName = normalizeText(body?.fullName);
    const email = normalizeEmail(body?.email);
    const mobile = normalizeText(body?.mobile);
    const extension = normalizeText(body?.extension);
    const operationalProject = normalizeText(body?.operationalProject);
    const password = normalizeText(body?.password);
    const undertakingAccepted = !!body?.undertakingAccepted;

    if (!fullName || !email || !mobile || !password) {
      return NextResponse.json(
        { error: 'الاسم والبريد والجوال وكلمة المرور مطلوبة' },
        { status: 400 }
      );
    }

    if (!undertakingAccepted) {
      return NextResponse.json(
        { error: 'يجب قبول التعهد قبل إنشاء الحساب' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'يوجد حساب مسجل بهذا البريد الإلكتروني' },
        { status: 409 }
      );
    }

    const newUser = await prisma.user.create({
      data: {
        employeeId: `USR-${Date.now()}`,
        fullName,
        email,
        mobile,
        department: operationalProject || 'لا ينطبق',
        jobTitle: extension || '',
        passwordHash: password,
        role: 'USER',
        status: 'ACTIVE',
        avatar: null,
        undertaking: {
          create: {
            accepted: true,
            acceptedAt: new Date(),
          },
        },
      },
      include: {
        undertaking: true,
      },
    });

    return NextResponse.json(
      {
        message: 'تم إنشاء الحساب بنجاح ويمكن استخدامه مباشرة',
        data: mapUser(newUser),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'تعذر إنشاء الحساب' }, { status: 500 });
  }
}