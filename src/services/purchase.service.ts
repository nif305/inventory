import { PrismaClient, PurchaseStatus } from '@prisma/client';
const prisma = new PrismaClient();
export const PurchaseService = {
  create: async (data: { requesterId: string; items: string; reason: string; budgetNote?: string; estimatedValue?: number; }) => {
    const count = await prisma.purchaseRequest.count();
    const code = `PUR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    return prisma.purchaseRequest.create({ data: { ...data, code, status: PurchaseStatus.PENDING } });
  },
  getAll: async ({ userId, role, page = 1, limit = 10, status }: any) => {
    const skip = (page - 1) * limit;
    const where = { AND: [role === 'USER' ? { requesterId: userId } : {}, status ? { status: status as PurchaseStatus } : {}] };
    const [requests, total] = await Promise.all([prisma.purchaseRequest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }), prisma.purchaseRequest.count({ where })]);
    return { data: requests, pagination: { total, page, totalPages: Math.ceil(total / limit) } };
  },
  updateStatus: async (id: string, status: PurchaseStatus) => prisma.purchaseRequest.update({ where: { id }, data: { status } })
};
