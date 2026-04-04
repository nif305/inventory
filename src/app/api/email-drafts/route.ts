import { NextRequest, NextResponse } from 'next/server';
import { Role, Status } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type JsonObject = Record<string, any>;
type SuggestionCategory = 'MAINTENANCE' | 'CLEANING' | 'PURCHASE' | 'OTHER';

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

function parseJsonObject(value: unknown): JsonObject {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as JsonObject;
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

  let user = null as any;
  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, roles: true, status: true },
    });
  }
  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: cookieEmail, mode: 'insensitive' } },
      select: { id: true, roles: true, status: true },
    });
  }
  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, roles: true, status: true },
    });
  }

  if (!user) throw new Error('تعذر التحقق من المستخدم الحالي.');
  if (user.status !== Status.ACTIVE) throw new Error('الحساب غير نشط.');
  if (!Array.isArray(user.roles) || !user.roles.includes(activeRole)) throw new Error('الدور النشط غير صالح.');
  return { ...user, role: activeRole };
}

function normalizeCategory(value: unknown): SuggestionCategory {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'MAINTENANCE') return 'MAINTENANCE';
  if (normalized === 'CLEANING') return 'CLEANING';
  if (normalized === 'PURCHASE') return 'PURCHASE';
  return 'OTHER';
}

function categoryLabel(category: SuggestionCategory) {
  switch (category) {
    case 'MAINTENANCE':
      return 'طلب صيانة';
    case 'CLEANING':
      return 'طلب نظافة';
    case 'PURCHASE':
      return 'طلب شراء مباشر';
    default:
      return 'طلب آخر';
  }
}

function formatAttachmentLabel(item: any, index: number) {
  const rawName = String(item?.name || item?.filename || item?.fileName || item?.url || item || '').toLowerCase();
  const ext = rawName.split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return `صورة مرفقة ${index + 1}`;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) return `فيديو مرفق ${index + 1}`;
  if (ext === 'pdf') return `ملف PDF مرفق ${index + 1}`;
  return `ملف مرفق ${index + 1}`;
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    if (sessionUser.role !== Role.MANAGER) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const drafts = await prisma.emailDraft.findMany({ orderBy: { createdAt: 'desc' } });
    const suggestions = await prisma.suggestion.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        requesterId: true,
        justification: true,
        adminNotes: true,
      },
    });

    const suggestionByDraftId = new Map<string, any>();
    const suggestionById = new Map<string, any>();
    const suggestionByLinkedEntityId = new Map<string, any>();
    for (const suggestion of suggestions) {
      const admin = parseJsonObject(suggestion.adminNotes);
      if (admin.linkedDraftId) suggestionByDraftId.set(String(admin.linkedDraftId), suggestion);
      suggestionById.set(String(suggestion.id), suggestion);
      if (admin.linkedEntityId) suggestionByLinkedEntityId.set(String(admin.linkedEntityId), suggestion);
    }

    const requesterIds = [...new Set(suggestions.map((item) => item.requesterId).filter(Boolean))];
    const users = await prisma.user.findMany({
      where: { id: { in: requesterIds } },
      select: { id: true, fullName: true, email: true, mobile: true, jobTitle: true },
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    const rows = drafts.map((draft) => {
      const suggestion = suggestionByDraftId.get(draft.id) || suggestionById.get(draft.sourceId) || suggestionByLinkedEntityId.get(draft.sourceId) || null;
      const justification = parseJsonObject(suggestion?.justification);
      const admin = parseJsonObject(suggestion?.adminNotes);
      const requester = suggestion?.requesterId ? userMap.get(suggestion.requesterId) : null;
      const category = normalizeCategory(suggestion?.category || draft.sourceType);
      const attachments = Array.isArray(justification.attachments)
        ? justification.attachments.map((item: any, index: number) => formatAttachmentLabel(item, index))
        : [];

      return {
        id: draft.id,
        subject: draft.subject,
        to: draft.recipient,
        body: draft.body,
        status: draft.status,
        createdAt: draft.createdAt,
        requestCode: String(admin.linkedCode || justification.publicCode || draft.sourceId || draft.id),
        requestType: categoryLabel(category),
        requesterName: requester?.fullName || '—',
        requesterDepartment: 'إدارة عمليات التدريب',
        requesterEmail: requester?.email || '—',
        requesterMobile: requester?.mobile || '—',
        requesterJobTitle: requester?.jobTitle || '—',
        location: String(justification.location || '—'),
        itemName: String(justification.itemName || suggestion?.title || '—'),
        description: String(suggestion?.description || '—'),
        attachments,
      };
    });

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر جلب المراسلات الخارجية' }, { status: 500 });
  }
}
