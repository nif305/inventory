import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function sanitizeHeader(value?: string | null) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
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

function escapeHtml(value?: string | null) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseAttachmentEntries(value: any) {
  if (!Array.isArray(value)) return [] as Array<{ filename?: string; contentType?: string }>;
  return value
    .map((entry) => ({
      filename: String(entry?.filename || '').trim(),
      contentType: String(entry?.contentType || '').trim(),
    }))
    .filter((entry) => entry.filename || entry.contentType);
}

function simplifyAttachmentLabel(entry: { filename?: string; contentType?: string }, index: number) {
  const filename = String(entry.filename || '').toLowerCase();
  const contentType = String(entry.contentType || '').toLowerCase();
  if (contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(filename)) return `صورة مرفقة ${index + 1}`;
  if (contentType.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(filename)) return `فيديو مرفق ${index + 1}`;
  if (contentType === 'application/pdf' || /\.pdf$/.test(filename)) return `ملف PDF مرفق ${index + 1}`;
  return `ملف مرفق ${index + 1}`;
}

function buildRecipientLabel(category?: string | null, externalRecipient?: string | null) {
  const normalized = String(category || '').toUpperCase();
  if (normalized === 'PURCHASE') return 'سعادة الأستاذ نواف المحارب سلمه الله';
  if (normalized === 'MAINTENANCE' || normalized === 'CLEANING') return 'سعادة مدير الخدمات المساندة سلمه الله';
  return String(externalRecipient || '').trim() ? 'إلى من يهمه الأمر' : 'إلى من يهمه الأمر';
}

function buildExternalEmailHtml(params: {
  recipientLabel: string;
  requestCode: string;
  requestTitle: string;
  createdAt: Date;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  requesterMobile?: string | null;
  requesterExtension?: string | null;
  location?: string;
  itemName?: string;
  description: string;
  requestSource?: string;
  adminNotes?: string;
  attachments?: Array<{ filename?: string; contentType?: string }>;
}) {
  const rows: Array<[string, string]> = [
    ['رقم الطلب', params.requestCode],
    ['نوع الطلب', params.requestTitle],
    ['عنوان الطلب', params.requestTitle],
    ['التاريخ', new Intl.DateTimeFormat('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(params.createdAt))],
    ['مقدم الطلب', params.requesterName || '—'],
    ['الإدارة', params.requesterDepartment || '—'],
    ['البريد الإلكتروني', params.requesterEmail || '—'],
    ['الجوال', params.requesterMobile || '—'],
    ['التحويلة', params.requesterExtension || '—'],
    ['الموقع', params.location || '—'],
    ['العنصر المطلوب', params.itemName || '—'],
    ['سبب الطلب', params.description || '—'],
  ];

  if (params.requestSource) rows.push(['مصدر الحاجة', params.requestSource]);
  if (params.adminNotes) rows.push(['توجيه المدير', params.adminNotes]);
  const attachmentLabels = parseAttachmentEntries(params.attachments).map(simplifyAttachmentLabel);
  if (attachmentLabels.length) rows.push(['المرفقات المرفوعة', attachmentLabels.join('، ')]);

  const tableRows = rows
    .map(([label, value]) => `<tr><td style="padding:10px 12px;border:1px solid #d6d7d4;font-weight:700;background:#f8fbfb;width:180px;">${escapeHtml(label)}</td><td style="padding:10px 12px;border:1px solid #d6d7d4;">${escapeHtml(value)}</td></tr>`)
    .join('');

  return `
  <div dir="rtl" style="font-family:Cairo,Tahoma,Arial,sans-serif;color:#1f2937;line-height:1.9;">
    <div style="font-size:18px;font-weight:700;margin-bottom:12px;">${escapeHtml(params.recipientLabel)}</div>
    <div style="margin-bottom:12px;">السلام عليكم ورحمة الله وبركاته،</div>
    <div style="margin-bottom:12px;">تهديكم إدارة عمليات التدريب أطيب التحيات، ونأمل التكرم بالاطلاع على الطلب الموضحة بياناته أدناه واتخاذ ما يلزم حيال معالجته، مع إمكانية التواصل المباشر مع مقدم الطلب عند الحاجة.</div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${tableRows}</table>
    <div style="margin-top:14px;">نأمل منكم التكرم بتوجيه من يلزم لمعالجة المطلوب، وتقبلوا خالص التحية.</div>
    <div style="margin-top:18px;font-weight:700;">فريق عمل إدارة عمليات التدريب<br/>وكالة الجامعة للتدريب</div>
  </div>`;
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
        },
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const draft = await prisma.emailDraft.findUnique({ where: { id } });
    if (!draft) {
      return NextResponse.json({ error: 'المسودة غير موجودة' }, { status: 404 });
    }

    const suggestion = await findSuggestionByDraftId(id);
    const justification = parseJsonObject(suggestion?.justification);
    const adminData = parseJsonObject(suggestion?.adminNotes);
    const attachments = parseAttachmentEntries(justification.attachments);
    const requester = suggestion?.requester;

    const subject = sanitizeHeader(draft.subject || 'مسودة مراسلة');
    const to = sanitizeHeader(draft.recipient || '');
    const rebuiltHtml = buildExternalEmailHtml({
      recipientLabel: buildRecipientLabel(suggestion?.category || draft.sourceType, justification.externalRecipient),
      requestCode: String(adminData.linkedCode || justification.publicCode || subject || '—'),
      requestTitle: String(suggestion?.title || draft.subject || '—'),
      createdAt: suggestion?.createdAt || draft.createdAt,
      requesterName: requester?.fullName || '—',
      requesterDepartment: requester?.department || '—',
      requesterEmail: requester?.email || '—',
      requesterMobile: requester?.mobile || '—',
      requesterExtension: '—',
      location: String(justification.location || '').trim() || '—',
      itemName: String(justification.itemName || '').trim() || '—',
      description: String(suggestion?.description || '').trim() || '—',
      requestSource: String(justification.requestSource || '').trim() || '',
      adminNotes: String(adminData.adminNotes || '').trim() || '',
      attachments,
    });

    const eml = [
      'X-Unsent: 1',
      `To: ${to}`,
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      rebuiltHtml,
      '',
    ].join('\r\n');

    const filename = `${subject || 'email-draft'}.eml`.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120);

    await prisma.emailDraft.update({
      where: { id: draft.id },
      data: {
        body: rebuiltHtml,
        status: 'COPIED',
        copiedAt: new Date(),
      },
    });

    if (suggestion) {
      await prisma.suggestion.update({
        where: { id: suggestion.id },
        data: {
          status: 'IMPLEMENTED',
          justification: JSON.stringify({
            ...justification,
            attachments: [],
          }),
        },
      });
    }

    return new NextResponse(eml, {
      status: 200,
      headers: {
        'Content-Type': 'message/rfc822; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر تصدير ملف EML' }, { status: 500 });
  }
}
