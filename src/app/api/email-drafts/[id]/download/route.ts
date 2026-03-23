import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function sanitizeHeader(value?: string | null) {
  return String(value || '').replace(/\r/g, ' ').replace(/\n/g, ' ').trim();
}

function buildEml(params: {
  to: string;
  subject: string;
  htmlBody: string;
}) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const to = sanitizeHeader(params.to);
  const subject = sanitizeHeader(params.subject);
  const htmlBody = params.htmlBody || '<div dir="rtl">—</div>';

  return [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    'يرجى فتح هذه الرسالة في عميل بريد يدعم HTML.',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const draft = await prisma.emailDraft.findUnique({
      where: { id },
    });

    if (!draft) {
      return NextResponse.json({ error: 'مسودة البريد غير موجودة' }, { status: 404 });
    }

    const eml = buildEml({
      to: draft.recipient,
      subject: draft.subject,
      htmlBody: draft.body || '<div dir="rtl">—</div>',
    });

    const safeName = sanitizeHeader(draft.subject || `draft-${draft.id}`)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    return new NextResponse(eml, {
      status: 200,
      headers: {
        'Content-Type': 'message/rfc822; charset=UTF-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}.eml`)}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر تنزيل ملف المراسلة حاليًا' },
      { status: 500 }
    );
  }
}
