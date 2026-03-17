import { PrismaClient, ItemStatus } from '@prisma/client';
const prisma = new PrismaClient();
export const AlertService = {
  checkLowStock: async () => {
    const allItems = await prisma.inventoryItem.findMany();
    const lowStockItems = allItems.filter((item) => item.availableQty <= item.minStock);
    const managersAndWarehouse = await prisma.user.findMany({ where: { role: { in: ['MANAGER', 'WAREHOUSE'] }, status: 'ACTIVE' } });
    for (const item of lowStockItems) {
      const nextStatus = item.availableQty <= 0 ? ItemStatus.OUT_OF_STOCK : ItemStatus.LOW_STOCK;
      await prisma.inventoryItem.update({ where: { id: item.id }, data: { status: nextStatus } });
      for (const user of managersAndWarehouse) {
        const existing = await prisma.notification.findFirst({ where: { userId: user.id, entityId: item.id, type: 'LOW_STOCK', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
        if (!existing) await prisma.notification.create({ data: { userId: user.id, type: 'LOW_STOCK', title: 'تنبيه نفاد مخزون', message: `الصنف "${item.name}" وصل للحد الأدنى (${item.availableQty} متاح)`, link: `/inventory/${item.id}`, entityId: item.id, entityType: 'INVENTORY_ITEM' } });
      }
    }
    return lowStockItems;
  },
  checkMaintenanceNeeds: async () => []
};
