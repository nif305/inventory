require('dotenv').config();
const { PrismaClient, Role, Status } = require('@prisma/client');

const prisma = new PrismaClient();

const coreUsers = [
  {
    employeeId: '239',
    fullName: 'نايف الشهراني',
    email: 'nalshahrani@nauss.edu.sa',
    mobile: '0568122221',
    department: 'وكالة التدريب',
    jobTitle: 'مدير إدارة عمليات التدريب',
    passwordHash: 'local-auth',
    roles: [Role.USER, Role.MANAGER, Role.WAREHOUSE],
    status: Status.ACTIVE,
  },
  {
    employeeId: '1002',
    fullName: 'نواف المحارب',
    email: 'wa.n1@nauss.edu.sa',
    mobile: '0500000002',
    department: 'المستودع',
    jobTitle: 'مسؤول مخزن',
    passwordHash: 'local-auth',
    roles: [Role.USER, Role.WAREHOUSE],
    status: Status.ACTIVE,
  },
];

async function main() {
  for (const user of coreUsers) {
    const saved = await prisma.user.upsert({
      where: { email: user.email.toLowerCase() },
      update: {
        employeeId: user.employeeId,
        fullName: user.fullName,
        mobile: user.mobile,
        department: user.department,
        jobTitle: user.jobTitle,
        passwordHash: user.passwordHash,
        roles: user.roles,
        status: user.status,
      },
      create: {
        employeeId: user.employeeId,
        fullName: user.fullName,
        email: user.email.toLowerCase(),
        mobile: user.mobile,
        department: user.department,
        jobTitle: user.jobTitle,
        passwordHash: user.passwordHash,
        roles: user.roles,
        status: user.status,
      },
    });

    await prisma.undertaking.upsert({
      where: { userId: saved.id },
      update: {
        accepted: true,
        acceptedAt: new Date(),
        version: '1.0',
      },
      create: {
        userId: saved.id,
        accepted: true,
        acceptedAt: new Date(),
        version: '1.0',
      },
    });
  }

  console.log('✅ core users seeded safely');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
