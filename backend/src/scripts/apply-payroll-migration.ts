/**
 * Script to manually apply payroll status migration
 * This handles the enum value addition and column updates
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Starting payroll migration...');

    // Step 1: Add enum values (these need to be in separate statements)
    console.log('Adding PROCESSED to enum...');
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "payroll_status" ADD VALUE IF NOT EXISTS 'PROCESSED';
    `);

    console.log('Adding FINALIZED to enum...');
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "payroll_status" ADD VALUE IF NOT EXISTS 'FINALIZED';
    `);

    // Wait a bit for enum values to be committed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Add columns as nullable first
    console.log('Adding payroll_month and payroll_year columns...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "payroll_cycles" 
      ADD COLUMN IF NOT EXISTS "payroll_month" INTEGER,
      ADD COLUMN IF NOT EXISTS "payroll_year" INTEGER;
    `);

    // Step 3: Update existing rows
    console.log('Updating existing rows with calculated values...');
    await prisma.$executeRawUnsafe(`
      UPDATE "payroll_cycles" 
      SET 
        "payroll_month" = EXTRACT(MONTH FROM "period_start")::INTEGER,
        "payroll_year" = EXTRACT(YEAR FROM "period_start")::INTEGER
      WHERE "payroll_month" IS NULL OR "payroll_year" IS NULL;
    `);

    // Step 4: Make columns NOT NULL
    console.log('Making columns NOT NULL...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "payroll_cycles" 
      ALTER COLUMN "payroll_month" SET NOT NULL,
      ALTER COLUMN "payroll_year" SET NOT NULL;
    `);

    // Step 5: Add other new columns
    console.log('Adding other new columns...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "payroll_cycles" 
      ADD COLUMN IF NOT EXISTS "is_locked" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "finalized_by" UUID,
      ADD COLUMN IF NOT EXISTS "finalized_at" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "paid_by" UUID,
      ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);
    `);

    // Step 6: Add unique constraint
    console.log('Adding unique constraint...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'payroll_cycles_organization_id_payroll_month_payroll_year_key'
        ) THEN
          ALTER TABLE "payroll_cycles" 
          ADD CONSTRAINT "payroll_cycles_organization_id_payroll_month_payroll_year_key" 
          UNIQUE ("organization_id", "payroll_month", "payroll_year");
        END IF;
      END $$;
    `);

    // Step 7: Add index
    console.log('Adding index...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "payroll_cycles_organization_id_payroll_year_payroll_month_idx" 
      ON "payroll_cycles"("organization_id", "payroll_year", "payroll_month");
    `);

    // Step 8: Add YTD fields to payslips
    console.log('Adding YTD fields to payslips...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "payslips" 
      ADD COLUMN IF NOT EXISTS "ytd_gross_salary" DECIMAL(15,2),
      ADD COLUMN IF NOT EXISTS "ytd_deductions" DECIMAL(15,2),
      ADD COLUMN IF NOT EXISTS "ytd_net_salary" DECIMAL(15,2),
      ADD COLUMN IF NOT EXISTS "ytd_tax_paid" DECIMAL(15,2);
    `);

    // Step 9: Update any APPROVED status to PROCESSED (now that enum is committed)
    console.log('Updating APPROVED status to PROCESSED...');
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "payroll_cycles" 
      SET "status" = 'PROCESSED'::payroll_status 
      WHERE "status" = 'APPROVED'::payroll_status;
    `);
    console.log(`Updated ${result} rows from APPROVED to PROCESSED`);

    console.log('✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
