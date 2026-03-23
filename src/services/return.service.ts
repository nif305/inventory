import {
  ReturnStatus,
  CustodyStatus,
  ItemStatus,
  ReturnItemCondition,
  RequestStatus,
  Role,
  ItemType,
  ReturnSourceType,
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
    requestItemId,
    quantity,
  }: {
    custodyId?: string;
    userId: string;
    notes?: string;
    returnType?: ReturnItemCondition;
    damageDetails?: string;
    damageImages?: string;
    declarationAck?: boolean;
    requestItemId?: string;
    quantity?: number;
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

    if (custodyId) {
      const custody = await prisma.custodyRecord.findFirst({
        where: {
          id: custodyId,
          userId,
          status: {
            in: [CustodyStatus.ACTIVE, CustodyStatus.OVERDUE],
          },
          item: {
            type: ItemType.RETURNABLE,
          },
        },
        include: {
          item: {
            select: {
              name: true,
              type: true,
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
            sourceType: ReturnSourceType.CUSTODY,
            quantity: custody.quantity,
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
            sourceType: 'CUSTODY',
          }),
        },
      });

      const targets = await prisma.user.findMany({
        where: {
          role: { in: [Role.MANAGER, Role.WAREHOUSE] },
        },
        select: { id: true },
      });

      if (targets.length) {
        await prisma.notification.createMany({
          data: targets.map((user) => ({
            userId: user.id,
            type: 'NEW_RETURN_REQUEST',
            title: 'طلب إرجاع جديد بانتظار الاستلام',
            message: `تم رفع طلب إرجاع جديد برقم ${result.code} ويحتاج الاستلام والتوثيق.`,
            link: `/returns?open=${result.id}`,
            entityId: result.id,
            entityType: 'RETURN',
          })),
        });
      }

      return result;
    }

    if (requestItemId) {
      const requestItem = await prisma.requestItem.findUnique({
        where: { id: requestItemId },
        include: {
          request: true,
          item: true,
          returnRequests: {
            where: {
              status: {
                in: [ReturnStatus.PENDING, ReturnStatus.APPROVED],
              },
            },
            select: {
              quantity: true,
              status: true,
            },
          },
        },
      });

      if (!requestItem) {
        throw new Error('بند الطلب غير موجود');
      }

      if (requestItem.request.requesterId !== userId) {
        throw new Error('لا تملك صلاحية إرجاع هذا البند');
      }

      if (requestItem.request.status !== RequestStatus.ISSUED) {
        throw new Error('لا يمكن إرجاع فائض لهذا الطلب في حالته الحالية');
      }

      if (requestItem.item.type !== ItemType.CONSUMABLE) {
        throw new Error('المواد المسترجعة تُعاد من خلال العهدة وليس كبند طلب فائض');
      }

      const requestedQty = requestItem.quantity;
      const alreadyReturnedQty = requestItem.returnRequests.reduce(
        (sum, row) => sum + row.quantity,
        0
      );
      const safeQty = Math.max(1, Math.floor(Number(quantity || 0)));

      if (safeQty > requestedQty - alreadyReturnedQty) {
        throw new Error('كمية الإرجاع تتجاوز المسموح');
      }

      const count = await prisma.returnRequest.count();
      const code = `RET-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const created = await prisma.returnRequest.create({
        data: {
          code,
          requestItemId,
          requesterId: userId,
          sourceType: ReturnSourceType.REQUEST_ITEM,
          quantity: safeQty,
          conditionNote: notes || null,
          status: ReturnStatus.PENDING,
          returnType: normalizedReturnType,
          damageDetails: damageDetails || null,
          damageImages: damageImages || null,
          declarationAck: Boolean(declarationAck),
        },
        include: {
          requester: {
            select: {
              fullName: true,
            },
          },
          requestItem: {
            include: {
              item: {
                select: {
                  name: true,
                  code: true,
                },
              },
              request: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CREATE_RETURN_REQUEST',
          entity: 'ReturnRequest',
          entityId: created.id,
          details: JSON.stringify({
            code: created.code,
            requestItemId,
            quantity: safeQty,
            itemName: requestItem.item?.name || null,
            returnType: normalizedReturnType,
            sourceType: 'REQUEST_ITEM',
          }),
        },
      });

      const targets = await prisma.user.findMany({
        where: {
          role: { in: [Role.MANAGER, Role.WAREHOUSE] },
        },
        select: { id: true },
      });

      if (targets.length) {
        await prisma.notification.createMany({
          data: targets.map((user) => ({
            userId: user.id,
            type: 'NEW_RETURN_REQUEST',
            title: 'طلب إرجاع جديد بانتظار الاستلام',
            message: `تم رفع طلب إرجاع جديد برقم ${created.code} ويحتاج الاستلام والتوثيق.`,
            link: `/returns?open=${created.id}`,
            entityId: created.id,
            entityType: 'RETURN',
          })),
        });
      }

      return created;
    }

    throw new Error('يجب تحديد عهدة أو بند طلب للإرجاع');
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
        requestItem: {
          include: {
            request: true,
          },
        },
      },
    });

    if (!ret || ret.status !== ReturnStatus.PENDING) {
      throw new Error('طلب الإرجاع غير صالح أو تم التعامل معه مسبقًا');
    }

    if (ret.sourceType === ReturnSourceType.CUSTODY) {
      if (!ret.custody) {
        throw new Error('العهدة المرتبطة غير موجودة');
      }

      if (
        ret.custody.status !== CustodyStatus.ACTIVE &&
        ret.custody.status !== CustodyStatus.RETURN_REQUESTED &&
        ret.custody.status !== CustodyStatus.OVERDUE
      ) {
        throw new Error('هذه العهدة ليست في حالة تسمح بالإغلاق');
      }

      const item = await prisma.inventoryItem.findUnique({
        where: { id: ret.custody.itemId },
      });

      if (!item) {
        throw new Error('الصنف المرتبط غير موجود');
      }

      if (item.type !== ItemType.RETURNABLE) {
        throw new Error('لا يمكن اعتماد إرجاع مادة غير مسترجعة');
      }

      const nextAvailable = item.availableQty + ret.custody.quantity;
      const nextQuantity = item.quantity;
      const nextStatus =
        nextAvailable <= 0
          ? ItemStatus.OUT_OF_STOCK
          : nextAvailable > item.minStock
            ? ItemStatus.AVAILABLE
            : ItemStatus.LOW_STOCK;

      const result = await prisma.$transaction(async (tx) => {
        const updatedCustody = await tx.custodyRecord.update({
          where: { id: ret.custodyId! },
          data: {
            status: CustodyStatus.RETURNED,
            actualReturn: new Date(),
            returnCondition:
              normalizedReceivedType === ReturnItemCondition.GOOD ? 'سليمة' : 'غير سليمة',
            notes: receivedNotes || ret.custody!.notes,
          },
        });

        const updatedItem = await tx.inventoryItem.update({
          where: { id: ret.custody!.itemId },
          data: {
            availableQty: nextAvailable,
            quantity: nextQuantity,
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

        if (ret.custody!.requestId) {
          const remainingOpenCustodies = await tx.custodyRecord.count({
            where: {
              requestId: ret.custody!.requestId,
              status: {
                in: [CustodyStatus.ACTIVE, CustodyStatus.OVERDUE, CustodyStatus.RETURN_REQUESTED],
              },
            },
          });

          if (remainingOpenCustodies === 0) {
            await tx.request.update({
              where: { id: ret.custody!.requestId },
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
            sourceType: 'CUSTODY',
          }),
        },
      });

      await prisma.notification.create({
        data: {
          userId: ret.requesterId,
          type: 'RETURN_APPROVED',
          title: normalizedReceivedType === ReturnItemCondition.GOOD ? 'تم استلام المرتجع' : 'تم استلام المرتجع مع ملاحظة',
          message:
            normalizedReceivedType === ReturnItemCondition.GOOD
              ? `تم استلام طلب الإرجاع ${ret.code} وتوثيقه كمادة سليمة.`
              : `تم استلام طلب الإرجاع ${ret.code} وتوثيق المادة مع ملاحظة على الحالة.`,
          link: `/returns?open=${ret.id}`,
          entityId: ret.id,
          entityType: 'RETURN',
        },
      });

      return result;
    }

    if (ret.sourceType === ReturnSourceType.REQUEST_ITEM) {
      if (!ret.requestItem) {
        throw new Error('بند الطلب المرتبط غير موجود');
      }

      const item = await prisma.inventoryItem.findUnique({
        where: { id: ret.requestItem.itemId },
      });

      if (!item) {
        throw new Error('الصنف المرتبط غير موجود');
      }

      const nextAvailable = item.availableQty + ret.quantity;
      const nextQuantity = item.quantity + ret.quantity;
      const nextStatus =
        nextAvailable <= 0
          ? ItemStatus.OUT_OF_STOCK
          : nextAvailable > item.minStock
            ? ItemStatus.AVAILABLE
            : ItemStatus.LOW_STOCK;

      const result = await prisma.$transaction(async (tx) => {
        const updatedItem = await tx.inventoryItem.update({
          where: { id: ret.requestItem!.itemId },
          data: {
            availableQty: nextAvailable,
            quantity: nextQuantity,
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

        return {
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
            requestItemId: ret.requestItemId,
            itemId: ret.requestItem.itemId,
            quantity: ret.quantity,
            receivedType: normalizedReceivedType,
            sourceType: 'REQUEST_ITEM',
          }),
        },
      });

      await prisma.notification.create({
        data: {
          userId: ret.requesterId,
          type: 'RETURN_APPROVED',
          title: normalizedReceivedType === ReturnItemCondition.GOOD ? 'تم استلام المرتجع' : 'تم استلام المرتجع مع ملاحظة',
          message:
            normalizedReceivedType === ReturnItemCondition.GOOD
              ? `تم استلام طلب الإرجاع ${ret.code} وتوثيقه كمادة سليمة.`
              : `تم استلام طلب الإرجاع ${ret.code} وتوثيق المادة مع ملاحظة على الحالة.`,
          link: `/returns?open=${ret.id}`,
          entityId: ret.id,
          entityType: 'RETURN',
        },
      });

      return result;
    }

    throw new Error('نوع الإرجاع غير مدعوم');
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

      if (
        ret.sourceType === ReturnSourceType.CUSTODY &&
        ret.custody &&
        (ret.custody.status === CustodyStatus.RETURN_REQUESTED ||
          ret.custody.status === CustodyStatus.OVERDUE)
      ) {
        await tx.custodyRecord.update({
          where: { id: ret.custodyId! },
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
          requestItemId: ret.requestItemId,
          reason: reason || 'تم رفض طلب الإرجاع',
          sourceType: ret.sourceType,
        }),
      },
    });

    await prisma.notification.create({
      data: {
        userId: ret.requesterId,
        type: 'RETURN_REJECTED',
        title: 'تم رفض طلب الإرجاع',
        message: `تم رفض طلب الإرجاع ${ret.code}${reason ? ` بسبب: ${reason}` : ''}`,
        link: `/returns?open=${ret.id}`,
        entityId: ret.id,
        entityType: 'RETURN',
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
          requestItem: {
            include: {
              item: {
                select: {
                  name: true,
                  code: true,
                },
              },
              request: {
                select: {
                  code: true,
                  purpose: true,
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