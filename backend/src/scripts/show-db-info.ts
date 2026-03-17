/**
 * Show which PostgreSQL DB this process is connected to.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/show-db-info.ts
 */
import { prisma } from '../utils/prisma';

type DbInfoRow = {
  current_database: string;
  current_schema: string;
  current_user: string;
  server_addr: string | null;
  server_port: number | null;
  version: string;
};

async function main() {
  const rows = await prisma.$queryRaw<
    DbInfoRow[]
  >`select
      current_database() as current_database,
      current_schema() as current_schema,
      current_user as current_user,
      inet_server_addr()::text as server_addr,
      inet_server_port() as server_port,
      version() as version`;

  const r = rows[0];
  console.log('DB connection info (from Prisma):');
  console.log('  database:', r.current_database);
  console.log('  schema  :', r.current_schema);
  console.log('  user    :', r.current_user);
  console.log('  host    :', r.server_addr ?? '(unknown)');
  console.log('  port    :', r.server_port ?? '(unknown)');
  console.log('  version :', r.version.split('\n')[0]);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

