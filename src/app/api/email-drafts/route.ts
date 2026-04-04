import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type JsonObject = Record<string, any>;

type RequesterInfo = {
  fullName?: string;
  email?: string;
  mobile?: string;
  department?: string;
  jobTitle?: string;
};

function parseJsonObject(value: unknown): JsonObject {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as JsonObject;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
}

function normalizeSuggestionCategory(value?: string | null) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'MAINTENANCE') return 'MAINTENANCE';
  if (normalized === 'CLEANING') return 'CLEANING';
  if (normalized === 'PURCHASE') return 'PURCHASE';
  return 'OTHER';
}

function requestTypeLabel(category?: string | null, sourceType?: string | null) {
  const normalized = normalizeSuggestionCategory(category || sourceType);
  if (normalized === 'MAINTENANCE') return 'طلب صيانة';
  if (normalized === 'CLEANING') return 'طلب نظافة';
  if (normalized === 'PURCHASE') return 'طلب شراء مباشر';
  return 'طلب آخر';
}

function attachmentLabel(file: any, index: number) {
  const type = String(file?.contentType || file?.type || '').toLowerCase();
  const name = String(file?.filename || file?.name || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return `صورة مرفقة ${index + 1}`;
  if (type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|wmv)$/i.test(name)) return `فيديو مرفق ${index + 1}`;
  if (type.includes('pdf') || /\.pdf$/i.test(name)) return `ملف PDF مرفق ${index + 1}`;
  return `مرفق ${index + 1}`;
}

function toSafeString(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function buildRow(params: {
  draft: any;
  suggestion: any | null;
  requester: RequesterInfo | null;
}) {
  const { draft, suggestion, requester } = params;
  const adminData = parseJsonObject(suggestion?.adminNotes);
  const justification = parseJsonObject(suggestion?.justification);

  const requestCode =
    toSafeString(adminData.linkedCode, '') ||
    toSafeString(justification.publicCode, '') ||
    toSafeString(suggestion?.id, '') ||
    toSafeString(draft.sourceId, '') ||
    draft.id;

  const requestType = requestTypeLabel(suggestion?.category, draft.sourceType);
  const attachments = Array.isArray(justification.attachments)
    ? justification.attachments.map((file: any, index: number) => attachmentLabel(file, index))
    : [];

  const requesterName = toSafeString(requester?.fullName || justification.requesterName || '');
  const requesterEmail = toSafeString(requester?.email || justification.requesterEmail || '');
  const requesterMobile = toSafeString(requester?.mobile || justification.requesterMobile || '');
  const requesterDepartment = 'إدارة عمليات التدريب';
  const requesterJobTitle = toSafeString(requester?.jobTitle || justification.requesterJobTitle || '');
  const location = toSafeString(justification.location || justification.area || '');
  const itemName = toSafeString(justification.itemName || justification.items || '');
  const description = toSafeString(suggestion?.description || justification.description || justification.reason || '');

  return {
    id: draft.id,
    subject: toSafeString(draft.subject || `${requestType} - ${requestCode}`),
    to: toSafeString(draft.recipient || '', ''),
    status: draft.status,
    createdAt: draft.createdAt,
    copiedAt: draft.copiedAt,
    requestCode,
    requestTypeLabel: requestType,
    requesterName,
    requesterDepartment,
    requesterEmail,
    requesterMobile,
    requesterJobTitle,
    location,
    itemName,
    description,
    attachments,
    body: String(draft.body || ''),
  };
}

export async function GET(_request: NextRequest) {
  try {
    const drafts = await prisma.emailDraft.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const suggestions = await prisma.suggestion.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        justification: true,
        category: true,
        requesterId: true,
        adminNotes: true,
        createdAt: true,
      },
    });

    const linkedDraftMap = new Map<string, any>();
    const suggestionById = new Map<string, any>();
    const requesterIds = new Set<string>();

    for (const suggestion of suggestions) {
      suggestionById.set(String(suggestion.id), suggestion);
      if (suggestion.requesterId) requesterIds.add(String(suggestion.requesterId));
      const adminData = parseJsonObject(suggestion.adminNotes);
      const linkedDraftId = String(adminData.linkedDraftId || '').trim();
      if (linkedDraftId) linkedDraftMap.set(linkedDraftId, suggestion);
    }

    const requesterRows = requesterIds.size
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(requesterIds) } },
          select: {
            id: true,
            fullName: true,
            email: true,
            mobile: true,
            department: true,
            jobTitle: true,
          },
        })
      : [];

    const requesterMap = new Map(requesterRows.map((row) => [String(row.id), row]));

    const data = drafts.map((draft) => {
      const suggestion =
        linkedDraftMap.get(String(draft.id)) ||
        suggestionById.get(String(draft.sourceId)) ||
        null;
      const requester = suggestion?.requesterId ? requesterMap.get(String(suggestion.requesterId)) || null : null;
      return buildRow({ draft, suggestion, requester });
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر تحميل المراسلات الخارجية حاليًا' },
      { status: 500 }
    );
  }
}
