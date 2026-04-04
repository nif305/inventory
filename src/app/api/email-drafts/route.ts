import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function parseJsonObject(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

type AttachmentPayload = {
  filename?: string;
  contentType?: string;
  base64Content?: string;
};

function normalizeAttachments(input: any): AttachmentPayload[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      filename: String(item.filename || '').trim(),
      contentType: String(item.contentType || '').trim(),
      base64Content: String(item.base64Content || '').trim(),
    }))
    .filter((item) => item.filename || item.base64Content);
}

function attachmentDisplayName(file: AttachmentPayload, index: number) {
  const type = String(file.contentType || '').toLowerCase();
  const name = String(file.filename || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name)) return `صورة مرفقة ${index + 1}`;
  if (type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(name)) return `فيديو مرفق ${index + 1}`;
  if (type.includes('pdf') || /\.pdf$/i.test(name)) return `ملف PDF مرفق ${index + 1}`;
  return `مرفق ${index + 1}`;
}

function categoryLabel(category?: string | null) {
  switch (String(category || '').toUpperCase()) {
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

function buildRecipientLabel(category?: string | null) {
  const normalized = String(category || '').toUpperCase();
  if (normalized === 'MAINTENANCE' || normalized === 'CLEANING') {
    return 'سعادة مدير إدارة الخدمات المساندة سلمه الله';
  }
  if (normalized === 'PURCHASE') {
    return 'سعادة الأستاذ نواف المحارب سلمه الله';
  }
  return 'إلى من يهمه الأمر';
}

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function escapeHtml(value?: string | null) {
  return String(value || '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(params: {
  recipientLabel: string;
  requestCode: string;
  requestTitle: string;
  categoryLabel: string;
  createdAt: Date | string;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  requesterMobile: string;
  requesterJobTitle: string;
  location: string;
  itemName: string;
  description: string;
  adminNotes?: string;
  attachments: string[];
}) {
  const rows: Array<[string, string]> = [
    ['رقم الطلب', params.requestCode],
    ['نوع الطلب', params.categoryLabel],
    ['عنوان الطلب', params.requestTitle],
    ['التاريخ', formatDate(params.createdAt)],
    ['مقدم الطلب', params.requesterName || '—'],
    ['الإدارة', 'إدارة عمليات التدريب'],
    ['البريد الإلكتروني', params.requesterEmail || '—'],
    ['الجوال', params.requesterMobile || '—'],
    ['الصفة الوظيفية', params.requesterJobTitle || '—'],
    ['الموقع', params.location || '—'],
    ['العنصر المطلوب', params.itemName || '—'],
    ['سبب الطلب', params.description || '—'],
  ];

  if (params.adminNotes) rows.push(['توجيه المدير', params.adminNotes]);
  if (params.attachments.length) rows.push(['المرفقات المرفوعة', params.attachments.join('، ')]);

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 12px;border:1px solid #d6d7d4;font-weight:700;background:#f8fbfb;width:190px;">${escapeHtml(label)}</td><td style="padding:10px 12px;border:1px solid #d6d7d4;">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  return `
  <div dir="rtl" style="font-family:Cairo,Tahoma,Arial,sans-serif;color:#152625;line-height:2;">
    <div style="font-size:20px;font-weight:800;margin-bottom:10px;">${escapeHtml(params.recipientLabel)}</div>
    <div style="margin-bottom:10px;">السلام عليكم ورحمة الله وبركاته،</div>
    <div style="margin-bottom:10px;">تحية طيبة وبعد،</div>
    <div style="margin-bottom:14px;">نفيد سعادتكم بأن الموظف <strong>${escapeHtml(params.requesterName || 'مقدم الطلب')}</strong> من <strong>إدارة عمليات التدريب</strong> رفع ${escapeHtml(params.categoryLabel)}، ونأمل من سعادتكم التكرم بالاطلاع على التفاصيل الموضحة أدناه واتخاذ ما يلزم حيال المعالجة في أقرب وقت ممكن.</div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${tableRows}</table>
    ${params.attachments.length ? `<div style="margin-top:10px;">مرفق مع هذه المسودة ${escapeHtml(params.attachments.join('، '))}.</div>` : ''}
    <div style="margin-top:16px;">وتفضلوا بقبول خالص التحية والتقدير.</div>
    <div style="margin-top:18px;font-weight:700;">فريق عمل إدارة عمليات التدريب<br/>وكالة الجامعة للتدريب</div>
  </div>`;
}

function findRelatedSuggestion(draft: any, suggestions: any[]) {
  return (
    suggestions.find((item) => item.id === draft.sourceId) ||
    suggestions.find((item) => {
      const admin = parseJsonObject(item.adminNotes);
      return admin.linkedDraftId === draft.id || admin.linkedEntityId === draft.sourceId;
    }) ||
    null
  );
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
      select: {
        id: true,
        title: true,
        description: true,
        justification: true,
        adminNotes: true,
        category: true,
        requesterId: true,
        createdAt: true,
        status: true,
      },
    });

    const requesterIds = Array.from(new Set(suggestions.map((item) => item.requesterId).filter(Boolean)));
    const users = requesterIds.length
      ? await prisma.user.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, fullName: true, department: true, email: true, phone: true, position: true },
        })
      : [];
    const requesterMap = new Map(users.map((user) => [user.id, user]));

    const rows = drafts.map((draft) => {
      const suggestion = findRelatedSuggestion(draft, suggestions);
      const justification = parseJsonObject(suggestion?.justification);
      const admin = parseJsonObject(suggestion?.adminNotes);
      const requester = suggestion ? requesterMap.get(suggestion.requesterId) : null;
      const attachments = normalizeAttachments(justification.attachments);
      const attachmentLabels = attachments.map(attachmentDisplayName);
      const requestCode = String(admin.linkedCode || justification.publicCode || draft.sourceId || draft.id);
      const requestTypeLabel = categoryLabel(suggestion?.category || draft.sourceType);
      const body = buildEmailHtml({
        recipientLabel: buildRecipientLabel(suggestion?.category || draft.sourceType),
        requestCode,
        requestTitle: suggestion?.title || draft.subject,
        categoryLabel: requestTypeLabel,
        createdAt: suggestion?.createdAt || draft.createdAt,
        requesterName: requester?.fullName || '—',
        requesterDepartment: 'إدارة عمليات التدريب',
        requesterEmail: requester?.email || '—',
        requesterMobile: requester?.phone || '—',
        requesterJobTitle: requester?.position || '—',
        location: String(justification.location || '—'),
        itemName: String(justification.itemName || suggestion?.title || '—'),
        description: String(suggestion?.description || '—'),
        adminNotes: String(admin.adminNotes || '').trim(),
        attachments: attachmentLabels,
      });

      return {
        id: draft.id,
        subject: draft.subject,
        to: draft.recipient,
        status: draft.status,
        createdAt: draft.createdAt,
        copiedAt: draft.copiedAt,
        requestCode,
        requestTypeLabel,
        requesterName: requester?.fullName || '—',
        requesterDepartment: 'إدارة عمليات التدريب',
        requesterEmail: requester?.email || '—',
        requesterMobile: requester?.phone || '—',
        requesterJobTitle: requester?.position || '—',
        location: String(justification.location || '—'),
        itemName: String(justification.itemName || suggestion?.title || '—'),
        description: String(suggestion?.description || '—'),
        attachments: attachmentLabels,
        body,
      };
    });

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر جلب المراسلات الخارجية' }, { status: 500 });
  }
}
