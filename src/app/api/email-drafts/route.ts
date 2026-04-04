import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type JsonObject = Record<string, any>;

type AttachmentLike = {
  filename?: string;
  contentType?: string;
};

function parseJsonObject(value: any): JsonObject {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as JsonObject;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mapCategoryLabel(category?: string | null) {
  const normalized = String(category || '').trim().toUpperCase();
  if (normalized === 'MAINTENANCE') return 'طلب صيانة';
  if (normalized === 'CLEANING') return 'طلب نظافة';
  if (normalized === 'PURCHASE') return 'طلب شراء مباشر';
  if (normalized === 'OTHER') return 'طلب آخر';
  if (normalized === 'MAINTENANCE'.toLowerCase()) return 'طلب صيانة';
  if (normalized === 'CLEANING'.toLowerCase()) return 'طلب نظافة';
  if (normalized === 'PURCHASE'.toLowerCase()) return 'طلب شراء مباشر';
  return 'طلب';
}

function simplifyAttachmentName(item: AttachmentLike, index: number) {
  const contentType = String(item?.contentType || '').toLowerCase();
  const filename = String(item?.filename || '').toLowerCase();
  const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/.test(filename);
  const isVideo = contentType.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(filename);
  const isPdf = contentType.includes('pdf') || filename.endsWith('.pdf');
  if (isImage) return `صورة مرفقة ${index + 1}`;
  if (isVideo) return `فيديو مرفق ${index + 1}`;
  if (isPdf) return `ملف PDF مرفق ${index + 1}`;
  return `ملف مرفق ${index + 1}`;
}

function stripHtml(html?: string | null) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function GET(_request: NextRequest) {
  try {
    const drafts = await prisma.emailDraft.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (!drafts.length) {
      return NextResponse.json({ data: [] });
    }

    const suggestions = await prisma.suggestion.findMany({
      where: {
        OR: [
          { id: { in: drafts.map((draft) => draft.sourceId) } },
          { adminNotes: { not: null } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const suggestionById = new Map(suggestions.map((suggestion) => [suggestion.id, suggestion]));
    const suggestionByDraftId = new Map<string, (typeof suggestions)[number]>();
    const suggestionByLinkedEntityId = new Map<string, (typeof suggestions)[number]>();

    for (const suggestion of suggestions) {
      const adminData = parseJsonObject(suggestion.adminNotes);
      const linkedDraftId = String(adminData.linkedDraftId || '').trim();
      const linkedEntityId = String(adminData.linkedEntityId || '').trim();
      if (linkedDraftId) suggestionByDraftId.set(linkedDraftId, suggestion);
      if (linkedEntityId) suggestionByLinkedEntityId.set(linkedEntityId, suggestion);
    }

    const requesterIds = [...new Set(suggestions.map((suggestion) => suggestion.requesterId).filter(Boolean))];
    const requesters = requesterIds.length
      ? await prisma.user.findMany({
          where: { id: { in: requesterIds } },
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

    const requesterMap = new Map(requesters.map((requester) => [requester.id, requester]));

    const data = drafts.map((draft) => {
      const suggestion =
        suggestionByDraftId.get(draft.id) ||
        suggestionById.get(draft.sourceId) ||
        suggestionByLinkedEntityId.get(draft.sourceId) ||
        null;

      const justificationData = parseJsonObject(suggestion?.justification);
      const adminData = parseJsonObject(suggestion?.adminNotes);
      const requester = suggestion ? requesterMap.get(suggestion.requesterId) || null : null;
      const attachments = Array.isArray(justificationData.attachments)
        ? justificationData.attachments.map((item: AttachmentLike, index: number) => simplifyAttachmentName(item, index))
        : [];

      const requestType = mapCategoryLabel(suggestion?.category || draft.sourceType);
      const requestCode = String(adminData.linkedCode || justificationData.publicCode || draft.subject || draft.sourceId);
      const previewSource = String(suggestion?.description || stripHtml(draft.body) || '').trim();

      return {
        id: draft.id,
        subject: draft.subject,
        to: draft.recipient,
        cc: null,
        body: draft.body,
        status: draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.copiedAt || draft.createdAt,
        requestCode,
        requestType,
        requesterName: requester?.fullName || '—',
        requesterEmail: requester?.email || '—',
        requesterMobile: requester?.mobile || '—',
        requesterDepartment: requester?.department || '—',
        requesterJobTitle: requester?.jobTitle || '—',
        location: String(justificationData.location || '—'),
        itemName: String(justificationData.itemName || '—'),
        description: suggestion?.description || '—',
        attachments,
        preview: previewSource.length > 180 ? `${previewSource.slice(0, 180)}...` : previewSource,
      };
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر جلب المراسلات الخارجية' },
      { status: 500 }
    );
  }
}
