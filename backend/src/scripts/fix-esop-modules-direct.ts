import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: [] }); // no logging

const ESOP_SUBMODULES = ['esop_pools', 'esop_vesting_plans', 'esop_grants', 'esop_vesting_schedules', 'esop_exercise_requests', 'esop_ledger'];

async function main() {
  // Find all orgs with 'esop' in organization_modules
  const esopOrgs = await prisma.$queryRaw<Array<{ organization_id: string }>>`
    SELECT DISTINCT organization_id FROM organization_modules WHERE resource = 'esop'
  `;
  console.log(`Found ${esopOrgs.length} orgs with esop module.`);

  for (const { organization_id } of esopOrgs) {
    for (const resource of ESOP_SUBMODULES) {
      await prisma.$executeRaw`
        INSERT INTO organization_modules (id, organization_id, resource, created_at)
        SELECT uuid_generate_v4(), ${organization_id}::uuid, ${resource}, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM organization_modules
          WHERE organization_id = ${organization_id}::uuid AND resource = ${resource}
        )
      `;
    }
    console.log(`Org ${organization_id}: ESOP sub-modules added.`);
  }

  // Also update ORG_ADMIN role permissions to include esop sub-module permission IDs
  const esopSubPerms = await prisma.permission.findMany({
    where: { resource: { in: ESOP_SUBMODULES }, action: { in: ['read', 'create', 'update'] } },
    select: { id: true, resource: true },
  });

  for (const { organization_id } of esopOrgs) {
    // Get existing ORG_ADMIN permission IDs for this org
    const existing = await prisma.rolePermission.findMany({
      where: { role: 'ORG_ADMIN', organizationId: organization_id },
      select: { permissionId: true },
    });
    const existingIds = new Set(existing.map((r) => r.permissionId));
    const toAdd = esopSubPerms.filter((p) => !existingIds.has(p.id));

    for (const perm of toAdd) {
      await prisma.rolePermission.create({
        data: { role: 'ORG_ADMIN', permissionId: perm.id, organizationId: organization_id },
      }).catch(() => {}); // ignore duplicates
    }
    console.log(`Org ${organization_id}: added ${toAdd.length} ORG_ADMIN permissions for ESOP sub-modules.`);
  }

  console.log('Done.');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
