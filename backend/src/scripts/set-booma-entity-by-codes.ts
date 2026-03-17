import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Associate codes that should come under "Booma Motors" entity
const ASSOCIATE_CODES = [
  'B863',
  'B841',
  'B864',
  'B826',
  'B827',
  'B861',
  'B866',
  'B828',
  'B865',
  'B862',
  'B829',
  'B842',
  'B832',
  'B834',
  'B867',
  'B839',
  'B858',
  'B830',
  'B831',
  'B835',
  'B860',
  'B878',
  'B893',
  'B895',
];

async function main() {
  console.log('🔧 Setting Booma Motors entity for selected associate codes...\n');

  const employees = await prisma.employee.findMany({
    where: {
      employeeCode: { in: ASSOCIATE_CODES },
    },
    select: {
      id: true,
      employeeCode: true,
      organizationId: true,
      entityId: true,
      organization: { select: { name: true } },
    },
  });

  if (!employees.length) {
    console.log('No employees found for the given associate codes.');
    return;
  }

  console.log(`Found ${employees.length} employees for the given codes.`);

  // Group employees by organization so we can create/find entity per org
  const byOrg = new Map<string, typeof employees>();
  for (const emp of employees) {
    const list = byOrg.get(emp.organizationId) ?? [];
    list.push(emp);
    byOrg.set(emp.organizationId, list);
  }

  for (const [orgId, orgEmployees] of byOrg.entries()) {
    const orgName = orgEmployees[0]?.organization?.name ?? orgId;
    console.log(`\n📌 Organization: ${orgName} (${orgId})`);

    const boomaEntity = await prisma.entity.upsert({
      where: {
        organizationId_name: {
          organizationId: orgId,
          name: 'Booma Motors',
        },
      },
      update: {},
      create: {
        organizationId: orgId,
        name: 'Booma Motors',
        code: 'BOOMA',
      },
    });

    const result = await prisma.employee.updateMany({
      where: {
        id: { in: orgEmployees.map((e) => e.id) },
      },
      data: {
        entityId: boomaEntity.id,
      },
    });

    console.log(
      `  Updated ${result.count} employee(s) to entity "Booma Motors" (entityId=${boomaEntity.id}).`,
    );
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

