/**
 * Remove orphan migration record from _prisma_migrations so migrate deploy can proceed.
 * The DB may have a row for 20260209132441_add_excess_hours_tables but that migration file no longer exists.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/fix-orphan-migration.ts
 * Then: npx prisma migrate deploy
 */

import { prisma } from '../utils/prisma';

const ORPHAN_MIGRATION_NAME = '20260209132441_add_excess_hours_tables';

async function main() {
  const found = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '${ORPHAN_MIGRATION_NAME}' OR migration_name LIKE '%excess_hours%'`
  );
  if (!found || found.length === 0) {
    const all = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name FROM "_prisma_migrations"`
    );
    console.log('No orphan row found for', ORPHAN_MIGRATION_NAME);
    console.log('Total rows in _prisma_migrations:', all?.length ?? 0);
    console.log('If deploy still fails, run the SQL manually in RDS Query Editor:');
    console.log(`  DELETE FROM "_prisma_migrations" WHERE migration_name = '${ORPHAN_MIGRATION_NAME}';`);
    return;
  }
  console.log('Found orphan record(s):', found.map((r) => r.migration_name));
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM "_prisma_migrations" WHERE migration_name = '${ORPHAN_MIGRATION_NAME}'`
  );
  console.log('Deleted', result, 'row(s). Next: npx prisma migrate deploy');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
