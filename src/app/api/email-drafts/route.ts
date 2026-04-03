import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type DraftStatus = 'DRAFT' | 'COPIED' | 'SENT';

type AttachmentEntry = {
  filename?: string;
  contentType?: string;
};

function normalizeCategoryLabel(sourceType?: string | null) {
  const value = String(sourceType || '').toLowerCase();
  if (value === 'maintenance') return 'طلب صيانة';
  if (value === 'cleaning') return 'طلب نظافة';
  if (value === 'purchase') return 'شراء مباشر';
  return 'طلبات أخرى';
}

function parseJsonObject(value?: string | null) {
  if (!value) return {} as Record<string, any>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {} as Record<string, any>;
  }
}

function normalizeArabic(value: string) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/\s+/g, ' ');
}

function parseAttachmentEntries(value: any): AttachmentEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      filename: String(entry?.filename || '').trim(),
      contentType: String(entry?.contentType || '').trim(),
    }))
    .filter((entry) => entry.filename || entry.contentType);
}

function simplifyAttachmentLabel(entry: AttachmentEntry, index: number) {
  const filename = String(entry.filename || '').toLowerCase();
  const contentType = String(entry.contentType || '').toLowerCase();
  if (contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(filename)) return `صورة مرفقة ${index + 1}`;
  if (contentType.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(filename)) return `فيديو مرفق ${index + 1}`;
  if (contentType === 'application/pdf' || /\.pdf$/.test(filename)) return `ملف PDF مرفق ${index + 1}`;
  return `ملف مرفق ${index + 1}`;
}

function extractPlainText(html?: string | null) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findSuggestionByDraftId(draftId: string) {
  return prisma.suggestion.findFirst({
    where: { adminNotes: { contains: draftId } },
    include: {
      requester: {
        select: {
          id: true,
          fullName: true,
          department: true,
          email: true,
          mobile: true,
          jobTitle: true,
        },
      },
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const q = normalizeArabic(request.nextUrl.searchParams.get('q') || '');
    const drafts = await prisma.emailDraft.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const rows = await Promise.all(
      drafts.map(async (draft) => {
        const suggestion = await findSuggestionByDraftId(draft.id);
        const justification = parseJsonObject(suggestion?.justification);
        const adminNotes = parseJsonObject(suggestion?.adminNotes);
        const attachments = parseAttachmentEntries(justification.attachments);
        const attachmentLabels = attachments.map(simplifyAttachmentLabel);
        const requester = suggestion?.requester;
        const description = String(suggestion?.description || '').trim();
        const requestCode = String(adminNotes.linkedCode || justification.publicCode || draft.subject || '').trim();

        return {
          id: draft.id,
          subject: draft.subject,
          to: draft.recipient,
          cc: null,
          body: draft.body,
          status: draft.status as DraftStatus,
          createdAt: draft.createdAt,
          copiedAt: draft.copiedAt,
          typeLabel: suggestion ? normalizeCategoryLabel(suggestion.category) : normalizeCategoryLabel(draft.sourceType),
          requestCode: requestCode || '—',
          requesterName: requester?.fullName || '—',
          requesterDepartment: requester?.department || '—',
          requesterEmail: requester?.email || '—',
          requesterMobile: requester?.mobile || '—',
          requesterExtension: '—',
          location: String(justification.location || '').trim() || '—',
          itemName: String(justification.itemName || '').trim() || '—',
          description: description || extractPlainText(draft.body),
          attachmentLabels,
        };
      })
    );

    const filtered = q
      ? rows.filter((row) =>
          normalizeArabic(
            [
              row.subject,
              row.to,
              row.requestCode,
              row.typeLabel,
              row.requesterName,
              row.requesterDepartment,
              row.description,
              row.itemName,
              row.location,
              row.attachmentLabels.join(' '),
            ]
              .filter(Boolean)
              .join(' ')
          ).includes(q)
        )
      : rows;

    return NextResponse.json({ data: filtered });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر جلب المراسلات الخارجية' }, { status: 500 });
  }
}
