const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const KEEP_EMAILS = [
  'nalshahrani@nauss.edu.sa',
  'wa.n1@nauss.edu.sa',
];

async function main() {
  console.log('⏳ بدء التصفير التشغيلي...');

  const usersToDelete = await prisma.user.findMany({
    where: {
      email: {
        notIn: KEEP_EMAILS,
        mode: 'insensitive',
      },
    },
    select: { id: true, email: true, fullName: true },
  });

  const deleteUserIds = usersToDelete.map((u) => u.id);

  await prisma.notification.deleteMany({});
  console.log('✅ تم حذف الإشعارات');

  await prisma.internalMessage.deleteMany({});
  console.log('✅ تم حذف المراسلات الداخلية');

  await prisma.emailDraft.deleteMany({});
  console.log('✅ تم حذف مسودات البريد');

  await prisma.returnRequest.deleteMany({});
  console.log('✅ تم حذف طلبات الإرجاع');

  await prisma.custodyRecord.deleteMany({});
  console.log('✅ تم حذف العهد');

  await prisma.requestItem.deleteMany({});
  console.log('✅ تم حذف عناصر الطلبات');

  await prisma.request.deleteMany({});
  console.log('✅ تم حذف طلبات المواد');

  await prisma.maintenanceRequest.deleteMany({});
  console.log('✅ تم حذف طلبات الصيانة');

  await prisma.purchaseRequest.deleteMany({});
  console.log('✅ تم حذف طلبات الشراء المباشر');

  await prisma.suggestion.deleteMany({});
  console.log('✅ تم حذف الطلبات الأخرى والنظافة');

  await prisma.auditLog.deleteMany({});
  console.log('✅ تم حذف سجلات التدقيق');

  if (deleteUserIds.length > 0) {
    await prisma.undertaking.deleteMany({
      where: {
        userId: { in: deleteUserIds },
      },
    });
    console.log('✅ تم حذف التعهدات المرتبطة بالمستخدمين التجريبيين');

    await prisma.user.deleteMany({
      where: {
        id: { in: deleteUserIds },
      },
    });
    console.log('✅ تم حذف المستخدمين التجريبيين');
  } else {
    console.log('ℹ️ لا يوجد مستخدمون إضافيون للحذف');
  }

  const keptUsers = await prisma.user.findMany({
    where: {
      email: {
        in: KEEP_EMAILS,
        mode: 'insensitive',
      },
    },
    select: {
      fullName: true,
      email: true,
      roles: true,
      status: true,
    },
  });

  console.log('✅ اكتمل التصفير بنجاح');
  console.log('👤 الحسابات المتبقية:');
  console.table(keptUsers);
}

main()
  .catch((error) => {
    console.error('❌ فشل التصفير:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });