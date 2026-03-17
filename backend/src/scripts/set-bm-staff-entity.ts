/**
 * One-time/migration script:
 * Ensure all employees with paygroup "BM Staff" or "BM Worker"
 * are linked to the "BMPL" entity (force-set entity for those paygroups).
 *
 * Usage:
 *   npm run fix:bm-staff-entity
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Looking up organizations with paygroup "BM Staff" / "BM Worker"...');

  const paygroups = await prisma.paygroup.findMany({
    where: {
      name: {
        in: ['BM Staff', 'BM staff', 'BM STAFF', 'BM Worker', 'BM worker', 'BM WORKER'],
        mode: 'insensitive',
      } as any,
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  });

  if (!paygroups.length) {
    console.log('No paygroups named "BM Staff" / "BM Worker" found. Nothing to do.');
    return;
  }

  for (const pg of paygroups) {
    const orgName = pg.organization?.name ?? pg.organizationId;
    console.log(`\nProcessing organization: ${orgName} (${pg.organizationId}) for paygroup ${pg.name}`);

    const bmEntity = await prisma.entity.upsert({
      where: {
        organizationId_name: {
          organizationId: pg.organizationId,
          name: 'BMPL',
        },
      },
      update: {},
      create: {
        organizationId: pg.organizationId,
        name: 'BMPL',
        code: 'BMPL',
      },
    });

    const result = await prisma.employee.updateMany({
      where: {
        organizationId: pg.organizationId,
        paygroupId: pg.id,
      },
      data: {
        entityId: bmEntity.id,
      },
    });

    console.log(
      `  Linked ${result.count} employee(s) with paygroup "${pg.name}" to entity "BMPL" (entityId=${bmEntity.id}).`,
    );
  }

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

