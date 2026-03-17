import { NextRequest, NextResponse } from 'next/server';
import { Role, Status } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ReturnService } from '@/services/return.service';

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
      select: { id: true, role: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cookieEmail,
          mode: 'insensitive',
        },
      },
      select: { id: true, role: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, role: true, department: true, email: true, employeeId: true },
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
      select: { id: true, role: true, department: true, email: true, employeeId: true },
    });
  }

  return {
    id: user.id,
    role: user.role,
    department: user.department || cookieDepartment,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const status = searchParams.get('status') || '';

    return NextResponse.json(
      await ReturnService.getAll({
        page,
        status,
        role: session.role,
        userId: session.id,
      })
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر جلب طلبات الإرجاع' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const body = await request.json();

    if (!body?.custodyId) {
      return NextResponse.json({ error: 'رقم العهدة مطلوب' }, { status: 400 });
    }

    return NextResponse.json(
      await ReturnService.create({
        custodyId: body.custodyId,
        userId: session.id,
        notes: body.notes || '',
        returnType: body.returnType,
        damageDetails: body.damageDetails || '',
        damageImages: body.damageImages || '',
        declarationAck: Boolean(body.declarationAck),
      }),
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر إنشاء طلب الإرجاع' },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const body = await request.json();

    if (body.action === 'approve') {
      if (session.role !== Role.MANAGER && session.role !== Role.WAREHOUSE) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }

      return NextResponse.json(
        await ReturnService.approve({
          returnId: String(body.returnId || ''),
          approverId: session.id,
          receivedType: body.receivedType,
          receivedNotes: body.receivedNotes || '',
          receivedImages: body.receivedImages || '',
        })
      );
    }

    if (body.action === 'reject') {
      if (session.role !== Role.MANAGER && session.role !== Role.WAREHOUSE) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }

      return NextResponse.json(
        await ReturnService.reject(
          String(body.returnId || ''),
          session.id,
          body.reason || 'تم رفض طلب الإرجاع'
        )
      );
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر تنفيذ الإجراء' },
      { status: 400 }
    );
  }
}