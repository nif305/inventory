import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function normalizeRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return ['user'];

  const allowed = new Set(['user', 'warehouse', 'manager']);
  const roles = value
    .map((item) => normalizeText(String(item)).toLowerCase())
    .filter((item) => allowed.has(item));

  const uniqueRoles = Array.from(new Set(roles));
  return uniqueRoles.length ? uniqueRoles : ['user'];
}

function toPrismaRoles(roles: string[]) {
  return roles.map((role) => {
    if (role === 'manager') return 'MANAGER';
    if (role === 'warehouse') return 'WAREHOUSE';
    return 'USER';
  });
}

function toPrimaryRole(roles: string[]) {
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('warehouse')) return 'warehouse';
  return 'user';
}

function mapUser(user: any) {
  const roles = Array.isArray(user.roles)
    ? user.roles.map((role: string) => role.toLowerCase())
    : [String(user.role || 'USER').toLowerCase()];

  return {
    id: user.id,
    employeeId: user.employeeId,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    extension: user.jobTitle || '',
    department: user.department,
    jobTitle: user.jobTitle,
    operationalProject: user.department,
    role: toPrimaryRole(roles),
    roles,
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

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        undertaking: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      data: users.map(mapUser),
    });
  } catch {
    return NextResponse.json({ error: 'تعذر جلب المستخدمين' }, { status: 500 });
  }
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
    const roles = normalizeRoles(body?.roles);

    if (!fullName || !email || !mobile || !password) {
      return NextResponse.json({ error: 'البيانات المطلوبة غير مكتملة' }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });

    if (exists) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم من قبل' }, { status: 409 });
    }

    const count = await prisma.user.count();
    const employeeId = `NAUSS-${String(count + 1).padStart(3, '0')}`;

    const user = await prisma.user.create({
      data: {
        employeeId,
        fullName,
        email,
        mobile,
        department: operationalProject || 'لا ينطبق',
        jobTitle: extension || '',
        passwordHash: password,
        roles: toPrismaRoles(roles),
        status: 'ACTIVE',
      },
      include: {
        undertaking: true,
      },
    });

    return NextResponse.json({ data: mapUser(user) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'تعذر إنشاء المستخدم' }, { status: 500 });
  }
}
