/**
 * Add remarks, effective_to, auto_credit_rule to auto_credit_settings
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    const columns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'auto_credit_settings'
    `);
    const names = columns.map((c) => c.column_name);

    if (!names.includes('remarks')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "auto_credit_settings" ADD COLUMN IF NOT EXISTS "remarks" TEXT;`);
      console.log('✅ Added remarks');
    }
    if (!names.includes('effective_to')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "auto_credit_settings" ADD COLUMN IF NOT EXISTS "effective_to" DATE;`);
      console.log('✅ Added effective_to');
    }
    if (!names.includes('auto_credit_rule')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "auto_credit_settings" ADD COLUMN IF NOT EXISTS "auto_credit_rule" JSONB;`);
      console.log('✅ Added auto_credit_rule');
    }
    console.log('✅ Migration completed');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
