import { NextRequest, NextResponse } from 'next/server';
import { Priority, PurchaseStatus, Role, Status, SuggestionStatus, MaintenanceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const SUPPORT_RECIPIENTS = 'ssd@nauss.edu.sa,AAlosaimi@nauss.edu.sa';
const PURCHASE_RECIPIENT = 'wa.n1@nauss.edu.sa';

type SuggestionCategory = 'MAINTENANCE' | 'CLEANING' | 'PURCHASE' | 'OTHER';

type JsonObject = Record<string, any>;

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

function normalizeCategory(value: any): SuggestionCategory {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'MAINTENANCE') return 'MAINTENANCE';
  if (normalized === 'CLEANING') return 'CLEANING';
  if (normalized === 'PURCHASE') return 'PURCHASE';
  return 'OTHER';
}

function normalizePriority(value: any): Priority {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'LOW') return Priority.LOW;
  if (normalized === 'HIGH') return Priority.HIGH;
  if (normalized === 'URGENT') return Priority.URGENT;
  return Priority.NORMAL;
}

function normalizeTargetDepartment(value: any) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  return normalized;
}

function parseJsonObject(value: any): JsonObject {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieEmployeeId = decodeURIComponent(request.cookies.get('user_employee_id')?.value || '').trim();
  const activeRoleRaw = decodeURIComponent(
    request.headers.get('x-active-role') ||
      request.cookies.get('server_active_role')?.value ||
      request.cookies.get('active_role')?.value ||
      request.cookies.get('user_role')?.value ||
      'user'
  ).trim();

  const activeRole = mapRole(activeRoleRaw);

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

  if (!user) throw new Error('تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.');
  if (user.status !== Status.ACTIVE) throw new Error('الحساب غير نشط.');
  if (!Array.isArray(user.roles) || !user.roles.includes(activeRole)) {
    throw new Error('الدور النشط غير صالح لهذا المستخدم.');
  }

  return { ...user, role: activeRole };
}

function categoryMeta(category: SuggestionCategory) {
  switch (category) {
    case 'MAINTENANCE':
      return { prefix: 'MNT', label: 'طلب صيانة', notification: 'طلب صيانة' };
    case 'CLEANING':
      return { prefix: 'CLN', label: 'طلب نظافة', notification: 'طلب نظافة' };
    case 'PURCHASE':
      return { prefix: 'PRC', label: 'طلب شراء مباشر', notification: 'طلب شراء مباشر' };
    default:
      return { prefix: 'OTH', label: 'طلب آخر', notification: 'طلب آخر' };
  }
}

async function generatePublicCode(category: SuggestionCategory) {
  const year = new Date().getFullYear();
  const prefix = categoryMeta(category).prefix;
  const existing = await prisma.suggestion.findMany({
    where: { category },
    select: { justification: true },
  });
  let maxSerial = 0;
  for (const row of existing) {
    const parsed = parseJsonObject(row.justification);
    const code = String(parsed.publicCode || '');
    const match = code.match(/-(\d{4})$/);
    if (match) maxSerial = Math.max(maxSerial, Number(match[1]));
  }
  return `${prefix}-${year}-${String(maxSerial + 1).padStart(4, '0')}`;
}

async function generateLinkedCode(category: SuggestionCategory) {
  const year = new Date().getFullYear();
  const prefix = categoryMeta(category).prefix;
  let maxSerial = 0;

  const suggestionRows = await prisma.suggestion.findMany({
    where: { category },
    select: { adminNotes: true },
  });

  for (const row of suggestionRows) {
    const parsed = parseJsonObject(row.adminNotes);
    const code = String(parsed.linkedCode || '');
    const match = code.match(new RegExp(`^${prefix}-${year}-(\d{4})$`));
    if (match) maxSerial = Math.max(maxSerial, Number(match[1]));
  }

  const maintenanceRows = await prisma.maintenanceRequest.findMany({ select: { code: true } });
  for (const row of maintenanceRows) {
    const code = String(row.code || '');
    const match = code.match(new RegExp(`^${prefix}-${year}-(\d{4})$`));
    if (match) maxSerial = Math.max(maxSerial, Number(match[1]));
  }

  const purchaseRows = await prisma.purchaseRequest.findMany({ select: { code: true } });
  for (const row of purchaseRows) {
    const code = String(row.code || '');
    const match = code.match(new RegExp(`^${prefix}-${year}-(\d{4})$`));
    if (match) maxSerial = Math.max(maxSerial, Number(match[1]));
  }

  return `${prefix}-${year}-${String(maxSerial + 1).padStart(4, '0')}`;
}

