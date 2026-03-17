import {
  ReturnStatus,
  CustodyStatus,
  ItemStatus,
  ReturnItemCondition,
  RequestStatus,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const ReturnService = {
  create: async ({
    custodyId,
    userId,
    notes,
    returnType,
    damageDetails,
    damageImages,
    declarationAck,
  }: {
    custodyId: string;
    userId: string;
    notes?: string;
    returnType?: ReturnItemCondition;
    damageDetails?: string;
    damageImages?: string;
    declarationAck?: boolean;
  }) => {
    const normalizedReturnType = returnType || ReturnItemCondition.GOOD;

    if (!declarationAck) {
      throw new Error('يجب الإقرار بصحة المعلومات قبل إرسال طلب الإرجاع');
    }

    if (
      normalizedReturnType !== ReturnItemCondition.GOOD &&
      !String(damageDetails || '').trim()
    ) {
      throw new Error('يجب كتابة سبب أو ملاحظة عن حالة المادة');
    }

    const custody = await prisma.custodyRecord.findFirst({
      where: {
        id: custodyId,
        userId,
        status: CustodyStatus.ACTIVE,
      },
      include: {
        item: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!custody) {
      throw new Error('العهدة غير موجودة أو سبق التعامل معها');
    }

    const existingPendingRequest = await prisma.returnRequest.findFirst({
      where: {
        custodyId,
        status: ReturnStatus.PENDING,
      },
      select: {
        id: true,
      },
    });

    if (existingPendingRequest) {
      throw new Error('يوجد طلب إرجاع مفتوح لهذه المادة');
    }

    const count = await prisma.returnRequest.count();
    const code = `RET-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.returnRequest.create({
        data: {
          code,
          custodyId,
          requesterId: userId,
          conditionNote: notes || null,
          status: ReturnStatus.PENDING,
          returnType: normalizedReturnType,
          damageDetails: damageDetails || null,
          damageImages: damageImages || null,
          declarationAck: Boolean(declarationAck),
        },
        include: {
          custody: {
            include: {
              item: {
                select: {
                  name: true,
                  code: true,
                },
              },
              user: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          requester: {
            select: {
              fullName: true,
            },
          },
        },
      });

      await tx.custodyRecord.update({
        where: { id: custodyId },
        data: {
          status: CustodyStatus.RETURN_REQUESTED,
        },
      });

      return created;
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_RETURN_REQUEST',
        entity: 'ReturnRequest',
        entityId: result.id,
        details: JSON.stringify({
          code: result.code,
          custodyId,
          itemName: custody.item?.name || null,
          returnType: normalizedReturnType,
        }),
      },
    });

    return result;
  },

  approve: async ({
    returnId,
    approverId,
    receivedType,
    receivedNotes,
    receivedImages,
  }: {
    returnId: string;
    approverId: string;
    receivedType?: ReturnItemCondition;
    receivedNotes?: string;
    receivedImages?: string;
  }) => {
    if (!returnId) {
      throw new Error('رقم طلب الإرجاع غير موجود');
    }

    const normalizedReceivedType = receivedType || ReturnItemCondition.GOOD;

    if (
      normalizedReceivedType !== ReturnItemCondition.GOOD &&
      !String(receivedNotes || '').trim()
    ) {
      throw new Error('يجب كتابة ملاحظة عند اختيار غير سليمة');
    }

    const ret = await prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: {
        custody: true,
      },
    });

    if (!ret || ret.status !== ReturnStatus.PENDING) {
      throw new Error('طلب الإرجاع غير صالح أو تم التعامل معه مسبقًا');
    }

    if (!ret.custody) {
      throw new Error('العهدة المرتبطة غير موجودة');
    }

    if (
      ![CustodyStatus.ACTIVE, CustodyStatus.RETURN_REQUESTED].includes(ret.custody.status)
    ) {
      throw new Error('هذه العهدة ليست في حالة تسمح بالإغلاق');
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: ret.custody.itemId },
    });

    if (!item) {
      throw new Error('الصنف المرتبط غير موجود');
    }

    const nextQuantity = item.quantity + ret.custody.quantity;
    const nextAvailable = item.availableQty + ret.custody.quantity;

    const nextStatus =
      nextAvailable <= 0
        ? ItemStatus.OUT_OF_STOCK
        : nextAvailable > item.minStock
        ? ItemStatus.AVAILABLE
        : ItemStatus.LOW_STOCK;

    const result = await prisma.$transaction(async (tx) => {
      const updatedCustody = await tx.custodyRecord.update({
        where: { id: ret.custodyId },
        data: {
          status: CustodyStatus.RETURNED,
          actualReturn: new Date(),
          returnCondition:
            normalizedReceivedType === ReturnItemCondition.GOOD ? 'سليمة' : 'غير سليمة',
          notes: receivedNotes || ret.custody.notes,
        },
      });

      const updatedItem = await tx.inventoryItem.update({
        where: { id: ret.custody.itemId },
        data: {
          availableQty: { increment: ret.custody.quantity },
          quantity: { increment: ret.custody.quantity },
          status: nextStatus,
        },
      });

      const updatedReturn = await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.APPROVED,
          processedById: approverId,
          processedAt: new Date(),
          receivedType: normalizedReceivedType,
          receivedNotes: receivedNotes || null,
          receivedImages: receivedImages || null,
        },
      });

      if (ret.custody.requestId) {
        const remainingOpenCustodies = await tx.custodyRecord.count({
          where: {
            requestId: ret.custody.requestId,
            status: {
              in: [CustodyStatus.ACTIVE, CustodyStatus.OVERDUE, CustodyStatus.RETURN_REQUESTED],
            },
          },
        });

        if (remainingOpenCustodies === 0) {
          await tx.request.update({
            where: { id: ret.custody.requestId },
            data: {
              status: RequestStatus.RETURNED,
              processedAt: new Date(),
              processedById: approverId,
            },
          });
        }
      }

      return {
        custody: updatedCustody,
        item: updatedItem,
        returnRequest: updatedReturn,
      };
    });

    await prisma.auditLog.create({
      data: {
        userId: approverId,
        action: 'APPROVE_RETURN_REQUEST',
        entity: 'ReturnRequest',
        entityId: returnId,
        details: JSON.stringify({
          custodyId: ret.custodyId,
          itemId: ret.custody.itemId,
          quantity: ret.custody.quantity,
          receivedType: normalizedReceivedType,
        }),
      },
    });

    return result;
  },

  reject: async (returnId: string, managerId: string, reason: string) => {
    if (!returnId) {
      throw new Error('رقم طلب الإرجاع غير موجود');
    }

    const ret = await prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: {
        custody: true,
      },
    });

    if (!ret || ret.status !== ReturnStatus.PENDING) {
      throw new Error('طلب الإرجاع غير صالح أو تم التعامل معه مسبقًا');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedReturn = await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.REJECTED,
          rejectionReason: reason || 'تم رفض طلب الإرجاع',
          processedById: managerId,
          processedAt: new Date(),
        },
      });

      if (ret.custody && ret.custody.status === CustodyStatus.RETURN_REQUESTED) {
        await tx.custodyRecord.update({
          where: { id: ret.custodyId },
          data: {
            status: CustodyStatus.ACTIVE,
          },
        });
      }

      return updatedReturn;
    });

    await prisma.auditLog.create({
      data: {
        userId: managerId,
        action: 'REJECT_RETURN_REQUEST',
        entity: 'ReturnRequest',
        entityId: returnId,
        details: JSON.stringify({
          custodyId: ret.custodyId,
          reason: reason || 'تم رفض طلب الإرجاع',
        }),
      },
    });

    return result;
  },

  getAll: async ({
    page = 1,
    status,
    role,
    userId,
  }: {
    page?: number;
    status?: string;
    role?: Role | string;
    userId?: string;
  }) => {
    const normalizedRole = String(role || '').toUpperCase();

    const where = {
      AND: [
        status ? { status: status as ReturnStatus } : {},
        normalizedRole === 'USER' && userId ? { requesterId: userId } : {},
      ],
    };

    const [data, total] = await Promise.all([
      prisma.returnRequest.findMany({
        where,
        skip: (page - 1) * 50,
        take: 50,
        include: {
          custody: {
            include: {
              item: {
                select: {
                  name: true,
                  code: true,
                },
              },
              user: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          requester: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.returnRequest.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / 50),
      },
    };
  },
};