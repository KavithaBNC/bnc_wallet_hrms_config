/**
 * Delete B001 employee and associated user (for re-testing import).
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/delete-b001-user.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findFirst({
    where: { employeeCode: 'B001' },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, userId: true },
  });

  if (!emp) {
    console.log('No employee with code B001 found.');
    return;
  }

  console.log(`Found: ${emp.employeeCode} - ${emp.firstName} ${emp.lastName} (${emp.email})`);

  await prisma.$transaction(async (tx) => {
    await tx.employee.delete({ where: { id: emp.id } });
    console.log('  Deleted employee');
    try {
      await tx.user.delete({ where: { id: emp.userId } });
      console.log('  Deleted user');
    } catch (e: any) {
      if (e?.code === 'P2003') console.log('  User already removed or has other refs');
      else throw e;
    }
  });

  console.log('Done. B001 user removed from both tables.');
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
