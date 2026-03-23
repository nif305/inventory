import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPPORT_SERVICES_TO = ['ssd@nauss.edu.sa', 'AAlosaimi@nauss.edu.sa'];
const FINANCE_TO = ['finance@nauss.edu.sa', 'aalaraj@nauss.edu.sa', 'YAlqaoud@nauss.edu.sa', 'Procurement@nauss.edu.sa'];

type EmailAttachment = {
  filename: string;
  contentType?: string | null;
  base64Content: string;
};

function formatDateTime(value: Date) {
  const date = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Riyadh',
  }).format(value);

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Riyadh',
  }).format(value);

  return { date, time };
}

function escapeHtml(value?: string | null) {
  return String(value || '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeHeader(value?: string | null) {
  return String(value || '').replace(/\r/g, ' ').replace(/\n/g, ' ').trim();
}

function normalizeEmailList(value: string | string[] | null | undefined) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

function buildArabicIntro(requestTypeLabel: string) {
  return [
    'السلام عليكم ورحمة الله وبركاته،',
    '',
    `نفيد سعادتكم بورود ${requestTypeLabel} من خلال منصة مواد التدريب بوكالة التدريب، ونأمل التكرم بالاطلاع واتخاذ ما يلزم وفق البيانات الموضحة أدناه.`,
    '',
    'وتفضلوا بقبول فائق الاحترام والتقدير،',
    'وكالة التدريب',
  ].join('\n');
}

function buildDetailsTable(rows: Array<[string, string]>) {
  return `
<table dir="rtl" style="border-collapse:collapse;width:100%;font-family:Tahoma,Arial,sans-serif;font-size:14px">
  <tbody>
    ${rows
      .map(
        ([label, value]) => `
      <tr>
        <td style="border:1px solid #d6d7d4;background:#f8f9f9;padding:8px;font-weight:bold;width:180px">${escapeHtml(label)}</td>
        <td style="border:1px solid #d6d7d4;padding:8px">${escapeHtml(value)}</td>
      </tr>`
      )
      .join('')}
  </tbody>
</table>
  `.trim();
}

function buildMultipartEml(params: {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}) {
  const safeSubject = sanitizeHeader(params.subject);
  const safeTo = params.to.map(sanitizeHeader).filter(Boolean);
  const safeCc = (params.cc || []).map(sanitizeHeader).filter(Boolean);
  const attachments = (params.attachments || []).filter(
    (item) => item.filename && item.base64Content
  );

  if (!attachments.length) {
    const headers = [
      `To: ${safeTo.join(', ')}`,
      safeCc.length ? `Cc: ${safeCc.join(', ')}` : '',
      `Subject: ${safeSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      params.html,
    ].filter(Boolean);

    return headers.join('\r\n');
  }

  const boundary = `----=_NextPart_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const headers = [
    `To: ${safeTo.join(', ')}`,
    safeCc.length ? `Cc: ${safeCc.join(', ')}` : '',
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
  ].filter(Boolean);

  const bodyParts = [
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.html,
    '',
  ];

  for (const attachment of attachments) {
    bodyParts.push(
      `--${boundary}`,
      `Content-Type: ${sanitizeHeader(attachment.contentType || 'application/octet-stream')}; name="${sanitizeHeader(attachment.filename)}"`,
      `Content-Disposition: attachment; filename="${sanitizeHeader(attachment.filename)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      attachment.base64Content.replace(/\s+/g, ''),
      ''
    );
  }

  bodyParts.push(`--${boundary}--`, '');

  return `${headers.join('\r\n')}\r\n${bodyParts.join('\r\n')}`;
}

export const EmailTemplateService = {
  async createSuggestionDraft(params: {
    suggestionId: string;
    requestType: 'MAINTENANCE' | 'CLEANING' | 'PURCHASE' | 'OTHER';
    code: string;
    requesterEmail?: string | null;
    requesterName?: string | null;
    requesterDepartment?: string | null;
    createdAt: Date;
    sourcePurpose: string;
    areaLabel: string;
    note: string;
    adminNotes?: string | null;
    customRecipients?: string[];
    attachments?: EmailAttachment[];
  }) {
    const to =
      params.requestType === 'PURCHASE'
        ? FINANCE_TO
        : params.requestType === 'OTHER'
        ? normalizeEmailList(params.customRecipients || [])
        : SUPPORT_SERVICES_TO;

    const cc = normalizeEmailList(params.requesterEmail || '');
    const typeLabel =
      params.requestType === 'MAINTENANCE'
        ? 'طلب صيانة'
        : params.requestType === 'CLEANING'
        ? 'طلب نظافة'
        : params.requestType === 'PURCHASE'
        ? 'طلب شراء مباشر'
        : 'طلب آخر';

    const { date, time } = formatDateTime(params.createdAt);
    const subject = `${typeLabel} - رقم الطلب ${params.code}`;

    const intro = buildArabicIntro(typeLabel);
    const table = buildDetailsTable([
      ['رقم الطلب', params.code],
      ['تاريخ الطلب', date],
      ['وقت الطلب', time],
      ['نوع الطلب', typeLabel],
      ['مصدر الحاجة', params.sourcePurpose],
      ['الجزء / العنصر', params.areaLabel],
      ['وصف الملاحظة', params.note],
      ['مقدم الطلب', params.requesterName || '—'],
      ['إدارة مقدم الطلب', params.requesterDepartment || '—'],
      ['ملاحظة المدير', params.adminNotes || '—'],
    ]);

    const html = `
<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#152625">
  <p style="white-space:pre-line;margin:0 0 16px 0">${escapeHtml(intro)}</p>
  ${table}
</div>
    `.trim();

    const emlContent = buildMultipartEml({
      to,
      cc,
      subject,
      html,
      attachments: params.attachments,
    });

    return prisma.emailDraft.create({
      data: {
        sourceType: 'suggestion',
        sourceId: params.suggestionId,
        recipient: to.join(', '),
        subject,
        body: html,
        status: 'DRAFT',
      },
    }).then((draft) => ({
      ...draft,
      to,
      cc,
      emlContent,
      filename: `${params.code}.eml`,
    }));
  },
};
