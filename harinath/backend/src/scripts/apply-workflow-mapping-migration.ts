/**
 * Script to manually apply workflow mapping migration
 * This creates the workflow_mappings table directly in the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Starting workflow mapping migration...');

    // Check if table already exists
    const tableExists = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'workflow_mappings'
      );
    `);

    if (Array.isArray(tableExists) && tableExists[0]?.exists) {
      console.log('✅ Table workflow_mappings already exists. Skipping migration.');
      return;
    }

    // Step 1: Create the table
    console.log('Creating workflow_mappings table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "workflow_mappings" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL,
        "display_name" VARCHAR(255) NOT NULL,
        "associate" VARCHAR(255),
        "paygroup_id" UUID,
        "department_id" UUID,
        "priority" INTEGER,
        "remarks" TEXT,
        "entry_rights_template" VARCHAR(255),
        "approval_levels" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "workflow_mappings_pkey" PRIMARY KEY ("id")
      );
    `);

    // Step 2: Add foreign key constraints
    console.log('Adding foreign key constraints...');
    
    // Check if constraint already exists before adding
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'workflow_mappings_organization_id_fkey'
        ) THEN
          ALTER TABLE "workflow_mappings" 
          ADD CONSTRAINT "workflow_mappings_organization_id_fkey" 
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
          WHERE conname = 'workflow_mappings_paygroup_id_fkey'
        ) THEN
          ALTER TABLE "workflow_mappings" 
          ADD CONSTRAINT "workflow_mappings_paygroup_id_fkey" 
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
          WHERE conname = 'workflow_mappings_department_id_fkey'
        ) THEN
          ALTER TABLE "workflow_mappings" 
          ADD CONSTRAINT "workflow_mappings_department_id_fkey" 
          FOREIGN KEY ("department_id") 
          REFERENCES "departments"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    // Step 3: Skip trigger creation - Prisma's @updatedAt handles this automatically
    // The trigger is optional and can cause issues with Prisma's prepared statements
    // Prisma will automatically update the updated_at field when records are updated
    console.log('✅ Trigger setup skipped (Prisma handles @updatedAt automatically via @updatedAt decorator)');

    console.log('✅ Workflow mapping migration completed successfully!');
    console.log('✅ Table workflow_mappings created with all constraints.');

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
