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

function parseJsonObject(value?: string | null): Record<string, any> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function buildDraftEml(params: { to: string; subject: string; htmlBody: string; textBody: string }) {
  const boundary = `----=_NextDraft_${Date.now()}`;
  return [
    'X-Unsent: 1',
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.textBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.htmlBody,
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

    const draft = await prisma.emailDraft.findUnique({ where: { id } });
    if (!draft) {
      return NextResponse.json({ error: 'المسودة غير موجودة' }, { status: 404 });
    }

    const to = sanitizeHeader(draft.recipient || '');
    const subject = sanitizeHeader(draft.subject || 'مسودة مراسلة');
    const htmlBody = String(draft.body || '');
    const textBody = stripHtmlToText(htmlBody) || ' '; // بعض العملاء لا يفتحون المسودة بدون متن نصي

    const eml = buildDraftEml({ to, subject, htmlBody, textBody });

    await prisma.emailDraft.update({
      where: { id: draft.id },
      data: {
        status: 'COPIED',
        copiedAt: new Date(),
      },
    });

    const suggestions = await prisma.suggestion.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, status: true, justification: true, adminNotes: true },
    });

    const linkedSuggestion = suggestions.find((suggestion) => {
      const admin = parseJsonObject(suggestion.adminNotes);
      return admin.linkedDraftId === draft.id || suggestion.id === draft.sourceId || admin.linkedEntityId === draft.sourceId;
    });

    if (linkedSuggestion) {
      const justification = parseJsonObject(linkedSuggestion.justification);
      await prisma.suggestion.update({
        where: { id: linkedSuggestion.id },
        data: {
          status: 'IMPLEMENTED',
          justification: JSON.stringify({ ...justification, attachments: [] }),
        },
      });
    }

    const filename = `${subject || 'email-draft'}.eml`
      .replace(/[\\/:*?"<>|]+/g, '-')
      .slice(0, 120);

    return new NextResponse(eml, {
      status: 200,
      headers: {
        'Content-Type': 'message/rfc822; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر تنزيل ملف المراسلة حاليًا' },
      { status: 500 }
    );
  }
}
