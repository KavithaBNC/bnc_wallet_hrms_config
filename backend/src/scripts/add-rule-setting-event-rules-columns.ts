/**
 * Script to add remarks and event_rule_definition columns to rule_settings table
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Adding remarks and event_rule_definition columns to rule_settings...');

    const columns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'rule_settings'
    `);
    const columnNames = columns.map((c) => c.column_name);

    if (!columnNames.includes('remarks')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "rule_settings" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
      `);
      console.log('✅ Added remarks column');
    } else {
      console.log('⏭️ remarks column already exists');
    }

    if (!columnNames.includes('event_rule_definition')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "rule_settings" ADD COLUMN IF NOT EXISTS "event_rule_definition" JSONB;
      `);
      console.log('✅ Added event_rule_definition column');
    } else {
      console.log('⏭️ event_rule_definition column already exists');
    }

    console.log('✅ Migration completed successfully!');
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
