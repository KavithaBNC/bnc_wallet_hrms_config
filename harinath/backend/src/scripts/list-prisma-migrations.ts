import { prisma } from '../utils/prisma';

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at`
  );
  console.log('Migrations in DB:', rows?.length ?? 0);
  rows?.forEach((r) => console.log(' ', r.migration_name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
