import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

function safeAsciiFilename(subject: string) {
  const base = subject
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return `${(base || 'email-draft').slice(0, 80)}.eml`;
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

    const subject = sanitizeHeader(draft.subject || 'مسودة مراسلة');
    const to = sanitizeHeader(draft.recipient || '');
    const htmlBody = String(draft.body || '');
    const textBody = stripHtmlToText(htmlBody);
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const eml = [
      'X-Unsent: 1',
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      textBody,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      htmlBody || textBody,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    await prisma.emailDraft.update({
      where: { id },
      data: {
        status: 'COPIED',
        copiedAt: new Date(),
      },
    });

    const encoder = new TextEncoder();
    const body = encoder.encode(eml);
    const asciiFilename = safeAsciiFilename(subject);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'message/rfc822',
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(asciiFilename)}`,
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر تصدير ملف EML' },
      { status: 500 }
    );
  }
}
