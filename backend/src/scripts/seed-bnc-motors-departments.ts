/**
 * Seed departments for BNC Motors organization.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/seed-bnc-motors-departments.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const ORG_ID = '26d9d4ff-aab0-4e52-ae02-dba5d455ced4';

const DEPARTMENTS: { name: string; code: string }[] = [
  { name: 'Administration', code: 'ADMIN' },
  { name: 'Admin', code: 'ADM' },
  { name: 'Battery Plant', code: 'BATTERY_PLANT' },
  { name: 'Battery Production', code: 'BATTERY_PROD' },
  { name: 'Battery QA', code: 'BATTERY_QA' },
  { name: 'CRM', code: 'CRM' },
  { name: 'Dispatch', code: 'DISPATCH' },
  { name: 'ERP', code: 'ERP' },
  { name: 'Fabrication', code: 'FABRICATION' },
  { name: 'Finance & Accounts', code: 'FIN_ACCOUNTS' },
  { name: 'Finance Department', code: 'FIN_DEPT' },
  { name: 'HR', code: 'HR_BNC' },
  { name: 'IT', code: 'IT_BNC' },
  { name: 'Management', code: 'MGMT' },
  { name: 'Maintenance Department', code: 'MAINTENANCE' },
  { name: 'Marketing', code: 'MARKETING' },
  { name: 'Marketing & Sales', code: 'MKTG_SALES' },
  { name: 'NEMI', code: 'NEMI' },
  { name: 'NPD', code: 'NPD' },
  { name: 'Operation', code: 'OPERATION' },
  { name: 'Operations', code: 'OPERATIONS' },
  { name: 'PPC', code: 'PPC' },
  { name: 'PED', code: 'PED' },
  { name: 'Production', code: 'PRODUCTION' },
  { name: 'Program Management', code: 'PROG_MGMT' },
  { name: 'QA', code: 'QA' },
  { name: 'R & D', code: 'RND' },
  { name: 'Sales', code: 'SALES_BNC' },
  { name: 'SCM', code: 'SCM' },
  { name: 'Service', code: 'SERVICE' },
  { name: 'Stores Department', code: 'STORES_DEPT' },
  { name: 'STORES', code: 'STORES' },
];

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: { id: true, name: true },
  });

  if (!org) {
    console.error(`Organization ${ORG_ID} (BNC Motors) not found.`);
    process.exit(1);
  }

  console.log(`Seeding departments for: ${org.name} (${org.id})\n`);

  let created = 0;
  let skipped = 0;

  for (const { name, code } of DEPARTMENTS) {
    const existing = await prisma.department.findFirst({
      where: { organizationId: ORG_ID, name },
    });

    if (existing) {
      console.log(`⏭️  Skipped (exists): ${name} [${code}]`);
      skipped++;
      continue;
    }

    try {
      await prisma.department.create({
        data: {
          organizationId: ORG_ID,
          name,
          code,
          isActive: true,
        },
      });
      console.log(`✅ Created: ${name} [${code}]`);
      created++;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        console.log(`⏭️  Skipped (code conflict): ${name} [${code}]`);
        skipped++;
      } else {
        console.error(`❌ Failed: ${name} - ${err?.message || err}`);
      }
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
