import { NextRequest, NextResponse } from 'next/server';
import { SuggestionStatus } from '@prisma/client';
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

function sanitizeHeader(value?: string | null) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function stripHtmlToText(html?: string | null) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function foldBase64(value: string) {
  return String(value || '').replace(/(.{76})/g, '$1\r\n');
}

function attachmentFilename(file: any, index: number) {
  const original = sanitizeHeader(file?.filename || file?.name || '');
  if (original) {
    const safe = original.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (safe) return safe;
  }
  const type = String(file?.contentType || file?.type || '').toLowerCase();
  if (type.startsWith('image/')) return `attachment-${index + 1}.png`;
  if (type.startsWith('video/')) return `attachment-${index + 1}.mp4`;
  if (type.includes('pdf')) return `attachment-${index + 1}.pdf`;
  return `attachment-${index + 1}`;
}

function buildAsciiFilename(requestCode: string) {
  const safeBase = sanitizeHeader(`${requestCode || 'request'}-draft`)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return `${safeBase || 'email-draft'}.eml`;
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

function buildFallbackHtml(params: {
  requestCode: string;
  requestType: string;
  createdAt: Date;
  requester: RequesterInfo | null;
  location: string;
  itemName: string;
  description: string;
}) {
  const rows = [
    ['رقم الطلب', params.requestCode],
    ['نوع الطلب', params.requestType],
    ['التاريخ', new Intl.DateTimeFormat('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(params.createdAt))],
    ['مقدم الطلب', params.requester?.fullName || '—'],
    ['الإدارة', 'إدارة عمليات التدريب'],
    ['البريد الإلكتروني', params.requester?.email || '—'],
    ['الجوال', params.requester?.mobile || '—'],
    ['الصفة الوظيفية', params.requester?.jobTitle || '—'],
    ['الموقع', params.location || '—'],
    ['العنصر المطلوب', params.itemName || '—'],
    ['سبب الطلب', params.description || '—'],
  ];
  const tableRows = rows.map(([label, value]) => `<tr><td style="padding:10px 12px;border:1px solid #d6d7d4;font-weight:700;background:#f8fbfb;width:180px;">${label}</td><td style="padding:10px 12px;border:1px solid #d6d7d4;">${value}</td></tr>`).join('');
  return `
  <div dir="rtl" style="font-family:Cairo,Tahoma,Arial,sans-serif;color:#1f2937;line-height:2;">
    <div style="font-size:18px;font-weight:700;margin-bottom:12px;">سعادة الجهة المختصة سلمه الله</div>
    <div style="margin-bottom:12px;">السلام عليكم ورحمة الله وبركاته،</div>
    <div style="margin-bottom:12px;">نفيد سعادتكم بأن الموظف <strong>${params.requester?.fullName || 'مقدم الطلب'}</strong> من <strong>إدارة عمليات التدريب</strong> رفع ${params.requestType}، ونأمل من سعادتكم التكرم بالاطلاع على التفاصيل الآتية واتخاذ ما يلزم حيال المعالجة في أقرب وقت ممكن.</div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${tableRows}</table>
    <div style="margin-top:14px;">وتفضلوا بقبول خالص التحية والتقدير.</div>
    <div style="margin-top:18px;font-weight:700;">فريق عمل إدارة عمليات التدريب<br/>وكالة الجامعة للتدريب</div>
  </div>`;
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
        status: true,
      },
    });

    const suggestion = suggestions.find((item) => {
      const adminData = parseJsonObject(item.adminNotes);
      return String(adminData.linkedDraftId || '').trim() === String(draft.id) || String(item.id) === String(draft.sourceId);
    }) || null;

    const requester = suggestion?.requesterId
      ? await prisma.user.findUnique({
          where: { id: suggestion.requesterId },
          select: {
            fullName: true,
            email: true,
            mobile: true,
            department: true,
            jobTitle: true,
          },
        })
      : null;

    const justification = parseJsonObject(suggestion?.justification);
    const adminData = parseJsonObject(suggestion?.adminNotes);
    const requestCode =
      sanitizeHeader(String(adminData.linkedCode || '')) ||
      sanitizeHeader(String(justification.publicCode || '')) ||
      sanitizeHeader(String(suggestion?.id || '')) ||
      sanitizeHeader(String(draft.sourceId || '')) ||
      sanitizeHeader(String(draft.id));

    const requestType = requestTypeLabel(suggestion?.category, draft.sourceType);
    const htmlBody = String(draft.body || '').trim() || buildFallbackHtml({
      requestCode,
      requestType,
      createdAt: suggestion?.createdAt || draft.createdAt,
      requester,
      location: String(justification.location || justification.area || ''),
      itemName: String(justification.itemName || justification.items || ''),
      description: String(suggestion?.description || justification.description || justification.reason || ''),
    });
    const textBody = stripHtmlToText(htmlBody);
    const to = sanitizeHeader(draft.recipient || '');
    const subject = sanitizeHeader(draft.subject || `${requestType} - ${requestCode}`);

    const boundaryMixed = `mixed_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const boundaryAlt = `alt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const attachments = Array.isArray(justification.attachments) ? justification.attachments : [];

    const parts: string[] = [
      `To: ${to}`,
      'MIME-Version: 1.0',
      'X-Unsent: 1',
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`,
      '',
      `--${boundaryMixed}`,
      `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
      '',
      `--${boundaryAlt}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      textBody,
      '',
      `--${boundaryAlt}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      htmlBody,
      '',
      `--${boundaryAlt}--`,
    ];

    attachments.forEach((file: any, index: number) => {
      const base64Content = String(file?.base64Content || '').trim();
      if (!base64Content) return;
      const contentType = sanitizeHeader(file?.contentType || file?.type || 'application/octet-stream');
      const filename = attachmentFilename(file, index);
      parts.push(
        '',
        `--${boundaryMixed}`,
        `Content-Type: ${contentType}; name="${filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${filename}"`,
        '',
        foldBase64(base64Content)
      );
    });

    parts.push('', `--${boundaryMixed}--`, '');
    const eml = parts.join('\r\n');
    const body = new TextEncoder().encode(eml);
    const filename = buildAsciiFilename(requestCode);

    await prisma.emailDraft.update({
      where: { id: draft.id },
      data: { status: 'COPIED', copiedAt: new Date() },
    });

    if (suggestion && suggestion.status !== SuggestionStatus.IMPLEMENTED) {
      await prisma.suggestion.update({
        where: { id: suggestion.id },
        data: { status: SuggestionStatus.IMPLEMENTED },
      });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'message/rfc822',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر تنزيل ملف المراسلة حاليًا' }, { status: 500 });
  }
}
