require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL غير موجود.');
  }

  const requestItemsCount = await prisma.requestItem.count();
  const custodyCount = await prisma.custodyRecord.count();
  const maintenanceCount = await prisma.maintenanceRequest.count();

  if (requestItemsCount > 0 || custodyCount > 0 || maintenanceCount > 0) {
    throw new Error(
      'لا يمكن تصفير المواد الآن لأن هناك بيانات مرتبطة بها (طلبات/عهد/صيانة).'
    );
  }

  const deleted = await prisma.inventoryItem.deleteMany();

  console.log('✅ تم تصفير جدول المواد بنجاح');
  console.log(`🗑️ عدد المواد المحذوفة: ${deleted.count}`);
}

main()
  .catch((error) => {
    console.error('❌ فشل التصفير:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });