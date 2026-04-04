import { NextRequest, NextResponse } from 'next/server';
import { DraftStatus, SuggestionStatus } from '@prisma/client';
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

function escapeHtml(value?: string | null) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toSafeAsciiFilename(value?: string | null) {
  const normalized = String(value || 'email-draft')
    .replace(/[^a-zA-Z0-9\-_\. ]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);

  return normalized || 'email-draft';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const draft = await prisma.emailDraft.findUnique({
      where: { id },
    });

    if (!draft) {
      return NextResponse.json({ error: 'المسودة غير موجودة' }, { status: 404 });
    }

    const subject = sanitizeHeader(draft.subject || 'مسودة مراسلة');
    const to = sanitizeHeader(draft.recipient || '');
    const htmlBody = String(draft.body || '');
    const textBody = stripHtmlToText(htmlBody);
    const boundary = `----=_NAUSS_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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
      `<html><body dir="rtl">${htmlBody || `<pre>${escapeHtml(textBody)}</pre>`}</body></html>`,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const filenameBase = toSafeAsciiFilename(subject);
    const utf8Filename = encodeURIComponent(`${subject || 'email-draft'}.eml`);

    await prisma.$transaction(async (tx) => {
      await tx.emailDraft.update({
        where: { id: draft.id },
        data: {
          status: DraftStatus.COPIED,
          copiedAt: new Date(),
        },
      });

      const linkedSuggestion = await tx.suggestion.findFirst({
        where: {
          OR: [
            { id: draft.sourceId },
            { adminNotes: { contains: draft.id } },
          ],
        },
      });

      if (linkedSuggestion) {
        const adminData = (() => {
          try {
            return linkedSuggestion.adminNotes ? JSON.parse(linkedSuggestion.adminNotes) : {};
          } catch {
            return {};
          }
        })();
        const justificationData = (() => {
          try {
            return linkedSuggestion.justification ? JSON.parse(linkedSuggestion.justification) : {};
          } catch {
            return {};
          }
        })();

        await tx.suggestion.update({
          where: { id: linkedSuggestion.id },
          data: {
            status: SuggestionStatus.IMPLEMENTED,
            adminNotes: JSON.stringify({
              ...adminData,
              draftDownloadedAt: new Date().toISOString(),
            }),
            justification: JSON.stringify({
              ...justificationData,
              attachments: [],
            }),
          },
        });
      }
    });

    const bytes = new TextEncoder().encode(eml);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'message/rfc822',
        'Content-Disposition': `attachment; filename="${filenameBase}.eml"; filename*=UTF-8''${utf8Filename}`,
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
