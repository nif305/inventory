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
      contentType: String(item.contentType || '').trim() || 'application/octet-stream',
      base64Content: String(item.base64Content || '').replace(/\s+/g, ''),
    }))
    .filter((item) => item.base64Content);
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

function recipientLabel(category?: string | null) {
  const normalized = String(category || '').toUpperCase();
  if (normalized === 'MAINTENANCE' || normalized === 'CLEANING') return 'سعادة مدير إدارة الخدمات المساندة سلمه الله';
  if (normalized === 'PURCHASE') return 'سعادة الأستاذ نواف المحارب سلمه الله';
  return 'إلى من يهمه الأمر';
}

function escapeHtml(value?: string | null) {
  return String(value || '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeHeader(value?: string | null) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function stripHtmlToText(html?: string | null) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

function safeAttachmentFilename(file: AttachmentPayload, index: number) {
  const original = String(file.filename || '').trim();
  const extMatch = original.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
  const type = String(file.contentType || '').toLowerCase();
  let base = `attachment-${index + 1}`;
  if (type.startsWith('image/')) base = `image-${index + 1}`;
  else if (type.startsWith('video/')) base = `video-${index + 1}`;
  else if (type.includes('pdf')) base = `pdf-${index + 1}`;
  return `${base}${ext}`;
}

function buildHtml(params: {
  toLabel: string;
  requestCode: string;
  requestTitle: string;
  categoryLabel: string;
  createdAt: Date | string;
  requesterName: string;
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
    <div style="font-size:20px;font-weight:800;margin-bottom:10px;">${escapeHtml(params.toLabel)}</div>
    <div style="margin-bottom:10px;">السلام عليكم ورحمة الله وبركاته،</div>
    <div style="margin-bottom:10px;">تحية طيبة وبعد،</div>
    <div style="margin-bottom:14px;">نفيد سعادتكم بأن الموظف <strong>${escapeHtml(params.requesterName || 'مقدم الطلب')}</strong> من <strong>إدارة عمليات التدريب</strong> رفع ${escapeHtml(params.categoryLabel)}، ونأمل من سعادتكم التكرم بالاطلاع على التفاصيل الموضحة أدناه واتخاذ ما يلزم حيال المعالجة في أقرب وقت ممكن.</div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${tableRows}</table>
    ${params.attachments.length ? `<div style="margin-top:10px;">مرفق مع هذه الرسالة ${escapeHtml(params.attachments.join('، '))}.</div>` : ''}
    <div style="margin-top:16px;">وتفضلوا بقبول خالص التحية والتقدير.</div>
    <div style="margin-top:18px;font-weight:700;">فريق عمل إدارة عمليات التدريب<br/>وكالة الجامعة للتدريب</div>
  </div>`;
}

function buildDraftEml(params: {
  to: string;
  subject: string;
  htmlBody: string;
  attachments: AttachmentPayload[];
}) {
  const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const plainBody = stripHtmlToText(params.htmlBody);

  const lines: string[] = [
    `To: ${sanitizeHeader(params.to)}`,
    `Subject: ${sanitizeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    'X-Unsent: 1',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    plainBody,
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.htmlBody,
    '',
    `--${altBoundary}--`,
    '',
  ];

  params.attachments.forEach((file, index) => {
    const filename = safeAttachmentFilename(file, index);
    lines.push(
      `--${mixedBoundary}`,
      `Content-Type: ${sanitizeHeader(file.contentType || 'application/octet-stream')}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      String(file.base64Content || '').replace(/\s+/g, ''),
      ''
    );
  });

  lines.push(`--${mixedBoundary}--`, '');
  return lines.join('\r\n');
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const draft = await prisma.emailDraft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'المراسلة غير موجودة' }, { status: 404 });

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
    const suggestion = findRelatedSuggestion(draft, suggestions);
    const justification = parseJsonObject(suggestion?.justification);
    const admin = parseJsonObject(suggestion?.adminNotes);
    const requester = suggestion?.requesterId
      ? await prisma.user.findUnique({ where: { id: suggestion.requesterId }, select: { fullName: true, email: true, phone: true, position: true } })
      : null;

    const attachmentPayloads = normalizeAttachments(justification.attachments);
    const attachmentLabels = attachmentPayloads.map(attachmentDisplayName);
    const requestCode = String(admin.linkedCode || justification.publicCode || draft.sourceId || draft.id);
    const typeLabel = categoryLabel(suggestion?.category || draft.sourceType);
    const htmlBody = buildHtml({
      toLabel: recipientLabel(suggestion?.category || draft.sourceType),
      requestCode,
      requestTitle: suggestion?.title || draft.subject,
      categoryLabel: typeLabel,
      createdAt: suggestion?.createdAt || draft.createdAt,
      requesterName: requester?.fullName || '—',
      requesterEmail: requester?.email || '—',
      requesterMobile: requester?.phone || '—',
      requesterJobTitle: requester?.position || '—',
      location: String(justification.location || '—'),
      itemName: String(justification.itemName || suggestion?.title || '—'),
      description: String(suggestion?.description || '—'),
      adminNotes: String(admin.adminNotes || '').trim(),
      attachments: attachmentLabels,
    });

    const eml = buildDraftEml({
      to: draft.recipient,
      subject: `${typeLabel} - ${requestCode}`,
      htmlBody,
      attachments: attachmentPayloads,
    });

    await prisma.emailDraft.update({
      where: { id: draft.id },
      data: { status: 'COPIED', copiedAt: new Date(), body: htmlBody },
    });

    const filename = `${String(requestCode || 'draft').replace(/[^a-zA-Z0-9._-]+/g, '-')}.eml`;
    const bytes = new TextEncoder().encode(eml);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'message/rfc822',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر تنزيل ملف المراسلة' }, { status: 500 });
  }
}
