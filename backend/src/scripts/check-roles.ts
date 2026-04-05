import { configPrisma } from '../utils/config-prisma';

async function main() {
  const roles = await configPrisma.roles.findMany({
    where: { company_id: 30, is_active: true },
    select: { id: true, name: true, code: true, role_type: true, project_id: true },
    orderBy: { name: 'asc' },
  });
  console.log('Roles for company 30 (BNC):');
  for (const r of roles) {
    console.log(`  id: ${r.id} | name: ${r.name} | code: ${r.code} | type: ${r.role_type} | project: ${r.project_id}`);
  }
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
