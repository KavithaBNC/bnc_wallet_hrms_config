/**
 * Seed one department and one sub-department for the first organization.
 * Run after migration: npm run migrate:sub-department (or run-first.sql)
 * Usage: npm run seed:dept-subdept
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('No organization found. Run prisma seed first.');
    process.exit(1);
  }

  // One department (by code OPS)
  let department = await prisma.department.findFirst({
    where: { organizationId: org.id, code: 'OPS' },
  });
  if (!department) {
    department = await prisma.department.create({
      data: {
        organizationId: org.id,
        name: 'Operations',
        code: 'OPS',
        description: 'Operations Department',
        isActive: true,
      },
    });
  }
  console.log(`✅ Department: ${department.name} (${department.code})`);

  // One sub-department (requires sub_departments table from migration)
  const subDept = await prisma.subDepartment.upsert({
    where: {
      organizationId_name: { organizationId: org.id, name: 'HR Operations' },
    },
    create: {
      organizationId: org.id,
      name: 'HR Operations',
      isActive: true,
    },
    update: {},
  });
  console.log(`✅ Sub-department: ${subDept.name}`);

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e.message);
    if (e.message?.includes('sub_departments') || e.message?.includes('does not exist')) {
      console.error('Run the migration first: npm run migrate:sub-department');
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
