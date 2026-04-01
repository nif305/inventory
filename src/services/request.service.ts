import {
  RequestStatus,
  Prisma,
  ItemStatus,
  Role,
  Status,
  ItemType,
  CustodyStatus,
  ReturnStatus,
  ReturnItemCondition,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

type RequestItemInput = {
  itemId: string;
  quantity: number;
  expectedReturnDate?: string | null;
};

function normalizePositiveQuantity(quantity: number) {
  const value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('الكمية المطلوبة غير صحيحة');
  }
  return Math.floor(value);
}

function parseExpectedReturn(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function computeItemStatus(availableQty: number, minStock: number) {
  if (availableQty <= 0) return ItemStatus.OUT_OF_STOCK;
  if (availableQty > minStock) return ItemStatus.AVAILABLE;
  return ItemStatus.LOW_STOCK;
}

function isPreIssueStatus(status: RequestStatus) {
  return status === RequestStatus.PENDING || status === RequestStatus.APPROVED;
}

function normalizeRequestStatusForClient(status: RequestStatus) {
  return status === RequestStatus.APPROVED ? RequestStatus.PENDING : status;
}

/**
 * تم تعطيل أي إنشاء تلقائي للمستخدمين الأساسيين أو التجريبيين من داخل خدمة الطلبات.
 * الحسابات يجب أن تُدار فقط من مسارات المستخدمين/طلب إنشاء الحساب.
 */
async function ensureCoreUsers() {
  return;
}

async function validateItemsForRequest(items: RequestItemInput[]) {
  const normalizedItems = items.map((item) => ({
    itemId: String(item.itemId),
    quantity: normalizePositiveQuantity(item.quantity),
    expectedReturnDate: item.expectedReturnDate || null,
  }));

  const itemIds = [...new Set(normalizedItems.map((item) => item.itemId))];

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds } },
    select: {
      id: true,
      name: true,
      type: true,
      availableQty: true,
      quantity: true,
      minStock: true,
      status: true,
    },
  });

  if (inventoryItems.length !== itemIds.length) {
    throw new Error('بعض الأصناف المطلوبة غير موجودة في المخزون');
  }

  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));

  for (const row of normalizedItems) {
    const stockItem = inventoryMap.get(row.itemId);

    if (!stockItem) {
      throw new Error('بعض الأصناف المطلوبة غير موجودة في المخزون');
    }

    if (stockItem.status === ItemStatus.OUT_OF_STOCK || stockItem.availableQty <= 0) {
      throw new Error(`الصنف ${stockItem.name} غير متوفر في المخزون`);
    }

    if (row.quantity > stockItem.availableQty) {
      throw new Error(
        `الكمية المطلوبة من الصنف ${stockItem.name} أكبر من المتاح حاليًا (${stockItem.availableQty})`
      );
    }

    if (stockItem.type === ItemType.CONSUMABLE && row.expectedReturnDate) {
      throw new Error(`الصنف ${stockItem.name} استهلاكي ولا يقبل تاريخ إرجاع`);
    }
  }

  return normalizedItems;
}

function buildRequestInclude() {
  return {
    requester: {
      select: {
        id: true,
        employeeId: true,
        fullName: true,
        email: true,
        mobile: true,
        department: true,
        jobTitle: true,
        roles: true,
        status: true,
      },
    },
    items: {
      include: {
        item: true,
      },
      orderBy: {
        createdAt: 'asc' as const,
      },
    },
    processedBy: {
      select: {
        id: true,
        fullName: true,
        email: true,
        roles: true,
      },
    },
  };
}

function mapRequestForClient(request: any) {
  const items = Array.isArray(request?.items)
    ? request.items.map((item: any) => ({
        id: item.id,
        requestId: item.requestId,
        itemId: item.itemId,
        quantity: item.quantity,
        notes: item.expectedReturnDate ? item.expectedReturnDate.toISOString().slice(0, 10) : null,
        expectedReturnDate: item.expectedReturnDate
          ? item.expectedReturnDate.toISOString().slice(0, 10)
          : null,
        activeIssuedQty: item.activeIssuedQty ?? 0,
        item: item.item
          ? {
              ...item.item,
              status: item.item.status,
              availableQty: item.item.availableQty,
            }
          : null,
      }))
    : [];

  return {
    id: request.id,
    code: request.code,
    requesterId: request.requesterId,
    department: request.department,
    purpose: request.purpose,
    status: normalizeRequestStatusForClient(request.status),
    rejectionReason: request.rejectionReason,
    notes: request.notes,
    createdAt: request.createdAt,
    processedAt: request.processedAt,
    processedById: request.processedById,
    requester: request.requester
      ? {
          ...request.requester,
          role: Array.isArray(request.requester.roles) && request.requester.roles.length > 0
            ? request.requester.roles[0]
            : Role.USER,
        }
      : null,
    items,
  };
}

