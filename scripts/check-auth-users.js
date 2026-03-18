require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const updates = [
    { email: 'omair@nauss.edu.sa', passwordHash: 'admin123' },
    { email: 'user1@nauss.edu.sa', passwordHash: 'admin123' },
    { email: 'nmuharib@nauss.edu.sa', passwordHash: 'admin123' },
  ];

  for (const item of updates) {
    await prisma.user.updateMany({
      where: { email: item.email.toLowerCase() },
      data: { passwordHash: item.passwordHash },
    });
  }

  console.log('✅ passwords fixed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });