import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const item = await InventoryService.getById(id);

    if (!item) {
      return NextResponse.json({ error: 'الصنف غير موجود' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر جلب بيانات الصنف' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    const item = await InventoryService.update(id, body);
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر تحديث الصنف' },
      { status: 400 },
    );
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = await InventoryService.delete(id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر حذف الصنف' },
      { status: 400 },
    );
  }
}