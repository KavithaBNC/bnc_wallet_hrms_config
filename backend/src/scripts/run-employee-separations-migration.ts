/**
 * Create employee_separations table and separation_type enum only.
 * Does not drop any existing tables. Safe to run.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/run-employee-separations-migration.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating employee_separations table...');

  // 1. Create enum only if it doesn't exist
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'separation_type') THEN
        CREATE TYPE separation_type AS ENUM (
          'RESIGNATION',
          'TERMINATION',
          'RETIREMENT',
          'CONTRACT_END',
          'ABSONDING',
          'OTHER'
        );
      END IF;
    END $$;
  `);
  console.log('  - separation_type enum created or exists');

  // 2. Create table if not exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS employee_separations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      resignation_apply_date DATE NOT NULL,
      notice_period INTEGER NOT NULL,
      notice_period_reason VARCHAR(255),
      relieving_date DATE NOT NULL,
      reason_of_leaving VARCHAR(255),
      separation_type separation_type NOT NULL,
      remarks TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('  - employee_separations table created or exists');

  // 3. Indexes
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_employee_separations_organization_id ON employee_separations(organization_id);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_employee_separations_employee_id ON employee_separations(employee_id);
  `);
  console.log('  - indexes created or exist');

  console.log('Migration completed successfully.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
