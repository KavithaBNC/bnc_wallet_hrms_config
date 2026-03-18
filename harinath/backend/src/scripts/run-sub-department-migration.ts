/**
 * Run the sub_department migration manually.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/run-sub-department-migration.ts
 * Or: npm run prisma:migrate (if you use Prisma migrations)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running sub_department migration...');

  // 1. Create sub_departments table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "sub_departments" (
      "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
      "organization_id" UUID NOT NULL,
      "name" VARCHAR(255) NOT NULL,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "sub_departments_pkey" PRIMARY KEY ("id")
    );
  `);
  console.log('  - sub_departments table created or exists');

  // 2. Unique constraint (ignore if exists)
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "sub_departments_organization_id_name_key"
      ON "sub_departments"("organization_id", "name");
    `);
  } catch (e: any) {
    if (!e.message?.includes('already exists')) throw e;
  }

  // 3. FK to organizations
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "sub_departments"
      ADD CONSTRAINT "sub_departments_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  } catch (e: any) {
    if (!e.message?.includes('already exists')) throw e;
  }

  // 4. Add column to employees (IF NOT EXISTS for PostgreSQL 9.5+)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "sub_department_id" UUID;
  `);
  console.log('  - employees.sub_department_id column added or exists');

  // 5. FK from employees to sub_departments
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "employees"
      ADD CONSTRAINT "employees_sub_department_id_fkey"
      FOREIGN KEY ("sub_department_id") REFERENCES "sub_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
  } catch (e: any) {
    if (!e.message?.includes('already exists')) throw e;
  }

  console.log('Migration completed successfully.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
