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

function escapeHtml(value?: string | null) {
  return String(value || '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseJsonObject(value?: string | null) {
  if (!value) return {} as Record<string, any>;
  try {
    return JSON.parse(value);
  } catch {
    return {} as Record<string, any>;
  }
}

function normalizeAttachments(value: any) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? { filename: item } : item || {})).filter(Boolean);
}

function formatDateTime(value: Date | string) {
  const dateValue = typeof value === 'string' ? new Date(value) : value;

  const date = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Riyadh',
  }).format(dateValue);

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Riyadh',
  }).format(dateValue);

  return { date, time };
}

function pairRow(label1: string, value1: string, label2: string, value2: string) {
  return `
<tr>
  <td style="width:16%;border:1px solid #d6d7d4;background:#f8f9f9;padding:10px;font-weight:bold;color:#1f3d3c;vertical-align:top">${escapeHtml(label1)}</td>
  <td style="width:34%;border:1px solid #d6d7d4;padding:10px;color:#304342;vertical-align:top;word-break:break-word">${escapeHtml(value1)}</td>
  <td style="width:16%;border:1px solid #d6d7d4;background:#f8f9f9;padding:10px;font-weight:bold;color:#1f3d3c;vertical-align:top">${escapeHtml(label2)}</td>
  <td style="width:34%;border:1px solid #d6d7d4;padding:10px;color:#304342;vertical-align:top;word-break:break-word">${escapeHtml(value2)}</td>
</tr>
  `.trim();
}

function mergedRow(label: string, value: string) {
  return `
<tr>
  <td style="width:16%;border:1px solid #d6d7d4;background:#f8f9f9;padding:10px;font-weight:bold;color:#1f3d3c;vertical-align:top">${escapeHtml(label)}</td>
  <td colspan="3" style="border:1px solid #d6d7d4;padding:10px;color:#304342;vertical-align:top;word-break:break-word;line-height:1.95">${escapeHtml(value)}</td>
</tr>
  `.trim();
}

function supportIntro() {
  return `
<p style="margin:0 0 12px 0">الأخوة في إدارة الخدمات المساندة سلّمهم الله</p>
<p style="margin:0 0 12px 0">السلام عليكم ورحمة الله وبركاته،،</p>
<p style="margin:0 0 16px 0">تهديكم إدارة عمليات التدريب أطيب التحايا، وبالإشارة إلى بعض الملاحظات الفنية التي وردتنا، والتي تستلزم التدخل والمعالجة، نفيدكم بها حسب البيان التالي:</p>
  `.trim();
}

function purchaseIntro() {
  return `
<p style="margin:0 0 12px 0">الأخ / نواف المحارب سلّمه الله</p>
<p style="margin:0 0 12px 0">السلام عليكم ورحمة الله وبركاته،،</p>
<p style="margin:0 0 16px 0">آمل منكم التكرم برفع طلب المشتريات المذكورة أدناه في نظام ERP، وإحالته إلى إدارة المشتريات لتوفير المواد المطلوبة، وذلك حسب البيان التالي:</p>
  `.trim();
}

function otherIntro() {
  return `
<p style="margin:0 0 12px 0">السلام عليكم ورحمة الله وبركاته،،</p>
<p style="margin:0 0 16px 0">نفيدكم بالملاحظة/الطلب الموضح أدناه، ونأمل الاطلاع واتخاذ ما يلزم حسب البيان التالي:</p>
  `.trim();
}

function supportClosing() {
  return `
<p style="margin:16px 0 8px 0">نأمل منكم التكرم بمعالجة المشكلة في أقرب وقت ممكن، أو التوجيه لمن يلزم باتخاذ الإجراء المناسب.</p>
<p style="margin:0">فريق إدارة عمليات التدريب</p>
<p style="margin:0">وكالة التدريب</p>
  `.trim();
}

function purchaseClosing() {
  return `
<p style="margin:16px 0 8px 0">شاكرين لكم تعاونكم، وآمل التكرم باتخاذ ما يلزم حيال ذلك.</p>
<p style="margin:0">فريق إدارة عمليات التدريب</p>
<p style="margin:0">وكالة التدريب</p>
  `.trim();
}

function otherClosing() {
  return `
<p style="margin:16px 0 8px 0">نأمل التكرم باتخاذ الإجراء المناسب، والتوجيه لمن يلزم حيال ذلك.</p>
<p style="margin:0">فريق إدارة عمليات التدريب</p>
<p style="margin:0">وكالة التدريب</p>
  `.trim();
}

