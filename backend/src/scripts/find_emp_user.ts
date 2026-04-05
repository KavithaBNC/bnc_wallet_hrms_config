import { configPrisma } from '../utils/config-prisma';
import { prisma } from '../utils/prisma';

async function main() {
  // Search HRMS DB for the user
  const hrmsUser = await prisma.user.findFirst({
    where: { email: { contains: 'kavisathish', mode: 'insensitive' } },
    select: { id: true, email: true, role: true, isActive: true, configuratorUserId: true }
  });
  console.log('HRMS user:', JSON.stringify(hrmsUser));

  // Search by all emails to find employee
  const allUsers = await prisma.user.findMany({
    where: { organizationId: 'ecbe16ad-8971-4ab6-b4c9-fa38e91522b7' },
    select: { id: true, email: true, role: true, isActive: true, configuratorUserId: true },
    take: 20
  });
  console.log('All org users count:', allUsers.length);
  for (const u of allUsers) {
    if (u.role === 'EMPLOYEE') console.log('EMP:', JSON.stringify(u));
  }

  await prisma.$disconnect();
  await configPrisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
