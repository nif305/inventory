import { NextRequest, NextResponse } from 'next/server';
import { ItemStatus, ItemType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { InventoryService } from '@/services/inventory.service';
import { approvedInventorySeed } from '@/lib/inventory/approvedInventory';

function normalizeStatus(status: string | null): ItemStatus | undefined {
  if (!status) return undefined;

  const normalized = String(status).trim().toUpperCase();

  if (normalized === ItemStatus.AVAILABLE) return ItemStatus.AVAILABLE;
  if (normalized === ItemStatus.LOW_STOCK) return ItemStatus.LOW_STOCK;
  if (normalized === ItemStatus.OUT_OF_STOCK) return ItemStatus.OUT_OF_STOCK;

  return undefined;
}

function normalizeType(type: string | null): ItemType | undefined {
  if (!type) return undefined;

  const normalized = String(type).trim().toUpperCase();

  if (normalized === ItemType.RETURNABLE) return ItemType.RETURNABLE;
  if (normalized === ItemType.CONSUMABLE) return ItemType.CONSUMABLE;

  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const search = (searchParams.get('search') || '').trim();
    const status = normalizeStatus(searchParams.get('status'));
    const type = normalizeType(searchParams.get('type'));
    const requestMode =
      searchParams.get('onlyAvailableForRequest') === 'true' ||
      searchParams.get('requestMode') === 'true';

    const baseWhere: any = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              { subcategory: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };

    const [result, stats, categoryRows, allItems] = await Promise.all([
      InventoryService.getAll({
        page,
        limit,
        search,
        status,
        type,
        requestMode,
      } as any),
      InventoryService.getStats(),
      prisma.inventoryItem.findMany({
        where: baseWhere,
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
      prisma.inventoryItem.findMany({
        where: baseWhere,
        select: {
          id: true,
          type: true,
          status: true,
          quantity: true,
          availableQty: true,
        },
      }),
    ]);

    const returnableCount = allItems.filter((item) => item.type === ItemType.RETURNABLE).length;
    const consumableCount = allItems.filter((item) => item.type === ItemType.CONSUMABLE).length;
    const availableCount = allItems.filter((item) => item.status !== ItemStatus.OUT_OF_STOCK).length;
    const usedCount = allItems.filter((item) => item.availableQty < item.quantity).length;

    return NextResponse.json({
      ...result,
      categories: categoryRows.map((row) => row.category).filter(Boolean),
      stats: {
        totalItems: stats.total,
        totalUnits: stats.totalQuantity,
        lowStockCount: stats.lowStock,
        outOfStockCount: stats.outOfStock,
        totalEstimatedValue: stats.totalValue,
        returnableCount,
        consumableCount,
        availableCount,
        usedCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر جلب بيانات المخزون' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body?.mode === 'seedApprovedInventory') {
      let created = 0;
      let updated = 0;

      for (const item of approvedInventorySeed) {
        const exists = await prisma.inventoryItem.findUnique({
          where: { code: item.code },
          select: { id: true },
        });

        if (exists) {
          await InventoryService.update(exists.id, {
            code: item.code,
            name: item.name,
            category: item.category,
            subcategory: item.subcategory,
            type: item.type,
            quantity: item.quantity,
            minStock: item.minStock,
            unit: item.unit,
            sortOrder: item.sortOrder,
            description: null,
            location: null,
            notes: null,
            unitPrice: null,
            financialTracking: false,
          });
          updated += 1;
        } else {
          await InventoryService.create({
            code: item.code,
            name: item.name,
            category: item.category,
            subcategory: item.subcategory,
            type: item.type,
            quantity: item.quantity,
            minStock: item.minStock,
            unit: item.unit,
            sortOrder: item.sortOrder,
            description: null,
            location: null,
            notes: null,
            unitPrice: null,
            financialTracking: false,
          });
          created += 1;
        }
      }

      return NextResponse.json({
        success: true,
        created,
        updated,
        total: approvedInventorySeed.length,
      });
    }

    const item = await InventoryService.create(body);
    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر إنشاء الصنف' },
      { status: 400 },
    );
  }
} 