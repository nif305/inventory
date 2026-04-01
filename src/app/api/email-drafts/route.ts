import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function sanitizeHeader(value?: string | null) {
  return String(value || '').replace(//g, ' ').replace(/
/g, ' ').trim();
}

function htmlToPlainText(html: string) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?\>/gi, '
')
    .replace(/<\/tr>/gi, '
')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+
/g, '
')
    .replace(/
\s+/g, '
')
    .replace(/
{3,}/g, '

')
    .trim();
}

function buildDraftEml(params: { from: string; to: string; subject: string; htmlBody: string }) {
  const boundary = `----=_Alt_${Date.now()}`;
  const plainText = htmlToPlainText(params.htmlBody || '');
  return [
    'X-Unsent: 1',
    `From: ${sanitizeHeader(params.from)}`,
    `To: ${sanitizeHeader(params.to)}`,
    `Subject: ${sanitizeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    plainText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.htmlBody || '<div>—</div>',
    '',
    `--${boundary}--`,
    '',
  ].join('
');
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const draft = await prisma.emailDraft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'مسودة البريد غير موجودة' }, { status: 404 });

    const eml = buildDraftEml({
      from: 'nalshahrani@nauss.edu.sa',
      to: draft.recipient,
      subject: draft.subject,
      htmlBody: draft.body || '<div>—</div>',
    });
    const safeName = sanitizeHeader(draft.subject || `draft-${draft.id}`).replace(/[\/:*?"<>|]+/g, '-').trim();
    return new NextResponse(eml, {
      status: 200,
      headers: {
        'Content-Type': 'message/rfc822; charset=UTF-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}.eml`)}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر تنزيل ملف المراسلة حاليًا' }, { status: 500 });
  }
}
