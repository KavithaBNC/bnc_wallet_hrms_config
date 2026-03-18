/**
 * Set "Loss of Pay" leave type to unpaid (isPaid = false)
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/set-lop-leave-type-unpaid.ts
 */
import { prisma } from '../utils/prisma';

async function main() {
  console.log('\n=== Set LOP Leave Type to Unpaid ===\n');

  const lopLeaveTypes = await prisma.leaveType.findMany({
    where: {
      OR: [
        { name: { contains: 'Loss of Pay', mode: 'insensitive' } },
        { code: { equals: 'LOP', mode: 'insensitive' } },
      ],
    },
    include: { organization: { select: { name: true } } },
  });

  if (lopLeaveTypes.length === 0) {
    console.log('No "Loss of Pay" leave type found. Create one first.');
    await prisma.$disconnect();
    return;
  }

  for (const lt of lopLeaveTypes) {
    if (lt.isPaid) {
      await prisma.leaveType.update({
        where: { id: lt.id },
        data: { isPaid: false },
      });
      console.log(`✅ Updated: ${lt.name} (${lt.code || 'N/A'}) - Org: ${lt.organization.name} → isPaid = false`);
    } else {
      console.log(`ℹ️ Already unpaid: ${lt.name} (${lt.code || 'N/A'}) - Org: ${lt.organization.name}`);
    }
  }

  console.log('\nDone.\n');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
