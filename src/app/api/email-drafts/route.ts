import { NextRequest, NextResponse } from 'next/server';
import { DraftStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function parseJsonObject(value?: string | null) {
  if (!value) return {} as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {} as Record<string, any>;
  }
}

function attachmentLabelFromName(filename: string, index: number) {
  const lower = String(filename || '').toLowerCase();
  if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.bmp|\.svg)$/.test(lower)) return `صورة مرفقة ${index}`;
  if (/(\.mp4|\.mov|\.avi|\.mkv|\.webm)$/.test(lower)) return `فيديو مرفق ${index}`;
  if (/\.pdf$/.test(lower)) return `ملف PDF مرفق ${index}`;
  return `مرفق ${index}`;
}

function simplifyAttachmentNames(html?: string | null) {
  let output = String(html || '');
  const matches = output.match(/[a-z0-9]{8}-[a-z0-9-]{27,}\.[a-z0-9]+/gi) || [];
  const labels = new Map<string, string>();
  let counter = 1;

  for (const match of matches) {
    if (!labels.has(match)) {
      labels.set(match, attachmentLabelFromName(match, counter));
      counter += 1;
    }
  }

  for (const [raw, label] of labels.entries()) {
    output = output.split(raw).join(label);
  }

  return output;
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
        category: true,
        description: true,
        requesterId: true,
        justification: true,
        adminNotes: true,
        createdAt: true,
      },
    });

    const linkedMap = new Map<string, {
      title: string;
      category: string;
      description: string;
      requesterId: string;
      itemName: string;
      location: string;
      createdAt: Date;
    }>();

    const requesterIds = new Set<string>();

    for (const suggestion of suggestions) {
      requesterIds.add(suggestion.requesterId);
      const admin = parseJsonObject(suggestion.adminNotes);
      const justification = parseJsonObject(suggestion.justification);
      const linkedDraftId = String(admin.linkedDraftId || '').trim();
      if (!linkedDraftId) continue;

      linkedMap.set(linkedDraftId, {
        title: suggestion.title,
        category: suggestion.category,
        description: suggestion.description,
        requesterId: suggestion.requesterId,
        itemName: String(justification.itemName || ''),
        location: String(justification.location || ''),
        createdAt: suggestion.createdAt,
      });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: [...requesterIds] } },
      select: {
        id: true,
        fullName: true,
        email: true,
        department: true,
        mobile: true,
        jobTitle: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));

    const data = drafts.map((draft) => {
      const linked = linkedMap.get(draft.id) || null;
      const requester = linked ? userMap.get(linked.requesterId) || null : null;

      return {
        id: draft.id,
        subject: draft.subject,
        to: draft.recipient,
        cc: null,
        body: simplifyAttachmentNames(draft.body),
        status: draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.copiedAt || draft.createdAt,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        requestTitle: linked?.title || draft.subject,
        requestType: linked?.category || draft.sourceType,
        requestDescription: linked?.description || '',
        itemName: linked?.itemName || '',
        location: linked?.location || '',
        requester: requester
          ? {
              fullName: requester.fullName,
              email: requester.email,
              department: requester.department,
              mobile: requester.mobile,
              extension: '',
              jobTitle: requester.jobTitle,
            }
          : null,
      };
    });

    return NextResponse.json({
      data,
      stats: {
        total: data.length,
        drafts: data.filter((row) => row.status === DraftStatus.DRAFT).length,
        copied: data.filter((row) => row.status === DraftStatus.COPIED).length,
        sent: data.filter((row) => row.status === DraftStatus.SENT).length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر جلب المراسلات الخارجية' },
      { status: 500 }
    );
  }
}
