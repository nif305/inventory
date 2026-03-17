import {
  ItemStatus,
  ItemType,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

type InventoryFilters = {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  type?: string;
  onlyAvailableForRequest?: boolean;
  requestMode?: boolean;
};

type InventoryPayload = {
  code: string;
  name: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  type?: ItemType;
  quantity?: number;
  minStock?: number;
  unit?: string;
  location?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  unitPrice?: number | null;
  financialTracking?: boolean;
  sortOrder?: number;
};

function normalizeNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function calculateStatus(quantity: number, minStock: number): ItemStatus {
  if (quantity <= 0) return ItemStatus.OUT_OF_STOCK;
  if (quantity <= minStock) return ItemStatus.LOW_STOCK;
  return ItemStatus.AVAILABLE;
}

function calculateTotalPrice(quantity: number, unitPrice: number | null) {
  if (unitPrice === null) return null;
  return Number((quantity * unitPrice).toFixed(2));
}

function toDecimal(value: number | null) {
  if (value === null) return null;
  return new Prisma.Decimal(value);
}

function buildCreateData(data: InventoryPayload): Prisma.InventoryItemCreateInput {
  const quantity = normalizeNumber(data.quantity, 0);
  const minStock = normalizeNumber(data.minStock, 5);
  const unitPrice = normalizeNullableNumber(data.unitPrice);
  const financialTracking =
    typeof data.financialTracking === 'boolean'
      ? data.financialTracking
      : unitPrice !== null;

  return {
    code: data.code.trim(),
    name: data.name.trim(),
    description: data.description?.trim() || null,
    category: data.category.trim(),
    subcategory: data.subcategory?.trim() || null,
    type: data.type || ItemType.RETURNABLE,
    quantity,
    availableQty: quantity,
    reservedQty: 0,
    minStock,
    unit: data.unit?.trim() || 'قطعة',
    location: data.location?.trim() || null,
    notes: data.notes?.trim() || null,
    imageUrl: data.imageUrl?.trim() || null,
    financialTracking,
    unitPrice: toDecimal(unitPrice),
    totalPrice: toDecimal(calculateTotalPrice(quantity, unitPrice)),
    status: calculateStatus(quantity, minStock),
    sortOrder: normalizeNumber(data.sortOrder, 0),
  };
}

function buildUpdateData(
  current: {
    quantity: number;
    reservedQty: number;
    minStock: number;
    unitPrice: Prisma.Decimal | null;
  },
  data: Partial<InventoryPayload>,
): Prisma.InventoryItemUpdateInput {
  const quantity =
    data.quantity !== undefined
      ? normalizeNumber(data.quantity, current.quantity)
      : current.quantity;

  const minStock =
    data.minStock !== undefined
      ? normalizeNumber(data.minStock, current.minStock)
      : current.minStock;

  const incomingUnitPrice =
    data.unitPrice !== undefined
      ? normalizeNullableNumber(data.unitPrice)
      : current.unitPrice !== null
        ? Number(current.unitPrice)
        : null;

  const availableQty = Math.max(quantity - current.reservedQty, 0);
  const totalPrice = calculateTotalPrice(quantity, incomingUnitPrice);
  const financialTracking =
    typeof data.financialTracking === 'boolean'
      ? data.financialTracking
      : incomingUnitPrice !== null;

  return {
    code: data.code?.trim(),
    name: data.name?.trim(),
    description:
      data.description !== undefined ? data.description?.trim() || null : undefined,
    category: data.category?.trim(),
    subcategory:
      data.subcategory !== undefined ? data.subcategory?.trim() || null : undefined,
    type: data.type,
    quantity,
    availableQty,
    minStock,
    unit: data.unit?.trim(),
    location: data.location !== undefined ? data.location?.trim() || null : undefined,
    notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
    imageUrl: data.imageUrl !== undefined ? data.imageUrl?.trim() || null : undefined,
    financialTracking,
    unitPrice: toDecimal(incomingUnitPrice),
    totalPrice: toDecimal(totalPrice),
    status: calculateStatus(availableQty, minStock),
    sortOrder:
      data.sortOrder !== undefined
        ? normalizeNumber(data.sortOrder, 0)
        : undefined,
  };
}

export const InventoryService = {
  create: async (data: InventoryPayload) => {
    const item = await prisma.inventoryItem.create({
      data: buildCreateData(data),
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE_INVENTORY',
        entity: 'InventoryItem',
        entityId: item.id,
        details: JSON.stringify({
          code: item.code,
          name: item.name,
          category: item.category,
        }),
      },
    });

    return item;
  },

  getAll: async ({
    page = 1,
    limit = 12,
    search = '',
    category = '',
    status = '',
    type = '',
    onlyAvailableForRequest = false,
    requestMode = false,
  }: InventoryFilters) => {
    const skip = (page - 1) * limit;
    const requestOnly = onlyAvailableForRequest || requestMode;

    const where: Prisma.InventoryItemWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { subcategory: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        category ? { category } : {},
        status ? { status: status as ItemStatus } : {},
        type ? { type: type as ItemType } : {},
        requestOnly
          ? {
              availableQty: { gte: 0 },
            }
          : {},
      ],
    };

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getById: async (id: string) =>
    prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        custodyRecords: {
          where: { status: 'ACTIVE' },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        maintenanceRequests: {
          take: 3,
          orderBy: { createdAt: 'desc' },
        },
      },
    }),

  update: async (id: string, data: Partial<InventoryPayload>) => {
    const current = await prisma.inventoryItem.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        quantity: true,
        availableQty: true,
        reservedQty: true,
        minStock: true,
        unitPrice: true,
      },
    });

    if (!current) {
      throw new Error('الصنف غير موجود');
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: buildUpdateData(current, data),
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_INVENTORY',
        entity: 'InventoryItem',
        entityId: id,
        details: JSON.stringify({
          before: {
            code: current.code,
            name: current.name,
            quantity: current.quantity,
            availableQty: current.availableQty,
          },
          after: {
            code: updated.code,
            name: updated.name,
            quantity: updated.quantity,
            availableQty: updated.availableQty,
          },
        }),
      },
    });

    return updated;
  },

  delete: async (id: string) => {
    const activeCustody = await prisma.custodyRecord.count({
      where: { itemId: id, status: 'ACTIVE' },
    });

    if (activeCustody > 0) {
      throw new Error('لا يمكن حذف الصنف لوجود عهد نشطة مرتبطة به');
    }

    await prisma.inventoryItem.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE_INVENTORY',
        entity: 'InventoryItem',
        entityId: id,
      },
    });

    return { success: true };
  },

  adjustStock: async (id: string, quantityChange: number, reason: string) => {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new Error('الصنف غير موجود');
    }

    const newQuantity = item.quantity + quantityChange;
    const newAvailable = item.availableQty + quantityChange;

    if (newQuantity < 0 || newAvailable < 0) {
      throw new Error('الكمية لا يمكن أن تكون سالبة');
    }

    const status = calculateStatus(newAvailable, item.minStock);
    const unitPrice = item.unitPrice ? Number(item.unitPrice) : null;
    const totalPrice = calculateTotalPrice(newQuantity, unitPrice);

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        quantity: newQuantity,
        availableQty: newAvailable,
        status,
        totalPrice: toDecimal(totalPrice),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'ADJUST_STOCK',
        entity: 'InventoryItem',
        entityId: id,
        details: JSON.stringify({ quantityChange, reason }),
      },
    });

    return updated;
  },

  getStats: async () => {
    const [total, available, lowStock, outOfStock, financialItems, allItems] =
      await Promise.all([
        prisma.inventoryItem.count(),
        prisma.inventoryItem.count({
          where: { status: ItemStatus.AVAILABLE },
        }),
        prisma.inventoryItem.count({
          where: { status: ItemStatus.LOW_STOCK },
        }),
        prisma.inventoryItem.count({
          where: { status: ItemStatus.OUT_OF_STOCK },
        }),
        prisma.inventoryItem.count({
          where: { financialTracking: true },
        }),
        prisma.inventoryItem.findMany({
          select: {
            quantity: true,
            availableQty: true,
            unitPrice: true,
            totalPrice: true,
          },
        }),
      ]);

    const totalQuantity = allItems.reduce((sum, item) => sum + item.quantity, 0);

    const totalValue = allItems.reduce((sum, item) => {
      if (item.totalPrice) return sum + Number(item.totalPrice);
      if (item.unitPrice) return sum + item.quantity * Number(item.unitPrice);
      return sum;
    }, 0);

    return {
      total,
      available,
      lowStock,
      outOfStock,
      financialItems,
      totalQuantity,
      totalAvailableQuantity: allItems.reduce(
        (sum, item) => sum + Number(item.availableQty || 0),
        0,
      ),
      totalValue: Number(totalValue.toFixed(2)),
    };
  },
};