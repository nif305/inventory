import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function tryParseJson(value?: string | null) {
  if (!value) return {} as Record<string, any>;
  try {
    return JSON.parse(value);
  } catch {
    return {} as Record<string, any>;
  }
}

function normalizeAttachmentLabel(name: string, index: number) {
  const lower = String(name || '').toLowerCase();
  if (/(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) return `صورة مرفقة ${index + 1}`;
  if (/(mp4|mov|avi|mkv|webm)$/.test(lower)) return `فيديو مرفق ${index + 1}`;
  if (/pdf$/.test(lower)) return `ملف PDF مرفق ${index + 1}`;
  return `ملف مرفق ${index + 1}`;
}

export async function GET(_request: NextRequest) {
  try {
    const drafts = await prisma.emailDraft.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const sourceIds = [...new Set(drafts.map((d) => d.sourceId).filter(Boolean))];
    const suggestions = sourceIds.length
      ? await prisma.suggestion.findMany({
          where: { OR: [{ id: { in: sourceIds } }, { id: { in: [] } }] },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const suggestionMap = new Map(suggestions.map((s) => [s.id, s]));
    const requesterIds = [...new Set(suggestions.map((s) => s.requesterId).filter(Boolean))];
    const users = requesterIds.length
      ? await prisma.user.findMany({
          where: { id: { in: requesterIds } },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = drafts.map((draft) => {
      const suggestion = suggestionMap.get(draft.sourceId);
      const adminData = tryParseJson(suggestion?.adminNotes);
      const requester = suggestion ? userMap.get(suggestion.requesterId) : null;

      const rawAttachments = Array.isArray(adminData.attachments) ? adminData.attachments : [];
      const attachments = rawAttachments.map((item: any, index: number) => {
        const rawName = typeof item === 'string' ? item : item?.name || item?.fileName || item?.url || '';
        return normalizeAttachmentLabel(rawName, index);
      });

      return {
        id: draft.id,
        subject: draft.subject,
        to: draft.recipient,
        cc: null,
        body: draft.body,
        status: draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.copiedAt || draft.createdAt,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        suggestionId: suggestion?.id || null,
        requestCode: adminData.linkedCode || adminData.publicCode || suggestion?.id || draft.sourceId,
        requestType: suggestion?.category || draft.sourceType,
        requesterName: requester?.fullName || '—',
        requesterEmail: requester?.email || '—',
        requesterMobile: requester?.mobile || '—',
        requesterDepartment: requester?.department || '—',
        location: adminData.location || '—',
        itemName: adminData.itemName || '—',
        description: suggestion?.description || '—',
        attachments,
        createdBy: requester
          ? {
              fullName: requester.fullName,
            }
          : null,
      };
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر تحميل المراسلات الخارجية' }, { status: 500 });
  }
}