async function getNextRequestCode(tx: Prisma.TransactionClient) {
  const latestRequest = await tx.request.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  });

  const latestNumber = latestRequest?.code
    ? Number(String(latestRequest.code).split('-').pop())
    : 0;

  const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;
  return `REQ-2026-${String(nextNumber).padStart(4, '0')}`;
}

export async function listRequests(actor?: { id: string; role?: Role }) {
  await ensureCoreUsers();

  const include = buildRequestInclude();

  const where =
    actor?.role === Role.MANAGER || actor?.role === Role.WAREHOUSE
      ? {}
      : actor?.id
      ? { requesterId: actor.id }
      : {};

  const requests = await prisma.request.findMany({
    where,
    include,
    orderBy: { createdAt: 'desc' },
  });

  return requests.map(mapRequestForClient);
}

export async function getRequestById(id: string, actor?: { id: string; role?: Role }) {
  await ensureCoreUsers();

  const request = await prisma.request.findUnique({
    where: { id },
    include: buildRequestInclude(),
  });

  if (!request) {
    throw new Error('الطلب غير موجود');
  }

  if (
    actor?.role !== Role.MANAGER &&
    actor?.role !== Role.WAREHOUSE &&
    actor?.id &&
    request.requesterId !== actor.id
  ) {
    throw new Error('غير مصرح');
  }

  return mapRequestForClient(request);
}

export async function createRequest(input: {
  requesterId: string;
  department?: string | null;
  purpose: string;
  notes?: string | null;
  items: RequestItemInput[];
}) {
  await ensureCoreUsers();

  if (!input.requesterId) {
    throw new Error('معرّف مقدم الطلب مطلوب');
  }

  if (!input.purpose || !String(input.purpose).trim()) {
    throw new Error('الغرض من الطلب مطلوب');
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('يجب إضافة مادة واحدة على الأقل');
  }

  const requester = await prisma.user.findUnique({
    where: { id: input.requesterId },
    select: {
      id: true,
      employeeId: true,
      fullName: true,
      email: true,
      mobile: true,
      department: true,
      jobTitle: true,
      roles: true,
      status: true,
    },
  });

  if (!requester) {
    throw new Error('مقدم الطلب غير موجود');
  }

  const normalizedItems = await validateItemsForRequest(input.items);

  const created = await prisma.$transaction(async (tx) => {
    const code = await getNextRequestCode(tx);

    const request = await tx.request.create({
      data: {
        code,
        requesterId: requester.id,
        department: input.department || requester.department,
        purpose: String(input.purpose).trim(),
        status: RequestStatus.PENDING,
        notes: input.notes || null,
        items: {
          create: normalizedItems.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            expectedReturnDate: parseExpectedReturn(item.expectedReturnDate),
            activeIssuedQty: 0,
          })),
        },
      },
      include: buildRequestInclude(),
    });

    return request;
  });

  return mapRequestForClient(created);
}

export async function updateRequest(
  id: string,
  actor: { id: string; role?: Role },
  input: {
    purpose?: string;
    notes?: string | null;
    items?: RequestItemInput[];
  }
) {
  await ensureCoreUsers();

  const existing = await prisma.request.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });

  if (!existing) {
    throw new Error('الطلب غير موجود');
  }

  if (existing.requesterId !== actor.id && actor.role !== Role.MANAGER) {
    throw new Error('غير مصرح');
  }

  if (!isPreIssueStatus(existing.status)) {
    throw new Error('لا يمكن تعديل طلب تم صرفه أو إغلاقه');
  }

  const nextPurpose = input.purpose?.trim() || existing.purpose;
  const nextNotes = input.notes === undefined ? existing.notes : input.notes;

  const normalizedItems =
    input.items && input.items.length > 0
      ? await validateItemsForRequest(input.items)
      : existing.items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          expectedReturnDate: item.expectedReturnDate
            ? item.expectedReturnDate.toISOString().slice(0, 10)
            : null,
        }));

  const updated = await prisma.$transaction(async (tx) => {
    await tx.requestItem.deleteMany({ where: { requestId: id } });

    const request = await tx.request.update({
      where: { id },
      data: {
        purpose: nextPurpose,
        notes: nextNotes,
        status: RequestStatus.PENDING,
        rejectionReason: null,
        processedAt: null,
        processedById: null,
        items: {
          create: normalizedItems.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            expectedReturnDate: parseExpectedReturn(item.expectedReturnDate),
            activeIssuedQty: 0,
          })),
        },
      },
      include: buildRequestInclude(),
    });

    return request;
  });

  return mapRequestForClient(updated);
}

