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
          targetDepartment,
          externalRecipient,
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

    if (!suggestionId || !action) {
      return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 });
    }

    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

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
          status: MaintenanceStatus.PENDING,
          notes: [
            itemName ? `المادة/العنصر: ${itemName}` : '',
            quantity ? `الكمية: ${quantity}` : '',
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

      await prisma.emailDraft.create({
        data: {
          sourceType: 'maintenance',
          sourceId: maintenance.id,
          recipient: externalRecipient || targetDepartment,
          subject: `طلب ${category === 'CLEANING' ? 'نظافة' : 'صيانة'} - ${maintenance.code}`,
          body: `
سعادة الجهة المختصة حفظها الله،

نفيدكم بوجود طلب ${category === 'CLEANING' ? 'نظافة' : 'صيانة'} يحتاج المعالجة وفق البيانات الآتية:

- رقم الطلب: ${maintenance.code}
- الوصف: ${suggestion.description}
- المادة / العنصر: ${itemName || 'غير محدد'}
- الكمية: ${quantity || 1}
- الموقع: ${location || 'غير محدد'}
- الأولوية: ${suggestion.priority}
- مبررات الطلب: ${justificationData.rawJustification || '—'}

نأمل اتخاذ اللازم، ولكم التقدير.
          `.trim(),
          status: 'DRAFT',
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
            `مبررات الطلب: ${justificationData.rawJustification || '—'}`,
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

      await prisma.emailDraft.create({
        data: {
          sourceType: 'purchase',
          sourceId: purchase.id,
          recipient: externalRecipient || targetDepartment,
          subject: `طلب شراء مباشر - ${purchase.code}`,
          body: `
سعادة الجهة المختصة حفظها الله،

نفيدكم بحاجة وكالة التدريب إلى تنفيذ طلب شراء مباشر وفق البيانات الآتية:

- رقم الطلب: ${purchase.code}
- المادة / الصنف: ${itemName || purchase.items}
- الكمية: ${quantity || 1}
- الوصف: ${suggestion.description}
- المبررات: ${justificationData.rawJustification || '—'}
- الموقع / الجهة المستفيدة: ${location || 'غير محدد'}

نأمل التكرم باستكمال الإجراء اللازم.
          `.trim(),
          status: 'DRAFT',
        },
      });
    } else {
      await prisma.emailDraft.create({
        data: {
          sourceType: 'other',
          sourceId: suggestion.id,
          recipient: externalRecipient || targetDepartment,
          subject: `${suggestion.title} - طلب إحالة خارجي`,
          body: `
سعادة الجهة المختصة حفظها الله،

نفيدكم بورود الطلب الآتي من داخل المنصة، ونأمل التكرم بمراجعته واتخاذ اللازم:

- العنوان: ${suggestion.title}
- الوصف: ${suggestion.description}
- المادة / العنصر: ${itemName || 'غير محدد'}
- الكمية: ${quantity || 1}
- الموقع: ${location || 'غير محدد'}
- المبررات: ${justificationData.rawJustification || '—'}

وتفضلوا بقبول التقدير.
          `.trim(),
          status: 'DRAFT',
        },
      });

      linkedEntityType = 'EmailDraft';
      linkedEntityId = suggestion.id;
      linkedCode = suggestion.title;
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