const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('⏳ بدء حذف البيانات التجريبية...');

  await prisma.notification.deleteMany({});
  console.log('✅ تم حذف الإشعارات');

  await prisma.internalMessage.deleteMany({});
  console.log('✅ تم حذف المراسلات الداخلية');

  await prisma.returnRequest.deleteMany({});
  console.log('✅ تم حذف طلبات الإرجاع');

  await prisma.custodyRecord.deleteMany({});
  console.log('✅ تم حذف العهد');

  await prisma.requestItem.deleteMany({});
  console.log('✅ تم حذف عناصر الطلبات');

  await prisma.request.deleteMany({});
  console.log('✅ تم حذف طلبات المواد');

  await prisma.auditLog.deleteMany({});
  console.log('✅ تم حذف السجلات غير الحقيقية');

  console.log('✅ اكتمل الحذف بدون المساس بمواد المخزون المعتمدة');
}

main()
  .catch((error) => {
    console.error('❌ فشل الحذف:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });