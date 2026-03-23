import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type AttachmentLike = {
  filename?: string;
  name?: string;
  contentType?: string;
  type?: string;
  base64Content?: string;
  base64?: string;
  data?: string;
};

function sanitizeHeader(value?: string | null) {
  return String(value || '').replace(/\r/g, ' ').replace(/\n/g, ' ').trim();
}

function encodeQuotedPrintable(input: string) {
  const bytes = Buffer.from(input || '', 'utf8');
  let out = '';
  let lineLength = 0;

  const push = (chunk: string) => {
    if (lineLength + chunk.length > 73) {
      out += '=\r\n';
      lineLength = 0;
    }
    out += chunk;
    const idx = chunk.lastIndexOf('\r\n');
    if (idx >= 0) {
      lineLength = chunk.length - idx - 2;
    } else {
      lineLength += chunk.length;
    }
  };

  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];

    if (byte === 13 && bytes[i + 1] === 10) {
      out += '\r\n';
      lineLength = 0;
      i += 1;
      continue;
    }

    const safe =
      (byte >= 33 && byte <= 60) ||
      (byte >= 62 && byte <= 126) ||
      byte === 9 ||
      byte === 32;

    if (safe) {
      push(String.fromCharCode(byte));
    } else {
      push(`=${byte.toString(16).toUpperCase().padStart(2, '0')}`);
    }
  }

  return out;
}

function normalizeAttachments(value: any): Array<{ filename: string; contentType: string; base64Content: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: AttachmentLike | string) => {
      if (typeof item === 'string') return null;

      const filename = String(item.filename || item.name || '').trim();
      const contentType = String(item.contentType || item.type || 'application/octet-stream').trim();
      const base64Content = String(item.base64Content || item.base64 || item.data || '')
        .trim()
        .replace(/\s+/g, '');

      if (!filename || !base64Content) return null;

      return { filename, contentType, base64Content };
    })
    .filter(Boolean) as Array<{ filename: string; contentType: string; base64Content: string }>;
}

async function findRelatedAttachments(draftId: string) {
  const suggestion = await prisma.suggestion.findFirst({
    where: {
      adminNotes: {
        contains: draftId,
      },
    },
    select: {
      justification: true,
    },
  });

  if (!suggestion?.justification) return [];

  try {
    const parsed = JSON.parse(suggestion.justification);
    return normalizeAttachments(parsed?.attachments);
  } catch {
    return [];
  }
}

function buildHtmlDocument(body: string) {
  return [
    '<html>',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '</head>',
    '<body dir="rtl" style="font-family:Cairo, Tahoma, Arial, sans-serif;">',
    body || '<div>—</div>',
    '</body>',
    '</html>',
  ].join('\r\n');
}

function buildDraftEml(params: {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  attachments?: Array<{ filename: string; contentType: string; base64Content: string }>;
}) {
  const hasAttachments = Array.isArray(params.attachments) && params.attachments.length > 0;
  const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const htmlDoc = buildHtmlDocument(params.htmlBody);
  const plainText = 'هذه مسودة بريد قابلة للتعديل.';

  const parts: string[] = [
    'X-Unsent: 1',
    `From: ${sanitizeHeader(params.from)}`,
    `To: ${sanitizeHeader(params.to)}`,
    `Subject: ${sanitizeHeader(params.subject)}`,
    `Thread-Topic: ${sanitizeHeader(params.subject)}`,
    'Content-Language: ar-SA',
    'MIME-Version: 1.0',
    hasAttachments
      ? `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
      : `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
  ];

  if (hasAttachments) {
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
    );
  }

  parts.push(
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    encodeQuotedPrintable(plainText),
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    encodeQuotedPrintable(htmlDoc),
    '',
    `--${altBoundary}--`,
    '',
  );

  for (const attachment of params.attachments || []) {
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: ${sanitizeHeader(attachment.contentType)}; name="${sanitizeHeader(attachment.filename)}"`,
      `Content-Disposition: attachment; filename="${sanitizeHeader(attachment.filename)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      attachment.base64Content,
      '',
    );
  }

  if (hasAttachments) {
    parts.push(`--${mixedBoundary}--`, '');
  }

  return parts.join('\r\n');
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

    const attachments = await findRelatedAttachments(draft.id);

    const eml = buildDraftEml({
      from: 'NAlshahrani@nauss.edu.sa',
      to: draft.recipient,
      subject: draft.subject,
      htmlBody: draft.body || '<div>—</div>',
      attachments,
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
