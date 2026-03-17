import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export async function GET() {
  try {
    const data = await prisma.notification.findMany({ where: { userId: 'usr_001' }, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await prisma.notification.update({ where: { id: body.id }, data: { isRead: true, readAt: new Date() } });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
