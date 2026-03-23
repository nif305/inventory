import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function sanitizeHeader(value?: string | null) {
  return String(value || '').replace(/\r/g, ' ').replace(/\n/g, ' ').trim();
}

function encodeQuotedPrintableUtf8(input: string) {
  const bytes = Buffer.from(input, 'utf8');
  let output = '';
  let lineLength = 0;

  const push = (chunk: string) => {
    if (lineLength + chunk.length > 72) {
      output += '=\r\n';
      lineLength = 0;
    }
    output += chunk;
    lineLength += chunk.length;
  };

  for (const byte of bytes) {
    if (byte === 0x0d) {
      continue;
    }
    if (byte === 0x0a) {
      output += '\r\n';
      lineLength = 0;
      continue;
    }

    const isPrintable =
      (byte >= 33 && byte <= 60) || (byte >= 62 && byte <= 126) || byte === 0x20 || byte === 0x09;

    if (isPrintable) {
      const char = String.fromCharCode(byte);
      if ((byte === 0x20 || byte === 0x09) && lineLength >= 70) {
        push(`=${byte.toString(16).toUpperCase().padStart(2, '0')}`);
      } else {
        push(char);
      }
    } else {
      push(`=${byte.toString(16).toUpperCase().padStart(2, '0')}`);
    }
  }

  return output;
}

function buildDraftEml(params: {
  to: string;
  cc?: string | null;
  subject: string;
  htmlBody: string;
}) {
  const boundary = `_000_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const to = sanitizeHeader(params.to);
  const cc = sanitizeHeader(params.cc || '');
  const subject = sanitizeHeader(params.subject);
  const htmlBody = params.htmlBody || '<html><body dir="rtl"><div>—</div></body></html>';
  const textBody = 'يرجى فتح هذه المسودة في Outlook أو عميل بريد يدعم HTML.';

  return [
    'X-Unsent: 1',
    'From: "إدارة عمليات التدريب" <OD@nauss.edu.sa>',
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    `Subject: ${subject}`,
    `Thread-Topic: ${subject}`,
    'Content-Language: ar-SA',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    encodeQuotedPrintableUtf8(textBody),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    encodeQuotedPrintableUtf8(htmlBody),
    '',
    `--${boundary}--`,
    '',
  ].filter(Boolean).join('\r\n');
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

    const eml = buildDraftEml({
      to: draft.recipient,
      cc: null,
      subject: draft.subject,
      htmlBody: draft.body || '<html><body dir="rtl"><div>—</div></body></html>',
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
