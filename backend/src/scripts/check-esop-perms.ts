import { prisma } from '../utils/prisma';

async function main() {
  const perms = await (prisma as any).permission.findMany({
    where: { resource: { startsWith: 'esop' } },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  console.log('ESOP permissions in DB:');
  perms.forEach((p: any) => console.log(' -', p.name));
  console.log('Total:', perms.length);
  await (prisma as any).$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
