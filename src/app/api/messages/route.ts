import { NextRequest, NextResponse } from 'next/server';
import { MessagingService } from '@/services/messaging.service';

function getUserId(request: NextRequest) {
  return request.headers.get('x-user-id') || '';
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const box = request.nextUrl.searchParams.get('box') || 'inbox';

    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم غير متوفر' },
        { status: 400 }
      );
    }

    const data =
      box === 'sent'
        ? await MessagingService.getSent(userId)
        : await MessagingService.getInbox(userId);

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'فشل جلب المراسلات' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const senderId = getUserId(request);
    const body = await request.json();

    if (!senderId) {
      return NextResponse.json(
        { error: 'معرف المرسل غير متوفر' },
        { status: 400 }
      );
    }

    if (!body.receiverId || !body.subject || !body.body) {
      return NextResponse.json(
        { error: 'بيانات الرسالة غير مكتملة' },
        { status: 400 }
      );
    }

    const message = await MessagingService.send({
      senderId,
      receiverId: body.receiverId,
      subject: body.subject,
      body: body.body,
      relatedType: body.relatedType,
      relatedId: body.relatedId,
    });

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'فشل إرسال الرسالة' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const body = await request.json();

    if (!userId || !body.id) {
      return NextResponse.json(
        { error: 'بيانات التحديث غير مكتملة' },
        { status: 400 }
      );
    }

    const result = await MessagingService.markAsRead(body.id, userId);
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'فشل تحديث الرسالة' },
      { status: 400 }
    );
  }
}