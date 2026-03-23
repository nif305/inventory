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
  const cookieRole = decodeURIComponent(request.cookies.get('user_role')?.value || 'user').trim();

  const role = mapRole(cookieRole);

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, role: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: cookieEmail, mode: 'insensitive' } },
      select: { id: true, role: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, role: true, fullName: true, department: true, email: true, employeeId: true },
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
      select: { id: true, role: true, fullName: true, department: true, email: true, employeeId: true },
    });
  }

  return user;
}

function normalizeCategory(value?: string) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'MAINTENANCE') return 'MAINTENANCE';
  if (raw === 'CLEANING') return 'CLEANING';
  if (raw === 'PURCHASE') return 'PURCHASE';
  return 'OTHER';
}

function normalizePriority(value?: string): Priority {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'LOW') return Priority.LOW;
  if (raw === 'HIGH') return Priority.HIGH;
  if (raw === 'URGENT') return Priority.URGENT;
  return Priority.NORMAL;
}

function normalizeTargetDepartment(value?: string) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return 'SUPPORT_SERVICES';
  return raw;
}

function formatArabicDate(value: Date) {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

function formatArabicTime(value: Date) {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  } catch {
    return value.toISOString().slice(11, 16);
  }
}

function parseJsonObject(value?: string | null) {
  if (!value) return {} as Record<string, any>;
  try {
    return JSON.parse(value);
  } catch {
    return {} as Record<string, any>;
  }
}

function resolveRecipients(category: string, requesterEmail?: string | null, externalRecipient?: string) {
  const recipients: string[] = [];

  if (category === 'MAINTENANCE' || category === 'CLEANING') {
    recipients.push('ssd@nauss.edu.sa', 'AAlosaimi@nauss.edu.sa');
  } else if (category === 'PURCHASE') {
    recipients.push(
      'finance@nauss.edu.sa',
      'aalaraj@nauss.edu.sa',
      'YAlqaoud@nauss.edu.sa',
      'Procurement@nauss.edu.sa'
    );
  } else if (externalRecipient) {
    externalRecipient
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => recipients.push(item));
  }

  if (requesterEmail) {
    recipients.push(requesterEmail);
  }

  return Array.from(new Set(recipients.map((item) => item.trim()).filter(Boolean))).join(', ');
}

function buildFormalBody(params: {
  category: string;
  requestCode: string;
  createdAt: Date;
  title: string;
  description: string;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  itemName: string;
  quantity: number;
  location: string;
  justification: string;
  adminNotes: string;
}) {
  const categoryLabel =
    params.category === 'MAINTENANCE'
      ? 'صيانة'
      : params.category === 'CLEANING'
      ? 'نظافة'
      : params.category === 'PURCHASE'
      ? 'شراء مباشر'
      : 'طلب آخر';

  return `سعادة الجهة المختصة سلّمها الله،

السلام عليكم ورحمة الله وبركاته،

نفيدكم بورود ${categoryLabel} عبر منصة مواد التدريب، ونأمل التكرم بالاطلاع واتخاذ ما يلزم حيال الطلب الموضح أدناه:

رقم الطلب: ${params.requestCode}
تاريخ الطلب: ${formatArabicDate(params.createdAt)}
وقت الطلب: ${formatArabicTime(params.createdAt)}
نوع الطلب: ${params.title}
مقدم الطلب: ${params.requesterName}
الإدارة: ${params.requesterDepartment}
البريد الإلكتروني: ${params.requesterEmail || '—'}
الموقع: ${params.location || '—'}
العنصر/الجزء: ${params.itemName || '—'}
الكمية: ${params.quantity || 1}
التفاصيل: ${params.description || '—'}
حيثيات الطلب: ${params.justification || '—'}
ملاحظة المدير: ${params.adminNotes || '—'}

نأمل التكرم بمعالجة الطلب حسب المتاح، ولكم خالص التقدير.

إدارة عمليات التدريب
وكالة التدريب`;
}

async function generateMaintenanceCode() {
  const count = await prisma.maintenanceRequest.count();
  return `MNT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

async function generatePurchaseCode() {
  const count = await prisma.purchaseRequest.count();
  return `PUR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

async function generateOtherCode() {
  const count = await prisma.suggestion.count({ where: { category: 'OTHER' } });
  return `OTH-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
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
