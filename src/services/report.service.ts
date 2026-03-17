import { ItemType, RequestStatus, ReturnStatus, CustodyStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type TopItemRow = {
  itemId: string;
  name: string;
  code: string;
  quantity: number;
};

type TopUserRow = {
  userId: string;
  fullName: string;
  department: string;
  quantity: number;
};

function startOfCurrentYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}

export const ReportService = {
  getExecutiveSummary: async () => {
    const yearStart = startOfCurrentYear();

    const [
      totalItems,
      lowStockItems,
      outOfStockItems,
      inventoryItems,
      requests,
      approvedReturns,
      activeCustodyCount,
      activeCustodyQty,
    ] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.inventoryItem.count({
        where: { status: 'LOW_STOCK' },
      }),
      prisma.inventoryItem.count({
        where: { status: 'OUT_OF_STOCK' },
      }),
      prisma.inventoryItem.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },
      }),
      prisma.request.findMany({
        where: {
          createdAt: {
            gte: yearStart,
          },
        },
        select: {
          id: true,
          code: true,
          status: true,
          requesterId: true,
          createdAt: true,
          requester: {
            select: {
              id: true,
              fullName: true,
              department: true,
            },
          },
          items: {
            select: {
              itemId: true,
              quantity: true,
              item: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      }),
      prisma.returnRequest.findMany({
        where: {
          status: ReturnStatus.APPROVED,
          processedAt: {
            gte: yearStart,
          },
        },
        select: {
          id: true,
          requesterId: true,
          custody: {
            select: {
              quantity: true,
              itemId: true,
              item: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      }),
      prisma.custodyRecord.count({
        where: {
          status: {
            in: [CustodyStatus.ACTIVE, CustodyStatus.RETURN_REQUESTED, CustodyStatus.OVERDUE],
          },
        },
      }),
      prisma.custodyRecord.findMany({
        where: {
          status: {
            in: [CustodyStatus.ACTIVE, CustodyStatus.RETURN_REQUESTED, CustodyStatus.OVERDUE],
          },
        },
        select: {
          quantity: true,
        },
      }),
    ]);

    const issuedStatuses = new Set<RequestStatus>([RequestStatus.ISSUED, RequestStatus.RETURNED]);

    const issuedRequests = requests.filter((request) => issuedStatuses.has(request.status));
    const returnedRequests = requests.filter((request) => request.status === RequestStatus.RETURNED);
    const pendingRequests = requests.filter((request) => request.status === RequestStatus.PENDING).length;
    const rejectedRequests = requests.filter((request) => request.status === RequestStatus.REJECTED).length;

    let totalIssuedQuantityYTD = 0;
    let totalConsumedQuantityYTD = 0;

    const topConsumedItemsMap = new Map<string, TopItemRow>();
    const topIssuedUsersMap = new Map<string, TopUserRow>();
    const userConsumptionMap = new Map<string, TopUserRow>();

    for (const request of issuedRequests) {
      let requestTotalQty = 0;
      let requestConsumableQty = 0;

      for (const row of request.items) {
        const qty = Number(row.quantity || 0);
        totalIssuedQuantityYTD += qty;
        requestTotalQty += qty;

        if (row.item?.type === ItemType.CONSUMABLE) {
          totalConsumedQuantityYTD += qty;
          requestConsumableQty += qty;

          const currentItem = topConsumedItemsMap.get(row.itemId) || {
            itemId: row.itemId,
            name: row.item?.name || 'مادة',
            code: row.item?.code || '—',
            quantity: 0,
          };

          currentItem.quantity += qty;
          topConsumedItemsMap.set(row.itemId, currentItem);
        }
      }

      if (request.requesterId) {
        const currentUser = topIssuedUsersMap.get(request.requesterId) || {
          userId: request.requesterId,
          fullName: request.requester?.fullName || '—',
          department: request.requester?.department || '—',
          quantity: 0,
        };
        currentUser.quantity += requestTotalQty;
        topIssuedUsersMap.set(request.requesterId, currentUser);

        const consumptionUser = userConsumptionMap.get(request.requesterId) || {
          userId: request.requesterId,
          fullName: request.requester?.fullName || '—',
          department: request.requester?.department || '—',
          quantity: 0,
        };
        consumptionUser.quantity += requestConsumableQty;
        userConsumptionMap.set(request.requesterId, consumptionUser);
      }
    }

    let totalReturnedQuantityYTD = 0;

    for (const returnRow of approvedReturns) {
      totalReturnedQuantityYTD += Number(returnRow.custody?.quantity || 0);
    }

    const healthPercentage =
      totalItems > 0
        ? Math.max(0, Math.round(((totalItems - lowStockItems - outOfStockItems) / totalItems) * 100))
        : 0;

    return {
      totalItems,
      lowStockItems,
      outOfStockItems,
      activeCustody: activeCustodyCount,
      activeCustodyQuantity: activeCustodyQty.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      pendingRequests,
      rejectedRequests,
      totalIssuedRequests: issuedRequests.length,
      totalReturnedRequests: returnedRequests.length,
      totalIssuedQuantityYTD,
      totalConsumedQuantityYTD,
      totalReturnedQuantityYTD,
      healthPercentage,
      topConsumedItems: Array.from(topConsumedItemsMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10),
      topIssuedUsers: Array.from(topIssuedUsersMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10),
      userConsumption: Array.from(userConsumptionMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 20),
    };
  },
};