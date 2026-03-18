/**
 * Clear defaultDaysPerYear from Leave Types that were set to 12 by the map-unmapped script.
 * Run once to reset entitlements so admins can configure them in Leave Management or Auto Credit Setting.
 *
 * Run: npm run clear:hardcoded-leave-entitlements
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.leaveType.updateMany({
    where: { defaultDaysPerYear: 12 },
    data: { defaultDaysPerYear: null },
  });

  if (updated.count === 0) {
    console.log('No Leave Types had defaultDaysPerYear=12. Nothing to clear.');
    return;
  }

  console.log(`Cleared defaultDaysPerYear from ${updated.count} Leave Type(s).`);
  console.log('Configure entitlements in Leave Management (Default Days Per Year) or Auto Credit Setting.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
