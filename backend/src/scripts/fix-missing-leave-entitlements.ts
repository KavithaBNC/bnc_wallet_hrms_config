/**
 * Fix missing leave entitlements for configured Leave events.
 *
 * Default mappings applied when defaultDaysPerYear is null:
 * - Marriage Leave: 5
 * - Paternity Leave: 5
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/scripts/fix-missing-leave-entitlements.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targets = [
    { names: ['Marriage Leave'], days: 5 },
    { names: ['Paternity Leave'], days: 5 },
  ];

  const results: Array<{ name: string; updated: number }> = [];

  for (const t of targets) {
    const update = await prisma.leaveType.updateMany({
      where: {
        name: { in: t.names },
        defaultDaysPerYear: null,
        isActive: true,
      },
      data: {
        defaultDaysPerYear: t.days,
      },
    });
    results.push({ name: t.names.join(', '), updated: update.count });
  }

  console.log('Leave entitlement fix completed.');
  for (const r of results) {
    console.log(`- ${r.name}: updated ${r.updated} row(s)`);
  }
}

main()
  .catch((e) => {
    console.error('Failed to fix entitlements:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

