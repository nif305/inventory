import { NextRequest, NextResponse } from 'next/server';
import {
  MaintenanceStatus,
  PrismaClient,
  Priority,
  PurchaseStatus,
  Role,
  Status,
  SuggestionStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

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
  const activeRole = decodeURIComponent(
    request.headers.get('x-active-role') ||
    request.cookies.get('server_active_role')?.value ||
    request.cookies.get('active_role')?.value ||
    request.cookies.get('user_role')?.value ||
    'user'
  ).trim();

  const role = mapRole(activeRole);

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, roles: true, fullName: true, department: true, email: true, employeeId: true, status: true },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: cookieEmail, mode: 'insensitive' } },
      select: { id: true, roles: true, fullName: true, department: true, email: true, employeeId: true, status: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, roles: true, fullName: true, department: true, email: true, employeeId: true, status: true },
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
    fullName: user.fullName || cookieName,
    department: user.department || cookieDepartment,
    email: user.email || cookieEmail,
    employeeId: user.employeeId || cookieEmployeeId,
    role,
    roles: Array.isArray(user.roles) ? user.roles : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    const role = sessionUser.role;
    const category = request.nextUrl.searchParams.get('category') || '';

    const where =
      role === Role.MANAGER
        ? category
          ? { category }
          : {}
        : {
            requesterId: sessionUser.id,
            ...(category ? { category } : {}),
          };

    const suggestions = await prisma.suggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const users = await prisma.user.findMany({
      where: {
        id: {
          in: suggestions.map((s) => s.requesterId),
        },
      },
      select: {
        id: true,
        fullName: true,
        department: true,
        role: true,
        email: true,
      },
    });

    const usersMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      data: suggestions.map((item) => ({
        ...item,
        requester: usersMap.get(item.requesterId) || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر جلب الطلبات' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionUser = await resolveSessionUser(request);

    const category = normalizeCategory(body.category);
    const priority = normalizePriority(body.priority);

    const itemName = String(body.itemName || '').trim();
    const quantity = Math.max(1, Number(body.quantity || 1));
    const location = String(body.location || '').trim();
    const targetDepartment = normalizeTargetDepartment(body.targetDepartment);
    const externalRecipient = String(body.externalRecipient || '').trim();
    const requestSource = String(body.requestSource || '').trim();
    const programName = String(body.programName || '').trim();
    const area = String(body.area || '').trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    const description = String(body.description || '').trim();
    const justification = String(body.justification || '').trim();
    const title =
      String(body.title || '').trim() ||
      (category === 'MAINTENANCE'
        ? 'طلب صيانة'
        : category === 'CLEANING'
        ? 'طلب نظافة'
        : category === 'PURCHASE'
        ? 'طلب شراء مباشر'
        : 'طلب آخر');

    if (!description || !justification) {
      return NextResponse.json({ error: 'الوصف والحيثيات حقول مطلوبة' }, { status: 400 });
    }

    const suggestion = await prisma.suggestion.create({
      data: {
        title,
        description,
        justification: JSON.stringify({
          rawJustification: justification,
          itemName,
          quantity,
          location,
          targetDepartment,
          externalRecipient,
          requestSource,
          programName,
          area,
          attachments,
        }),
        category,
        priority,
        requesterId: sessionUser.id,
        status: SuggestionStatus.PENDING,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'CREATE_SUGGESTION',
        entity: 'Suggestion',
        entityId: suggestion.id,
        details: JSON.stringify({
          title,
          category,
          itemName,
          quantity,
          location,
        }),
      },
    });

    await notifyManagersAboutSuggestion({
      suggestionId: suggestion.id,
      category,
      title,
      requesterName: sessionUser.fullName || 'مستخدم النظام',
    });

    return NextResponse.json({ data: suggestion }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر إنشاء الطلب' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionUser = await resolveSessionUser(request);

    if (sessionUser.role !== Role.MANAGER) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const suggestionId = String(body.suggestionId || '').trim();
    const action = String(body.action || '').trim().toLowerCase();
    const adminNotes = String(body.adminNotes || '').trim();
    const targetDepartment = normalizeTargetDepartment(body.targetDepartment);
    const managerRecipient = String(body.managerRecipient || '').trim();

    if (!suggestionId || !action) {
      return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 });
    }

    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: suggestion.requesterId },
      select: { id: true, fullName: true, department: true, email: true },
    });

    const justificationData = parseJsonObject(suggestion.justification);

    if (action === 'reject') {
      const updated = await prisma.suggestion.update({
        where: { id: suggestionId },
        data: {
          status: SuggestionStatus.REJECTED,
          adminNotes,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'REJECT_SUGGESTION',
          entity: 'Suggestion',
          entityId: suggestion.id,
          details: JSON.stringify({ adminNotes }),
        },
      });

      await notifyRequesterAboutSuggestion({
        requesterId: suggestion.requesterId,
        suggestionId: suggestion.id,
        category: suggestion.category,
        title: suggestion.title,
        action: 'REJECTED',
        reason: adminNotes,
      });

      return NextResponse.json({ data: updated });
    }

    if (action !== 'approve') {
      return NextResponse.json({ error: 'الإجراء غير صالح' }, { status: 400 });
    }

    const category = normalizeCategory(suggestion.category);
    const itemName = String(justificationData.itemName || '').trim();
    const quantity = Math.max(1, Number(justificationData.quantity || 1));
    const location = String(justificationData.location || '').trim();
    const externalRecipient = String(justificationData.externalRecipient || '').trim();

    let linkedEntityType = '';
    let linkedEntityId = '';
    let linkedCode = '';

    if (category === 'MAINTENANCE' || category === 'CLEANING') {
      const code = await generateMaintenanceCode();

      const maintenance = await prisma.maintenanceRequest.create({
        data: {
          code,
          requesterId: suggestion.requesterId,
          category: category === 'CLEANING' ? 'CLEANING' : 'TECHNICAL',
          description: suggestion.description,
          priority: suggestion.priority,
          status: MaintenanceStatus.APPROVED,
          notes: [
            itemName ? `العنصر: ${itemName}` : '',
            quantity ? `الكمية: ${quantity}` : '',
            location ? `الموقع: ${location}` : '',
            justificationData.rawJustification ? `الحيثيات: ${justificationData.rawJustification}` : '',
            adminNotes ? `ملاحظة المدير: ${adminNotes}` : '',
          ]
            .filter(Boolean)
            .join(' | '),
        },
      });

      const recipient = resolveRecipients(category, requester?.email, externalRecipient);
      const draft = await prisma.emailDraft.create({
        data: {
          sourceType: category === 'CLEANING' ? 'cleaning' : 'maintenance',
          sourceId: maintenance.id,
          recipient,
          subject: `${category === 'CLEANING' ? 'طلب نظافة' : 'طلب صيانة'} - ${maintenance.code}`,
          body: buildFormalBody({
            category,
            requestCode: maintenance.code,
            createdAt: suggestion.createdAt,
            title: suggestion.title,
            description: suggestion.description,
            requesterName: requester?.fullName || '—',
            requesterDepartment: requester?.department || '—',
            requesterEmail: requester?.email || '',
            itemName,
            quantity,
            location,
            justification: String(justificationData.rawJustification || '').trim(),
            adminNotes,
          }),
          status: 'DRAFT',
        },
      });

      linkedEntityType = 'MaintenanceRequest';
      linkedEntityId = maintenance.id;
      linkedCode = maintenance.code;

      await prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'CREATE_EMAIL_DRAFT',
          entity: 'EmailDraft',
          entityId: draft.id,
          details: JSON.stringify({ recipient, sourceType: draft.sourceType, sourceId: draft.sourceId }),
        },
      });
    } else if (category === 'PURCHASE') {
      const code = await generatePurchaseCode();

      const purchase = await prisma.purchaseRequest.create({
        data: {
          code,
          requesterId: suggestion.requesterId,
          items: itemName ? `${itemName} × ${quantity}` : suggestion.title,
          reason: suggestion.description,
          budgetNote: [
            justificationData.rawJustification ? `الحيثيات: ${justificationData.rawJustification}` : '',
            location ? `الموقع: ${location}` : '',
            adminNotes ? `ملاحظة المدير: ${adminNotes}` : '',
          ]
            .filter(Boolean)
            .join(' | '),
          estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : null,
          targetDepartment,
          status: PurchaseStatus.APPROVED,
        },
      });

      const recipient = resolveRecipients(category, requester?.email, externalRecipient);
      const draft = await prisma.emailDraft.create({
        data: {
          sourceType: 'purchase',
          sourceId: purchase.id,
          recipient,
          subject: `طلب شراء مباشر - ${purchase.code}`,
          body: buildFormalBody({
            category,
            requestCode: purchase.code,
            createdAt: suggestion.createdAt,
            title: suggestion.title,
            description: suggestion.description,
            requesterName: requester?.fullName || '—',
            requesterDepartment: requester?.department || '—',
            requesterEmail: requester?.email || '',
            itemName,
            quantity,
            location,
            justification: String(justificationData.rawJustification || '').trim(),
            adminNotes,
          }),
          status: 'DRAFT',
        },
      });

      linkedEntityType = 'PurchaseRequest';
      linkedEntityId = purchase.id;
      linkedCode = purchase.code;

      await prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'CREATE_EMAIL_DRAFT',
          entity: 'EmailDraft',
          entityId: draft.id,
          details: JSON.stringify({ recipient, sourceType: draft.sourceType, sourceId: draft.sourceId }),
        },
      });
    } else {
      const code = await generateOtherCode();
      const recipient = resolveRecipients(category, requester?.email, managerRecipient || externalRecipient);

      const draft = await prisma.emailDraft.create({
        data: {
          sourceType: 'other',
          sourceId: suggestion.id,
          recipient,
          subject: `${suggestion.title} - ${code}`,
          body: buildFormalBody({
            category,
            requestCode: code,
            createdAt: suggestion.createdAt,
            title: suggestion.title,
            description: suggestion.description,
            requesterName: requester?.fullName || '—',
            requesterDepartment: requester?.department || '—',
            requesterEmail: requester?.email || '',
            itemName,
            quantity,
            location,
            justification: String(justificationData.rawJustification || '').trim(),
            adminNotes,
          }),
          status: 'DRAFT',
        },
      });

      linkedEntityType = 'EmailDraft';
      linkedEntityId = draft.id;
      linkedCode = code;

      await prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'CREATE_EMAIL_DRAFT',
          entity: 'EmailDraft',
          entityId: draft.id,
          details: JSON.stringify({ recipient, sourceType: draft.sourceType, sourceId: draft.sourceId }),
        },
      });
    }

    const updated = await prisma.suggestion.update({
      where: { id: suggestionId },
      data: {
        status: SuggestionStatus.APPROVED,
        adminNotes: JSON.stringify({
          adminNotes,
          targetDepartment,
          linkedEntityType,
          linkedEntityId,
          linkedCode,
        }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'APPROVE_SUGGESTION',
        entity: 'Suggestion',
        entityId: suggestion.id,
        details: JSON.stringify({
          category,
          linkedEntityType,
          linkedEntityId,
          linkedCode,
        }),
      },
    });

    await notifyRequesterAboutSuggestion({
      requesterId: suggestion.requesterId,
      suggestionId: suggestion.id,
      category,
      title: suggestion.title,
      action: 'APPROVED',
    });

    return NextResponse.json({
      data: updated,
      linkedEntityType,
      linkedEntityId,
      linkedCode,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر معالجة الطلب' }, { status: 400 });
  }
}