function buildRecipients(category: SuggestionCategory, provided?: string | null) {
  if (category === 'PURCHASE') return PURCHASE_RECIPIENT;
  if (category === 'MAINTENANCE' || category === 'CLEANING') return SUPPORT_RECIPIENTS;
  return String(provided || '').trim();
}

function buildNotificationTitle(category: SuggestionCategory) {
  return `${categoryMeta(category).notification} جديد`;
}

function buildExternalEmailHtml(params: {
  recipientLabel: string;
  introLine: string;
  requestCode: string;
  requestTitle: string;
  createdAt: Date;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  location?: string;
  quantity?: number | null;
  itemName?: string;
  description: string;
  justification?: string;
  adminNotes?: string;
}) {
  const rows = [
    ['رقم الطلب', params.requestCode],
    ['عنوان الطلب', params.requestTitle],
    ['التاريخ', new Intl.DateTimeFormat('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(params.createdAt))],
    ['مقدم الطلب', params.requesterName],
    ['الإدارة', params.requesterDepartment || '—'],
    ['البريد الإلكتروني', params.requesterEmail || '—'],
    ['الموقع', params.location || '—'],
    ['الكمية', params.quantity ? String(params.quantity) : '—'],
    ['العنصر المطلوب', params.itemName || '—'],
    ['سبب الطلب', params.description || '—'],
  ];
  if (params.justification) rows.push(['إيضاحات إضافية', params.justification]);
  if (params.adminNotes) rows.push(['توجيه المدير', params.adminNotes]);

  const tableRows = rows.map(([label, value]) => `<tr><td style="padding:10px 12px;border:1px solid #d6d7d4;font-weight:700;background:#f8fbfb;width:180px;">${label}</td><td style="padding:10px 12px;border:1px solid #d6d7d4;">${value}</td></tr>`).join('');

  return `
  <div dir="rtl" style="font-family:Cairo,Tahoma,Arial,sans-serif;color:#1f2937;line-height:1.9;">
    <div style="font-size:18px;font-weight:700;margin-bottom:12px;">${params.recipientLabel}</div>
    <div style="margin-bottom:12px;">السلام عليكم ورحمة الله وبركاته،</div>
    <div style="margin-bottom:12px;">تهديكم إدارة عمليات التدريب أطيب التحيات، وبناءً على إفادة الموظف الموضح اسمه أدناه، نأمل التكرم بالاطلاع على الطلب التالي واتخاذ ما يلزم حيال معالجته:</div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${tableRows}</table>
    <div style="margin-top:14px;">نأمل منكم التكرم بتوجيه من يلزم لمعالجة المطلوب، وتقبلوا خالص التحية.</div>
    <div style="margin-top:18px;font-weight:700;">فريق عمل إدارة عمليات التدريب<br/>وكالة الجامعة للتدريب</div>
  </div>`;
}

async function notifyManagersAboutSuggestion(params: { suggestionId: string; category: SuggestionCategory; title: string; requesterName: string; code: string; }) {
  const managers = await prisma.user.findMany({
    where: { status: Status.ACTIVE, roles: { has: Role.MANAGER } },
    select: { id: true },
  });
  if (!managers.length) return;
  await prisma.notification.createMany({
    data: managers.map((manager) => ({
      userId: manager.id,
      type: 'SUGGESTION_PENDING',
      title: buildNotificationTitle(params.category),
      message: `تم رفع ${categoryMeta(params.category).label} برقم ${params.code} من ${params.requesterName}`,
      link: '/suggestions',
      entityId: params.suggestionId,
      entityType: 'suggestion',
    })),
  });
}

async function notifyRequesterAboutSuggestion(params: { requesterId: string; suggestionId: string; category: SuggestionCategory; title: string; action: 'APPROVED' | 'REJECTED'; reason?: string; }) {
  await prisma.notification.create({
    data: {
      userId: params.requesterId,
      type: `SUGGESTION_${params.action}`,
      title: params.action === 'APPROVED' ? `${categoryMeta(params.category).label} تمت الموافقة عليه` : `${categoryMeta(params.category).label} تم رفضه`,
      message: params.action === 'APPROVED' ? `تم اعتماد ${params.title}` : `تم رفض ${params.title}${params.reason ? `: ${params.reason}` : ''}`,
      link: '/suggestions',
      entityId: params.suggestionId,
      entityType: 'suggestion',
    },
  });
}

function mapSuggestionRow(item: any, requesterMap: Map<string, any>) {
  const justificationData = parseJsonObject(item.justification);
  const adminData = parseJsonObject(item.adminNotes);
  const requester = requesterMap.get(item.requesterId) || null;
  return {
    ...item,
    code: justificationData.publicCode || adminData.linkedCode || item.id,
    requester,
    itemName: justificationData.itemName || '',
    quantity: justificationData.quantity || null,
    location: justificationData.location || '',
    targetDepartment: adminData.targetDepartment || justificationData.targetDepartment || null,
    linkedDraftId: adminData.linkedDraftId || null,
    linkedCode: adminData.linkedCode || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    const categoryParam = request.nextUrl.searchParams.get('category') || request.nextUrl.searchParams.get('type') || '';
    const category = categoryParam ? normalizeCategory(categoryParam) : null;

    const where: any = {
      ...(category ? { category } : {}),
      ...(sessionUser.role === Role.MANAGER ? {} : { requesterId: sessionUser.id }),
    };

    const suggestions = await prisma.suggestion.findMany({ where, orderBy: { createdAt: 'desc' } });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(suggestions.map((s) => s.requesterId))] } },
      select: { id: true, fullName: true, department: true, email: true, roles: true },
    });
    const requesterMap = new Map(users.map((u) => [u.id, { ...u, role: u.roles?.[0] || Role.USER }]));
    const rows = suggestions.map((item) => mapSuggestionRow(item, requesterMap));

    const statsBase = sessionUser.role === Role.MANAGER ? suggestions : suggestions.filter((s) => s.requesterId === sessionUser.id);
    const countBy = (cat: SuggestionCategory, status?: SuggestionStatus) => statsBase.filter((row) => row.category === cat && (!status || row.status === status)).length;

    return NextResponse.json({
      data: rows,
      stats: {
        total: statsBase.length,
        pending: statsBase.filter((row) => row.status === SuggestionStatus.PENDING).length,
        approved: statsBase.filter((row) => row.status === SuggestionStatus.APPROVED || row.status === SuggestionStatus.IMPLEMENTED).length,
        rejected: statsBase.filter((row) => row.status === SuggestionStatus.REJECTED).length,
        maintenancePending: countBy('MAINTENANCE', SuggestionStatus.PENDING),
        cleaningPending: countBy('CLEANING', SuggestionStatus.PENDING),
        purchasePending: countBy('PURCHASE', SuggestionStatus.PENDING),
        otherPending: countBy('OTHER', SuggestionStatus.PENDING),
      },
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
    const externalRecipient = String(body.externalRecipient || '').trim();
    const requestSource = String(body.requestSource || '').trim();
    const programName = String(body.programName || '').trim();
    const area = String(body.area || '').trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const description = String(body.description || '').trim();
    const title = String(body.title || '').trim() || categoryMeta(category).label;

    if (!description) {
      return NextResponse.json({ error: 'يرجى كتابة سبب الطلب أو الملاحظة' }, { status: 400 });
    }

    const publicCode = await generatePublicCode(category);

    const suggestion = await prisma.suggestion.create({
      data: {
        title,
        description,
        justification: JSON.stringify({
          publicCode,
          itemName,
          quantity,
          location,
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
        details: JSON.stringify({ title, category, publicCode, itemName, quantity, location }),
      },
    });

    await notifyManagersAboutSuggestion({
      suggestionId: suggestion.id,
      category,
      title,
      requesterName: sessionUser.fullName || 'مستخدم النظام',
      code: publicCode,
    });

    return NextResponse.json({ data: { ...suggestion, code: publicCode } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر إنشاء الطلب' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
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

    if (!suggestionId || !action) {
      return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 });
    }

    const suggestion = await prisma.suggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: suggestion.requesterId },
      select: { id: true, fullName: true, department: true, email: true },
    });

    const justificationData = parseJsonObject(suggestion.justification);
    const adminData = parseJsonObject(suggestion.adminNotes);
    const category = normalizeCategory(suggestion.category);
    const publicCode = String(justificationData.publicCode || adminData.publicCode || await generatePublicCode(category));
    const itemName = String(justificationData.itemName || '').trim();
    const quantity = Math.max(1, Number(justificationData.quantity || 1));
    const location = String(justificationData.location || '').trim();
    const externalRecipient = String(justificationData.externalRecipient || '').trim();

    if (action === 'reject') {
      const updated = await prisma.suggestion.update({
        where: { id: suggestionId },
        data: {
          status: SuggestionStatus.REJECTED,
          adminNotes: JSON.stringify({
            ...adminData,
            adminNotes,
            publicCode,
            targetDepartment,
          }),
        },
      });

      await notifyRequesterAboutSuggestion({
        requesterId: suggestion.requesterId,
        suggestionId,
        category,
        title: suggestion.title,
        action: 'REJECTED',
        reason: adminNotes,
      });

      return NextResponse.json({ data: { ...updated, code: publicCode } });
    }

    if (action !== 'approve') {
      return NextResponse.json({ error: 'الإجراء غير صالح' }, { status: 400 });
    }

    let linkedEntityType = String(adminData.linkedEntityType || '');
    let linkedEntityId = String(adminData.linkedEntityId || '');
    let linkedCode = String(adminData.linkedCode || '');

    if (category === 'MAINTENANCE' || category === 'CLEANING') {
      if (linkedEntityId) {
        const existing = await prisma.maintenanceRequest.findUnique({ where: { id: linkedEntityId } });
        if (!existing) linkedEntityId = '';
        else {
          linkedEntityType = 'MaintenanceRequest';
          linkedCode = existing.code || linkedCode;
        }
      }

      if (!linkedEntityId && linkedCode) {
        const existing = await prisma.maintenanceRequest.findFirst({ where: { code: linkedCode } });
        if (existing) {
          linkedEntityId = existing.id;
          linkedEntityType = 'MaintenanceRequest';
          linkedCode = existing.code || linkedCode;
        }
      }

      if (!linkedEntityId) {
        linkedCode = linkedCode || await generateLinkedCode(category);
        try {
          const maintenance = await prisma.maintenanceRequest.create({
            data: {
              code: linkedCode,
              requesterId: suggestion.requesterId,
              category: category === 'CLEANING' ? 'CLEANING' : 'TECHNICAL',
              description: suggestion.description,
              priority: suggestion.priority,
              status: MaintenanceStatus.APPROVED,
              notes: adminNotes || null,
            },
          });
          linkedEntityType = 'MaintenanceRequest';
          linkedEntityId = maintenance.id;
          linkedCode = maintenance.code;
        } catch (error: any) {
          const duplicate = await prisma.maintenanceRequest.findFirst({ where: { code: linkedCode } });
          if (!duplicate) throw error;
          linkedEntityType = 'MaintenanceRequest';
          linkedEntityId = duplicate.id;
          linkedCode = duplicate.code;
        }
      }
    } else if (category === 'PURCHASE') {
      if (linkedEntityId) {
        const existing = await prisma.purchaseRequest.findUnique({ where: { id: linkedEntityId } });
        if (!existing) linkedEntityId = '';
        else {
          linkedEntityType = 'PurchaseRequest';
          linkedCode = existing.code || linkedCode;
        }
      }

      if (!linkedEntityId && linkedCode) {
        const existing = await prisma.purchaseRequest.findFirst({ where: { code: linkedCode } });
        if (existing) {
          linkedEntityId = existing.id;
          linkedEntityType = 'PurchaseRequest';
          linkedCode = existing.code || linkedCode;
        }
      }

      if (!linkedEntityId) {
        linkedCode = linkedCode || await generateLinkedCode(category);
        try {
          const purchase = await prisma.purchaseRequest.create({
            data: {
              code: linkedCode,
              requesterId: suggestion.requesterId,
              items: itemName || suggestion.title,
              reason: suggestion.description,
              budgetNote: adminNotes || null,
              estimatedValue: null,
              targetDepartment,
              status: PurchaseStatus.APPROVED,
            },
          });
          linkedEntityType = 'PurchaseRequest';
          linkedEntityId = purchase.id;
          linkedCode = purchase.code;
        } catch (error: any) {
          const duplicate = await prisma.purchaseRequest.findFirst({ where: { code: linkedCode } });
          if (!duplicate) throw error;
          linkedEntityType = 'PurchaseRequest';
          linkedEntityId = duplicate.id;
          linkedCode = duplicate.code;
        }
      }
    } else {
      linkedEntityType = 'Suggestion';
      linkedEntityId = suggestionId;
      linkedCode = linkedCode || await generateLinkedCode(category);
    }

    const recipient = buildRecipients(category, externalRecipient);
    const recipientLabel = category === 'PURCHASE' ? 'سعادة الأستاذ نواف المحارب سلمه الله' : 'سعادة مدير الإدارة المختصة سلمه الله';

    let linkedDraftId = String(adminData.linkedDraftId || '');
    let draft = null as any;

    if (linkedDraftId) {
      draft = await prisma.emailDraft.findUnique({ where: { id: linkedDraftId } });
    }

    if (!draft) {
      draft = await prisma.emailDraft.findFirst({
        where: {
          sourceType: category.toLowerCase(),
          sourceId: linkedEntityId || suggestion.id,
        },
      });
    }

    const draftBody = buildExternalEmailHtml({
      recipientLabel,
      requestCode: linkedCode,
      requestTitle: suggestion.title,
      createdAt: suggestion.createdAt,
      requesterName: requester?.fullName || '—',
      requesterDepartment: requester?.department || '—',
      requesterEmail: requester?.email || '—',
      location,
      quantity,
      itemName,
      description: suggestion.description,
      adminNotes,
    });

    if (draft) {
      draft = await prisma.emailDraft.update({
        where: { id: draft.id },
        data: {
          recipient,
          subject: `${suggestion.title} - ${linkedCode}`,
          body: draftBody,
          status: 'DRAFT',
        },
      });
    } else {
      draft = await prisma.emailDraft.create({
        data: {
          sourceType: category.toLowerCase(),
          sourceId: linkedEntityId || suggestion.id,
          recipient,
          subject: `${suggestion.title} - ${linkedCode}`,
          body: draftBody,
          status: 'DRAFT',
        },
      });
    }

    const updated = await prisma.suggestion.update({
      where: { id: suggestionId },
      data: {
        status: SuggestionStatus.APPROVED,
        adminNotes: JSON.stringify({
          ...adminData,
          adminNotes,
          targetDepartment,
          linkedEntityType,
          linkedEntityId,
          linkedCode,
          linkedDraftId: draft.id,
          publicCode,
        }),
      },
    });

    await notifyRequesterAboutSuggestion({
      requesterId: suggestion.requesterId,
      suggestionId,
      category,
      title: suggestion.title,
      action: 'APPROVED',
    });

    return NextResponse.json({
      data: { ...updated, code: publicCode },
      linkedEntityType,
      linkedEntityId,
      linkedCode,
      linkedDraftId: draft.id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر معالجة الطلب' }, { status: 400 });
  }
}

export const PUT = PATCH;
