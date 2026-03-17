import { CustodyStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const CustodyService = {
  getAll: async ({
    userId,
    role,
    page = 1,
    limit = 50,
    status,
  }: {
    userId: string;
    role: string;
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const skip = (page - 1) * limit;
    const normalizedRole = String(role || '').toUpperCase();

    const where = {
      AND: [
        normalizedRole === 'USER' ? { userId } : {},
        status ? { status: status as CustodyStatus } : {},
      ],
    };

    const [records, total] = await Promise.all([
      prisma.custodyRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              fullName: true,
              department: true,
            },
          },
          item: {
            select: {
              name: true,
              code: true,
            },
          },
          returnRequests: {
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              id: true,
              code: true,
              status: true,
              conditionNote: true,
              rejectionReason: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          issueDate: 'desc',
        },
      }),
      prisma.custodyRecord.count({ where }),
    ]);

    return {
      data: records,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getStats: async () => {
    const [active, overdue, returned, total] = await Promise.all([
      prisma.custodyRecord.count({
        where: { status: CustodyStatus.ACTIVE },
      }),
      prisma.custodyRecord.count({
        where: { status: CustodyStatus.OVERDUE },
      }),
      prisma.custodyRecord.count({
        where: { status: CustodyStatus.RETURNED },
      }),
      prisma.custodyRecord.count(),
    ]);

    return {
      active,
      overdue,
      returned,
      total,
    };
  },
};