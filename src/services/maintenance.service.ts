import { PrismaClient, MaintenanceStatus, Priority } from '@prisma/client';
const prisma = new PrismaClient();
export const MaintenanceService = {
  create: async (data: { requesterId: string; itemId?: string; category: string; description: string; priority: Priority; notes?: string; }) => {
    const count = await prisma.maintenanceRequest.count();
    const code = `MNT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const request = await prisma.maintenanceRequest.create({ data: { ...data, code, status: MaintenanceStatus.PENDING }, include: { item: true } });
    await prisma.auditLog.create({ data: { userId: data.requesterId, action: 'CREATE_MAINTENANCE', entity: 'MaintenanceRequest', entityId: request.id, details: JSON.stringify({ code: request.code }) } });
    return request;
  },
  getAll: async ({ userId, role, page = 1, limit = 10, status }: any) => {
    const skip = (page - 1) * limit;
    const where = { AND: [role === 'USER' ? { requesterId: userId } : {}, status ? { status: status as MaintenanceStatus } : {}] };
    const [requests, total] = await Promise.all([prisma.maintenanceRequest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }), prisma.maintenanceRequest.count({ where })]);
    return { data: requests, pagination: { total, page, totalPages: Math.ceil(total / limit) } };
  },
  updateStatus: async (id: string, status: MaintenanceStatus, managerId: string) => prisma.maintenanceRequest.update({ where: { id }, data: { status, updatedAt: new Date(), notes: `Updated by ${managerId}` } })
};
