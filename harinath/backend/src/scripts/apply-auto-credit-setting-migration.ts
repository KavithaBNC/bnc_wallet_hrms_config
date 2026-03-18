/**
 * Script to create auto_credit_settings table
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Starting auto credit setting migration...');

    const tableExists = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auto_credit_settings'
      );
    `);

    if (Array.isArray(tableExists) && tableExists[0]?.exists) {
      console.log('✅ Table auto_credit_settings already exists. Skipping migration.');
      return;
    }

    console.log('Creating auto_credit_settings table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "auto_credit_settings" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" UUID NOT NULL,
        "event_type" VARCHAR(100) NOT NULL,
        "display_name" VARCHAR(255) NOT NULL,
        "associate" VARCHAR(255),
        "paygroup_id" UUID,
        "department_id" UUID,
        "condition" TEXT,
        "effective_date" DATE NOT NULL,
        "priority" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "auto_credit_settings_pkey" PRIMARY KEY ("id")
      );
    `);

    console.log('Adding foreign key constraints...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'auto_credit_settings_organization_id_fkey'
        ) THEN
          ALTER TABLE "auto_credit_settings" 
          ADD CONSTRAINT "auto_credit_settings_organization_id_fkey" 
          FOREIGN KEY ("organization_id") 
          REFERENCES "organizations"("id") 
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'auto_credit_settings_paygroup_id_fkey'
        ) THEN
          ALTER TABLE "auto_credit_settings" 
          ADD CONSTRAINT "auto_credit_settings_paygroup_id_fkey" 
          FOREIGN KEY ("paygroup_id") 
          REFERENCES "paygroups"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'auto_credit_settings_department_id_fkey'
        ) THEN
          ALTER TABLE "auto_credit_settings" 
          ADD CONSTRAINT "auto_credit_settings_department_id_fkey" 
          FOREIGN KEY ("department_id") 
          REFERENCES "departments"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    console.log('✅ Auto credit setting migration completed successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('\n✅ Migration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
