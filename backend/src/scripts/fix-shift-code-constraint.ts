/**
 * Fix shift code constraint: change from global unique (code) to per-organization unique (organization_id, code)
 * Run when migrations are blocked: npm run fix:shift-constraint
 *
 * This allows each organization to have its own shift codes (e.g. "GS" for multiple companies).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixShiftConstraint() {
  try {
    console.log('Fixing shift code constraint (code → organization_id + code)...');

    // 1. Drop old global unique constraint on code
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "shifts" DROP CONSTRAINT IF EXISTS "shifts_code_key";
    `);
    console.log('  ✓ Dropped old constraint shifts_code_key (if it existed)');

    // 2. Add composite unique index (organization_id, code)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "shifts_organization_id_code_key"
        ON "shifts"("organization_id", "code");
    `);
    console.log('  ✓ Created composite unique index (organization_id, code)');

    console.log('\n✅ Shift code constraint fixed successfully!');
    console.log('   Each organization can now have its own shift codes (e.g. "GS").');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixShiftConstraint()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
