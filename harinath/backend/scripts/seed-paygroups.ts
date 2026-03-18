/**
 * Seed paygroups for Associate (Employee) module.
 * Run: npx ts-node -r tsconfig-paths/register scripts/seed-paygroups.ts [organizationId]
 * If organizationId is omitted, seeds for the first organization in the DB.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PAYGROUPS = [
  'Bangalore Staff',
  'BM Staff',
  'BM Worker',
  'Management',
  'Staff',
  'Worker',
];

async function main() {
  const orgId = process.argv[2];
  let organizationId: string;

  if (orgId) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      console.error('Organization not found:', orgId);
      process.exit(1);
    }
    organizationId = orgId;
  } else {
    const first = await prisma.organization.findFirst({ select: { id: true, name: true } });
    if (!first) {
      console.error('No organization found. Create an organization first.');
      process.exit(1);
    }
    organizationId = first.id;
    console.log(`Using organization: ${first.name} (${first.id})`);
  }

  console.log('Seeding paygroups...');
  for (const name of DEFAULT_PAYGROUPS) {
    await prisma.paygroup.upsert({
      where: {
        organizationId_name: { organizationId, name },
      },
      create: { organizationId, name },
      update: {},
    });
    console.log('  ✓', name);
  }
  console.log('Paygroups seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
