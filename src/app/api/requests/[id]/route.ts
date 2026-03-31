import { NextRequest, NextResponse } from 'next/server';
import { Role, Status } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { RequestService } from '@/services/request.service';

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieDepartment = decodeURIComponent(
    request.cookies.get('user_department')?.value || 'إدارة عمليات التدريب'
  ).trim();
  const cookieEmployeeId = decodeURIComponent(
    request.cookies.get('user_employee_id')?.value || ''
  ).trim();

  const effectiveRole = mapRole(
    decodeURIComponent(
      request.cookies.get('server_active_role')?.value ||
        request.cookies.get('active_role')?.value ||
        request.cookies.get('user_role')?.value ||
        'user'
    ).trim()
  );

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: {
        id: true,
        department: true,
        email: true,
        employeeId: true,
        status: true,
      },
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
      select: {
        id: true,
        department: true,
        email: true,
        employeeId: true,
        status: true,
      },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: {
        id: true,
        department: true,
        email: true,
        employeeId: true,
        status: true,
      },
    });
  }

  if (!user) {
    throw new Error('تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.');
  }

  if (user.status !== Status.ACTIVE) {
    throw new Error('الحساب غير نشط.');
  }

  return {
    id: user.id,
    role: effectiveRole,
    department: user.department || cookieDepartment,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return NextResponse.json(await RequestService.getById(id));
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر جلب الطلب' },
      { status: 500 }
    );
  }
}

async function handleMutation(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const session = await resolveSessionUser(request);
    const action = String(body?.action || '').trim().toLowerCase();

    if (action === 'issue') {
      if (session.role !== Role.WAREHOUSE) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }

      return NextResponse.json(
        await RequestService.issue(id, session.id, body?.notes || '')
      );
    }

    if (action === 'reject') {
      if (session.role !== Role.WAREHOUSE) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }

      return NextResponse.json(
        await RequestService.reject(id, session.id, body?.reason || body?.notes || 'تم الرفض')
      );
    }

    if (action === 'update') {
      if (session.role !== Role.USER) {
        return NextResponse.json(
          { error: 'هذا الإجراء مخصص للموظف فقط' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        await RequestService.updateBeforeIssue(id, session.id, {
          purpose: body?.purpose || '',
          notes: body?.notes || '',
          items: Array.isArray(body?.items) ? body.items : [],
        })
      );
    }

    if (action === 'cancel') {
      if (session.role !== Role.USER) {
        return NextResponse.json(
          { error: 'هذا الإجراء مخصص للموظف فقط' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        await RequestService.cancelBeforeIssue(id, session.id, body?.notes || '')
      );
    }

    if (action === 'adjust_after_issue') {
      if (session.role !== Role.USER) {
        return NextResponse.json(
          { error: 'هذا الإجراء مخصص للموظف فقط' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        await RequestService.adjustAfterIssue(id, session.id, {
          notes: body?.notes || '',
          items: Array.isArray(body?.items) ? body.items : [],
        })
      );
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
  } catch (error: any) {
    const statusCode =
      error?.message === 'تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.' ||
      error?.message === 'الحساب غير نشط.'
        ? 401
        : 400;

    return NextResponse.json(
      { error: error.message || 'تعذر تنفيذ العملية' },
      { status: statusCode }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleMutation(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleMutation(request, context);
}
