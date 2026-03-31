import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Status } from '@prisma/client';

const prisma = new PrismaClient();

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieEmployeeId = decodeURIComponent(request.cookies.get('user_employee_id')?.value || '').trim();

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, status: true },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: cookieEmail, mode: 'insensitive' } },
      select: { id: true, status: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, status: true },
    });
  }

  if (!user) {
    throw new Error('تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.');
  }

  if (user.status !== Status.ACTIVE) {
    throw new Error('الحساب غير نشط.');
  }

  return user;
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);

    const data = await prisma.notification.findMany({
      where: { userId: sessionUser.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    const statusCode =
      error?.message === 'تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.' ||
      error?.message === 'الحساب غير نشط.'
        ? 401
        : 500;

    return NextResponse.json({ error: error.message || 'تعذر جلب الإشعارات' }, { status: statusCode });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    const body = await request.json();

    const notification = await prisma.notification.findUnique({
      where: { id: String(body.id || '') },
    });

    if (!notification || notification.userId !== sessionUser.id) {
      return NextResponse.json({ error: 'الإشعار غير موجود أو غير مصرح' }, { status: 404 });
    }

    const result = await prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const statusCode =
      error?.message === 'تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.' ||
      error?.message === 'الحساب غير نشط.'
        ? 401
        : 400;

    return NextResponse.json({ error: error.message || 'تعذر تحديث الإشعار' }, { status: statusCode });
  }
}