export async function cancelRequest(id: string, actor: { id: string; role?: Role }) {
  await ensureCoreUsers();

  const request = await prisma.request.findUnique({
    where: { id },
    select: {
      id: true,
      requesterId: true,
      status: true,
    },
  });

  if (!request) {
    throw new Error('الطلب غير موجود');
  }

  if (request.requesterId !== actor.id && actor.role !== Role.MANAGER) {
    throw new Error('غير مصرح');
  }

  if (!isPreIssueStatus(request.status)) {
    throw new Error('لا يمكن إلغاء طلب تم صرفه أو إغلاقه');
  }

  await prisma.$transaction(async (tx) => {
    await tx.requestItem.deleteMany({ where: { requestId: id } });
    await tx.request.delete({ where: { id } });
  });

  return { success: true };
}

export async function processRequestAction(input: {
  requestId: string;
  actorId: string;
  actorRole?: Role;
  action: 'APPROVE' | 'REJECT' | 'ISSUE';
  notes?: string | null;
  reason?: string | null;
}) {
  await ensureCoreUsers();

  if (input.actorRole !== Role.MANAGER && input.actorRole !== Role.WAREHOUSE) {
    throw new Error('غير مصرح');
  }

  const request = await prisma.request.findUnique({
    where: { id: input.requestId },
    include: buildRequestInclude(),
  });

  if (!request) {
    throw new Error('الطلب غير موجود');
  }

  if (input.action === 'APPROVE') {
    const updated = await prisma.request.update({
      where: { id: request.id },
      data: {
        status: RequestStatus.APPROVED,
        processedById: input.actorId,
        processedAt: new Date(),
        notes: input.notes ?? request.notes,
        rejectionReason: null,
      },
      include: buildRequestInclude(),
    });

    return mapRequestForClient(updated);
  }

  if (input.action === 'REJECT') {
    const reason = String(input.reason || input.notes || '').trim();
    if (!reason) {
      throw new Error('سبب الرفض مطلوب');
    }

    const updated = await prisma.request.update({
      where: { id: request.id },
      data: {
        status: RequestStatus.REJECTED,
        processedById: input.actorId,
        processedAt: new Date(),
        rejectionReason: reason,
        notes: input.notes ?? request.notes,
      },
      include: buildRequestInclude(),
    });

    return mapRequestForClient(updated);
  }

  if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.APPROVED) {
    throw new Error('لا يمكن صرف هذا الطلب في حالته الحالية');
  }

  const issued = await prisma.$transaction(async (tx) => {
    const freshRequest = await tx.request.findUnique({
      where: { id: request.id },
      include: {
        items: {
          include: { item: true },
        },
        requester: true,
      },
    });

    if (!freshRequest) {
      throw new Error('الطلب غير موجود');
    }

    for (const row of freshRequest.items) {
      const stockItem = row.item;
      if (!stockItem) continue;

      if (stockItem.availableQty < row.quantity) {
        throw new Error(`الكمية غير كافية للصنف ${stockItem.name}`);
      }

      const nextAvailable = stockItem.availableQty - row.quantity;
      await tx.inventoryItem.update({
        where: { id: stockItem.id },
        data: {
          availableQty: nextAvailable,
          status: computeItemStatus(nextAvailable, stockItem.minStock),
        },
      });

      if (stockItem.type === ItemType.RETURNABLE) {
        await tx.custodyRecord.create({
          data: {
            userId: freshRequest.requesterId,
            requestId: freshRequest.id,
            itemId: stockItem.id,
            quantity: row.quantity,
            status: CustodyStatus.ACTIVE,
            issuedAt: new Date(),
            expectedReturnAt: row.expectedReturnDate,
          },
        });

        await tx.requestItem.update({
          where: { id: row.id },
          data: { activeIssuedQty: row.quantity },
        });
      }
    }

    return tx.request.update({
      where: { id: freshRequest.id },
      data: {
        status: RequestStatus.ISSUED,
        processedById: input.actorId,
        processedAt: new Date(),
        notes: input.notes ?? freshRequest.notes,
      },
      include: buildRequestInclude(),
    });
  });

  return mapRequestForClient(issued);
}

export async function getRequestStats(actor?: { id: string; role?: Role }) {
  await ensureCoreUsers();

  const where =
    actor?.role === Role.MANAGER || actor?.role === Role.WAREHOUSE
      ? {}
      : actor?.id
      ? { requesterId: actor.id }
      : {};

  const [requests, items] = await Promise.all([
    prisma.request.findMany({
      where,
      select: { status: true },
    }),
    prisma.requestItem.findMany({
      where: actor?.role === Role.MANAGER || actor?.role === Role.WAREHOUSE
        ? {}
        : actor?.id
        ? { request: { requesterId: actor.id } }
        : {},
      select: { id: true },
    }),
  ]);

  return {
    total: requests.length,
    pending: requests.filter((item) => item.status === RequestStatus.PENDING || item.status === RequestStatus.APPROVED).length,
    issued: requests.filter((item) => item.status === RequestStatus.ISSUED).length,
    rejected: requests.filter((item) => item.status === RequestStatus.REJECTED).length,
    items: items.length,
  };
}
