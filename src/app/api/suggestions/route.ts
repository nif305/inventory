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

async function generateMaintenanceCode() {
  const count = await prisma.maintenanceRequest.count();
  return `MNT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

async function generatePurchaseCode() {
  const count = await prisma.purchaseRequest.count();
  return `PUR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

function escapeHtml(value?: string | null) {
  return String(value || '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function buildMemoTable(rows: Array<Array<[string, string]>>) {
  return `
<table dir="rtl" style="width:100%;border-collapse:collapse;font-family:Tahoma,Arial,sans-serif;font-size:14px">
  <tbody>
    ${rows
      .map(
        (row) => `
      <tr>
        ${row
          .map(
            ([label, value]) => `
          <td style="width:${row.length === 1 ? '22%' : '16%'};border:1px solid #d6d7d4;background:#f8f9f9;padding:10px;font-weight:bold;color:#1f3d3c">${escapeHtml(label)}</td>
          <td style="width:${row.length === 1 ? '78%' : '17%'};border:1px solid #d6d7d4;padding:10px;color:#304342">${escapeHtml(value)}</td>
          `
          )
          .join('')}
      </tr>`
      )
      .join('')}
  </tbody>
</table>
  `.trim();
}

function buildSupportMemoBody(params: {
  requestCode: string;
  createdAt: Date | string;
  requestTypeLabel: string;
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

  const table = buildMemoTable([
    [
      ['رقم الطلب', params.requestCode],
      ['تاريخ الطلب', date],
      ['وقت الطلب', time],
    ],
    [['نوع الطلب', params.requestTypeLabel]],
    [
      ['مقدم الطلب', params.requesterName],
      ['الإدارة', params.requesterDepartment],
      ['البريد الإلكتروني', params.requesterEmail],
    ],
    [
      ['الموقع', params.location],
      ['عدد الملاحظات', params.notesCount],
    ],
    [['التفاصيل', params.description]],
    [['حيثيات الطلب', params.sourcePurpose]],
    [['السبب/ الملاحظة', params.justification]],
    [['ملاحظة المدير', params.adminNotes]],
  ]);

  return `
<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.95;color:#152625">
  <p style="margin:0 0 12px 0">الأخوة في إدارة الخدمات المساندة سلّمهم الله</p>
  <p style="margin:0 0 12px 0">السلام عليكم ورحمة الله وبركاته،،</p>
  <p style="margin:0 0 16px 0">
    تهديكم إدارة عمليات التدريب أطيب التحايا، وبالإشارة إلى بعض الملاحظات الفنية التي وردتنا، والتي تستلزم التدخل والمعالجة، نفيدكم بها حسب البيان التالي:
  </p>
  <div style="margin:0 0 18px 0">${table}</div>
  <p style="margin:0 0 8px 0">نأمل منكم التكرم بمعالجة المشكلة في أقرب وقت ممكن، أو التوجيه لمن يلزم باتخاذ الإجراء المناسب.</p>
  <p style="margin:0">فريق إدارة عمليات التدريب</p>
  <p style="margin:0">وكالة التدريب</p>
</div>
  `.trim();
}

function buildPurchaseMemoBody(params: {
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

  const table = buildMemoTable([
    [
      ['رقم الطلب', params.requestCode],
      ['تاريخ الطلب', date],
      ['وقت الطلب', time],
    ],
    [['نوع الطلب', 'طلب شراء مباشر']],
    [
      ['مقدم الطلب', params.requesterName],
      ['الإدارة', params.requesterDepartment],
      ['البريد الإلكتروني', params.requesterEmail],
    ],
    [
      ['الموقع', params.location],
      ['عدد الملاحظات', params.notesCount],
    ],
    [['التفاصيل', params.description]],
    [['حيثيات الطلب', params.sourcePurpose]],
    [['السبب/ الملاحظة', params.justification]],
    [['ملاحظة المدير', params.adminNotes]],
  ]);

  return `
<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.95;color:#152625">
  <p style="margin:0 0 12px 0">الأخ / نواف المحارب سلّمه الله</p>
  <p style="margin:0 0 12px 0">السلام عليكم ورحمة الله وبركاته،،</p>
  <p style="margin:0 0 16px 0">
    آمل منكم التكرم برفع طلب المشتريات المذكورة أدناه في نظام ERP، وإحالته إلى إدارة المشتريات لتوفير المواد المطلوبة، وذلك حسب البيان التالي:
  </p>
  <div style="margin:0 0 18px 0">${table}</div>
  <p style="margin:0 0 8px 0">شاكرين لكم تعاونكم، وآمل التكرم باتخاذ ما يلزم حيال ذلك.</p>
  <p style="margin:0">فريق إدارة عمليات التدريب</p>
  <p style="margin:0">وكالة التدريب</p>
</div>
  `.trim();
}

function buildOtherMemoBody(params: {
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

  const table = buildMemoTable([
    [
      ['رقم الطلب', params.requestCode],
      ['تاريخ الطلب', date],
      ['وقت الطلب', time],
    ],
    [['نوع الطلب', 'طلب آخر']],
    [
      ['مقدم الطلب', params.requesterName],
      ['الإدارة', params.requesterDepartment],
      ['البريد الإلكتروني', params.requesterEmail],
    ],
    [
      ['الموقع', params.location],
      ['عدد الملاحظات', params.notesCount],
    ],
    [['التفاصيل', params.description]],
    [['حيثيات الطلب', params.sourcePurpose]],
    [['السبب/ الملاحظة', params.justification]],
    [['ملاحظة المدير', params.adminNotes]],
  ]);

  return `
<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.95;color:#152625">
  <p style="margin:0 0 12px 0">السلام عليكم ورحمة الله وبركاته،،</p>
  <p style="margin:0 0 16px 0">
    نفيدكم بالملاحظة/الطلب الموضح أدناه، ونأمل الاطلاع واتخاذ ما يلزم حسب البيان التالي:
  </p>
  <div style="margin:0 0 18px 0">${table}</div>
  <p style="margin:0 0 8px 0">نأمل التكرم باتخاذ الإجراء المناسب، والتوجيه لمن يلزم حيال ذلك.</p>
  <p style="margin:0">فريق إدارة عمليات التدريب</p>
  <p style="margin:0">وكالة التدريب</p>
</div>
  `.trim();
}

function supportRecipients(requesterEmail: string) {
  return ['ssd@nauss.edu.sa', 'AAlosaimi@nauss.edu.sa', requesterEmail].filter(Boolean).join(', ');
}

function purchaseRecipients() {
  return ['NMuharib@nauss.edu.sa'].join(', ');
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
    return NextResponse.json({ error: error.message || 'تعذر جلب الطلبات الأخرى' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionUser = await resolveSessionUser(request);

    const category = normalizeCategory(body.category);
    const priority = normalizePriority(body.priority);

    const itemName = String(body.itemName || '').trim();
    const quantity = Number(body.quantity || 1);
    const location = String(body.location || '').trim();
    const targetDepartment = normalizeTargetDepartment(body.targetDepartment);
    const externalRecipient = String(body.externalRecipient || '').trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    const description = String(body.description || '').trim();
    const justification = String(body.justification || '').trim();
    const sourcePurpose = String(body.sourcePurpose || '').trim();
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
      return NextResponse.json({ error: 'الوصف والمبررات حقول مطلوبة' }, { status: 400 });
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
          sourcePurpose,
          targetDepartment,
          externalRecipient,
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
      select: { fullName: true, department: true, email: true },
    });

    const justificationData = (() => {
      try {
        return JSON.parse(suggestion.justification || '{}');
      } catch {
        return {};
      }
    })();

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
    const quantity = Number(justificationData.quantity || 1);
    const location = String(justificationData.location || '').trim();
    const externalRecipient = String(justificationData.externalRecipient || '').trim();
    const sourcePurpose = String(justificationData.sourcePurpose || '').trim();
    const rawJustification = String(justificationData.rawJustification || '').trim();
    const attachments = Array.isArray(justificationData.attachments) ? justificationData.attachments : [];
    const notesCount = String(Math.max(attachments.length || 0, 1));

    let linkedEntityType = '';
    let linkedEntityId = '';
    let linkedCode = '';
    let emailDraftId = '';

    const requesterName = requester?.fullName || '—';
    const requesterDepartment = requester?.department || '—';
    const requesterEmail = requester?.email || '';

    if (category === 'MAINTENANCE' || category === 'CLEANING') {
      const code = await generateMaintenanceCode();

      const maintenance = await prisma.maintenanceRequest.create({
        data: {
          code,
          requesterId: suggestion.requesterId,
          category: category === 'CLEANING' ? 'CLEANING' : 'TECHNICAL',
          description: suggestion.description,
          priority: suggestion.priority,
          status: MaintenanceStatus.PENDING,
          notes: [
            itemName ? `المادة/العنصر: ${itemName}` : '',
            quantity ? `عدد الملاحظات: ${notesCount}` : '',
            location ? `الموقع: ${location}` : '',
            adminNotes ? `ملاحظة المدير: ${adminNotes}` : '',
          ]
            .filter(Boolean)
            .join(' | '),
        },
      });

      linkedEntityType = 'MaintenanceRequest';
      linkedEntityId = maintenance.id;
      linkedCode = maintenance.code;

      const htmlBody = buildSupportMemoBody({
        requestCode: maintenance.code,
        createdAt: suggestion.createdAt,
        requestTypeLabel: category === 'CLEANING' ? 'طلب نظافة' : 'طلب صيانة',
        requesterName,
        requesterDepartment,
        requesterEmail,
        location: location || '—',
        notesCount,
        description: suggestion.description || '—',
        sourcePurpose: sourcePurpose || '—',
        justification: rawJustification || '—',
        adminNotes: adminNotes || '—',
      });

      const draft = await prisma.emailDraft.create({
        data: {
          sourceType: 'maintenance',
          sourceId: maintenance.id,
          recipient: externalRecipient || supportRecipients(requesterEmail),
          subject: `${category === 'CLEANING' ? 'طلب نظافة' : 'طلب صيانة'} - ${maintenance.code}`,
          body: htmlBody,
          status: 'DRAFT',
        },
      });

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
            `مبررات الطلب: ${rawJustification || '—'}`,
            location ? `الموقع/الجهة: ${location}` : '',
            adminNotes ? `ملاحظة المدير: ${adminNotes}` : '',
          ]
            .filter(Boolean)
            .join(' | '),
          estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : null,
          targetDepartment,
          status: PurchaseStatus.APPROVED,
        },
      });

      linkedEntityType = 'PurchaseRequest';
      linkedEntityId = purchase.id;
      linkedCode = purchase.code;

      const htmlBody = buildPurchaseMemoBody({
        requestCode: purchase.code,
        createdAt: suggestion.createdAt,
        requesterName,
        requesterDepartment,
        requesterEmail,
        location: location || '—',
        notesCount,
        description: suggestion.description || '—',
        sourcePurpose: sourcePurpose || '—',
        justification: rawJustification || '—',
        adminNotes: adminNotes || '—',
      });

      const draft = await prisma.emailDraft.create({
        data: {
          sourceType: 'purchase',
          sourceId: purchase.id,
          recipient: externalRecipient || purchaseRecipients(),
          subject: `طلب شراء مباشر - ${purchase.code}`,
          body: htmlBody,
          status: 'DRAFT',
        },
      });

      emailDraftId = draft.id;
    } else {
      const requestCode = `OTH-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

      linkedEntityType = 'EmailDraft';
      linkedEntityId = suggestion.id;
      linkedCode = requestCode;

      const htmlBody = buildOtherMemoBody({
        requestCode,
        createdAt: suggestion.createdAt,
        requesterName,
        requesterDepartment,
        requesterEmail,
        location: location || '—',
        notesCount,
        description: suggestion.description || '—',
        sourcePurpose: sourcePurpose || '—',
        justification: rawJustification || '—',
        adminNotes: adminNotes || '—',
      });

      const draft = await prisma.emailDraft.create({
        data: {
          sourceType: 'other',
          sourceId: suggestion.id,
          recipient: externalRecipient || requesterEmail || targetDepartment,
          subject: `${suggestion.title} - ${requestCode}`,
          body: htmlBody,
          status: 'DRAFT',
        },
      });

      emailDraftId = draft.id;
    }

    const updated = await prisma.suggestion.update({
      where: { id: suggestionId },
      data: {
        status: SuggestionStatus.IMPLEMENTED,
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
