/**
 * Set "Default Org" employee ID suffix to 4000 and prefix to empty.
 * Next employee created in Default Org will get 4000, then 4001, 4002, ...
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/set-default-org-employee-id-4000.ts
 */

import { prisma } from '../utils/prisma';

const ORG_NAME = 'Default Org';
const NEXT_NUMBER = 4000;

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
    select: { id: true, name: true, employeeIdPrefix: true, employeeIdNextNumber: true },
  });

  if (!org) {
    console.log(`Organization "${ORG_NAME}" not found. No change made.`);
    return;
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      employeeIdPrefix: null,
      employeeIdNextNumber: NEXT_NUMBER,
    },
  });

  console.log(`✅ ${ORG_NAME}: suffix (Next Number) set to ${NEXT_NUMBER}, prefix cleared.`);
  console.log(`   Next employee created in this org will get ID: ${NEXT_NUMBER}, then ${NEXT_NUMBER + 1}, ${NEXT_NUMBER + 2}, ...`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
