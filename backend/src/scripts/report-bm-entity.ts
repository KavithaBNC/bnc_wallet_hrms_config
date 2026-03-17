import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔎 Reporting BMPL entity / paygroup linkage...\n');

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
      code: true,
      organizationId: true,
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  if (!paygroups.length) {
    console.log('No paygroups named "BM Staff" or "BM Worker" found.');
    return;
  }

  for (const pg of paygroups) {
    const orgName = pg.organization?.name ?? pg.organizationId;
    console.log(`\n📌 Organization: ${orgName} (${pg.organizationId})`);
    console.log(`   Paygroup: ${pg.name} (${pg.code ?? 'no code'}) [${pg.id}]`);

    const bmEntity = await prisma.entity.findFirst({
      where: {
        organizationId: pg.organizationId,
        name: { equals: 'BMPL', mode: 'insensitive' } as any,
      },
      select: { id: true, name: true, code: true },
    });

    if (!bmEntity) {
      console.log('   ⚠️ No BMPL entity found for this organization.');
      continue;
    }

    const countUnderBMPL = await prisma.employee.count({
      where: {
        organizationId: pg.organizationId,
        paygroupId: pg.id,
        entityId: bmEntity.id,
      },
    });

    const countOtherEntity = await prisma.employee.count({
      where: {
        organizationId: pg.organizationId,
        paygroupId: pg.id,
        NOT: { entityId: bmEntity.id },
      },
    });

    console.log(
      `   BMPL entity: ${bmEntity.name} (${bmEntity.code ?? ''}) [${bmEntity.id}]`,
    );
    console.log(`   Employees in this paygroup with entity = BMPL   : ${countUnderBMPL}`);
    console.log(`   Employees in this paygroup with other / no entity: ${countOtherEntity}`);
  }

  console.log('\n✅ Done.');
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

