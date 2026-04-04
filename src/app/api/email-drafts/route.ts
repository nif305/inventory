import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CATEGORY_LABELS: Record<string, string> = {
  MAINTENANCE: 'طلب صيانة',
  CLEANING: 'طلب نظافة',
  PURCHASE: 'طلب شراء مباشر',
  OTHER: 'طلب آخر',
};

function parseJsonObject(value?: string | null): Record<string, any> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
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
    .replace(/\s+/g, ' ')
    .trim();
}

function attachmentLabel(name: string, index: number) {
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) return `صورة مرفقة ${index + 1}`;
  if (/\.(mp4|mov|avi|mkv|webm|m4v)$/.test(lower)) return `فيديو مرفق ${index + 1}`;
  if (/\.pdf$/.test(lower)) return `ملف PDF مرفق ${index + 1}`;
  return `ملف مرفق ${index + 1}`;
}

function simplifyAttachments(raw: any): string[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item, index) => {
    const filename = typeof item === 'string'
      ? item
      : String(item?.fileName || item?.name || item?.url || item?.path || `file-${index + 1}`);
    return attachmentLabel(filename, index);
  });
}

export async function GET(_request: NextRequest) {
  try {
    const [drafts, suggestions, users] = await Promise.all([
      prisma.emailDraft.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.suggestion.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          requesterId: true,
          createdAt: true,
          updatedAt: true,
          justification: true,
          adminNotes: true,
        },
      }),
      prisma.user.findMany({
        select: {
          id: true,
          fullName: true,
          email: true,
          mobile: true,
          department: true,
          jobTitle: true,
        },
      }),
    ]);

    const usersMap = new Map(users.map((user) => [user.id, user]));

    const rows = drafts.map((draft) => {
      const linkedSuggestion = suggestions.find((suggestion) => {
        const admin = parseJsonObject(suggestion.adminNotes);
        return (
          admin.linkedDraftId === draft.id ||
          suggestion.id === draft.sourceId ||
          admin.linkedEntityId === draft.sourceId
        );
      });

      const justification = parseJsonObject(linkedSuggestion?.justification);
      const admin = parseJsonObject(linkedSuggestion?.adminNotes);
      const requester = linkedSuggestion ? usersMap.get(linkedSuggestion.requesterId) : null;
      const category = String(linkedSuggestion?.category || '').toUpperCase();
      const snippet = stripHtml(linkedSuggestion?.description || draft.body).slice(0, 180);

      return {
        id: draft.id,
        subject: draft.subject,
        to: draft.recipient,
        body: draft.body,
        status: draft.status,
        createdAt: draft.createdAt,
        copiedAt: draft.copiedAt,
        requestCode: String(admin.linkedCode || justification.publicCode || linkedSuggestion?.id || draft.sourceId),
        requestType: CATEGORY_LABELS[category] || 'مراسلة خارجية',
        requesterName: requester?.fullName || '—',
        requesterEmail: requester?.email || '—',
        requesterMobile: requester?.mobile || '—',
        requesterDepartment: requester?.department || '—',
        requesterJobTitle: requester?.jobTitle || '—',
        location: String(justification.location || '—'),
        itemName: String(justification.itemName || '—'),
        description: linkedSuggestion?.description || snippet || '—',
        attachments: simplifyAttachments(justification.attachments),
      };
    });

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر جلب المراسلات الخارجية' },
      { status: 500 }
    );
  }
}
