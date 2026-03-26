import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type PrismaRole = 'MANAGER' | 'WAREHOUSE' | 'USER';

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function normalizeRoleValue(value?: string | null): PrismaRole | null {
  const role = (value || '').trim().toLowerCase();
  if (role === 'manager') return 'MANAGER';
  if (role === 'warehouse') return 'WAREHOUSE';
  if (role === 'user') return 'USER';
  return null;
}

function normalizeRoles(input: unknown): PrismaRole[] {
  const values = Array.isArray(input)
    ? input
    : input == null
      ? []
      : [input];

  const roles = values
    .map((value) => normalizeRoleValue(String(value)))
    .filter((value): value is PrismaRole => Boolean(value));

  const uniqueRoles = Array.from(new Set<PrismaRole>(['USER', ...roles]));

  if (uniqueRoles.includes('MANAGER')) {
    uniqueRoles.sort((a, b) => {
      const order: Record<PrismaRole, number> = {
        MANAGER: 0,
        WAREHOUSE: 1,
        USER: 2,
      };
      return order[a] - order[b];
    });
    return uniqueRoles;
  }

  if (uniqueRoles.includes('WAREHOUSE')) {
    uniqueRoles.sort((a, b) => {
      const order: Record<PrismaRole, number> = {
        WAREHOUSE: 0,
        USER: 1,
        MANAGER: 2,
      };
      return order[a] - order[b];
    });
    return uniqueRoles;
  }

  return ['USER'];
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const action = body?.action;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (action === 'activate' || action === 'approve') {
      await prisma.user.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'disable' || action === 'archive' || action === 'reject') {
      await prisma.user.update({
        where: { id },
        data: { status: 'DISABLED' },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'change-role') {
      const explicitRoles = normalizeRoles(body?.roles);
      const fallbackRoles = normalizeRoles(body?.role ? [body.role] : []);
      const roles = explicitRoles.length > 1 || body?.roles ? explicitRoles : fallbackRoles;

      await prisma.user.update({
        where: { id },
        data: { roles },
      });

      return NextResponse.json({ ok: true, roles });
    }

    if (action === 'reset-password') {
      const password = normalizeText(body?.password);

      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'كلمة المرور الجديدة غير صالحة' }, { status: 400 });
      }

      await prisma.user.update({
        where: { id },
        data: { passwordHash: password },
      });

      return NextResponse.json({ ok: true, password });
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'تعذر تنفيذ الإجراء المطلوب' }, { status: 500 });
  }
}