function buildMemoBody(params: {
  category: string;
  requestCode: string;
  createdAt: Date | string;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  location: string;
  notesCount: string;
  description: string;
  sourcePurpose: string;
  justification: string;
  adminNotes: string;
}) {
  const { date, time } = formatDateTime(params.createdAt);
  const requestTypeLabel =
    params.category === 'MAINTENANCE'
      ? 'طلب صيانة'
      : params.category === 'CLEANING'
      ? 'طلب نظافة'
      : params.category === 'PURCHASE'
      ? 'طلب شراء مباشر'
      : 'طلب آخر';

  const rows = [
    pairRow('رقم الطلب', params.requestCode, 'تاريخ الطلب / وقت الطلب', `${date} | ${time}`),
    mergedRow('نوع الطلب', requestTypeLabel),
    pairRow('مقدم الطلب', params.requesterName, 'الإدارة / البريد الإلكتروني', `${params.requesterDepartment} | ${params.requesterEmail}`),
    pairRow('الموقع', params.location, 'عدد الملاحظات', params.notesCount),
    mergedRow('التفاصيل', params.description),
    mergedRow('حيثيات الطلب', params.sourcePurpose),
    mergedRow('السبب/ الملاحظة', params.justification),
    mergedRow('ملاحظة المدير', params.adminNotes),
  ];

  const intro =
    params.category === 'PURCHASE'
      ? purchaseIntro()
      : params.category === 'OTHER'
      ? otherIntro()
      : supportIntro();

  const closing =
    params.category === 'PURCHASE'
      ? purchaseClosing()
      : params.category === 'OTHER'
      ? otherClosing()
      : supportClosing();

  return `
<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.95;color:#152625">
  ${intro}
  <table dir="rtl" style="width:100%;border-collapse:collapse;font-family:Tahoma,Arial,sans-serif;font-size:14px;table-layout:fixed">
    <tbody>
      ${rows.join('')}
    </tbody>
  </table>
  ${closing}
</div>
  `.trim();
}

function resolveRecipients(category: string, requesterEmail?: string | null, externalRecipient?: string) {
  if (category === 'PURCHASE') {
    return 'NMuharib@nauss.edu.sa';
  }

  const recipients: string[] = [];

  if (category === 'MAINTENANCE' || category === 'CLEANING') {
    recipients.push('ssd@nauss.edu.sa', 'AAlosaimi@nauss.edu.sa');
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

async function handleModeration(request: NextRequest) {
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
    const sourcePurpose = String(justificationData.requestSource || justificationData.programName || justificationData.area || '').trim();
    const rawJustification = String(justificationData.rawJustification || '').trim();
    const attachments = normalizeAttachments(justificationData.attachments);
    const notesCount = String(Math.max(attachments.length, 1));

    let linkedEntityType = '';
    let linkedEntityId = '';
    let linkedCode = '';
    let emailDraftId = '';

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
            location ? `الموقع: ${location}` : '',
            rawJustification ? `الملاحظة: ${rawJustification}` : '',
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
          body: buildMemoBody({
            category,
            requestCode: maintenance.code,
            createdAt: suggestion.createdAt,
            requesterName: requester?.fullName || '—',
            requesterDepartment: requester?.department || '—',
            requesterEmail: requester?.email || '',
            location: location || '—',
            notesCount,
            description: suggestion.description || '—',
            sourcePurpose: sourcePurpose || '—',
            justification: rawJustification || '—',
            adminNotes: adminNotes || '—',
          }),
          status: 'DRAFT',
        },
      });

      linkedEntityType = 'MaintenanceRequest';
      linkedEntityId = maintenance.id;
      linkedCode = maintenance.code;
      emailDraftId = draft.id;
    } else if (category === 'PURCHASE') {
      const code = await generatePurchaseCode();

      const purchase = await prisma.purchaseRequest.create({
        data: {
          code,
          requesterId: suggestion.requesterId,
          items: itemName ? `${itemName} × ${quantity}` : suggestion.title,
          reason: suggestion.description,
          budgetNote: [
            rawJustification ? `الحيثيات: ${rawJustification}` : '',
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
          body: buildMemoBody({
            category,
            requestCode: purchase.code,
            createdAt: suggestion.createdAt,
            requesterName: requester?.fullName || '—',
            requesterDepartment: requester?.department || '—',
            requesterEmail: requester?.email || '',
            location: location || '—',
            notesCount,
            description: suggestion.description || '—',
            sourcePurpose: sourcePurpose || '—',
            justification: rawJustification || '—',
            adminNotes: adminNotes || '—',
          }),
          status: 'DRAFT',
        },
      });

      linkedEntityType = 'PurchaseRequest';
      linkedEntityId = purchase.id;
      linkedCode = purchase.code;
      emailDraftId = draft.id;
    } else {
      const code = await generateOtherCode();
      const recipient = resolveRecipients(category, requester?.email, managerRecipient || externalRecipient);

      const draft = await prisma.emailDraft.create({
        data: {
          sourceType: 'other',
          sourceId: suggestion.id,
          recipient,
          subject: `${suggestion.title} - ${code}`,
          body: buildMemoBody({
            category,
            requestCode: code,
            createdAt: suggestion.createdAt,
            requesterName: requester?.fullName || '—',
            requesterDepartment: requester?.department || '—',
            requesterEmail: requester?.email || '',
            location: location || '—',
            notesCount,
            description: suggestion.description || '—',
            sourcePurpose: sourcePurpose || '—',
            justification: rawJustification || '—',
            adminNotes: adminNotes || '—',
          }),
          status: 'DRAFT',
        },
      });

      linkedEntityType = 'EmailDraft';
      linkedEntityId = draft.id;
      linkedCode = code;
      emailDraftId = draft.id;
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
          emailDraftId,
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
          emailDraftId,
        }),
      },
    });

    return NextResponse.json({
      data: updated,
      linkedEntityType,
      linkedEntityId,
      linkedCode,
      emailDraftId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر معالجة الطلب' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  return handleModeration(request);
}

export async function PATCH(request: NextRequest) {
  return handleModeration(request);
}
