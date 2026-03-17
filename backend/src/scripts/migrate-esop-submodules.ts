/**
 * One-time migration: add ESOP sub-module resources to all orgs that have 'esop' enabled.
 * Also updates ORG_ADMIN role permissions for those orgs to include the new sub-modules.
 */
import { prisma } from '../utils/prisma';
import { organizationModuleService } from '../services/organization-module.service';

const ESOP_SUBMODULES = ['esop_pools', 'esop_vesting_plans', 'esop_grants', 'esop_vesting_schedules', 'esop_exercise_requests', 'esop_ledger'];

async function main() {
  // Find all orgs that have 'esop' in organization_modules
  const esopOrgs = await prisma.$queryRaw<Array<{ organization_id: string }>>`
    SELECT DISTINCT organization_id FROM organization_modules WHERE resource = 'esop'
  `;
  console.log(`Found ${esopOrgs.length} orgs with 'esop' module.`);

  for (const { organization_id } of esopOrgs) {
    // Get current modules for this org
    const current = await prisma.$queryRaw<Array<{ resource: string }>>`
      SELECT resource FROM organization_modules WHERE organization_id = ${organization_id}::uuid
    `;
    const existing = new Set(current.map((r) => r.resource));
    const toAdd = ESOP_SUBMODULES.filter((r) => !existing.has(r));

    if (toAdd.length === 0) {
      console.log(`Org ${organization_id}: already has all ESOP sub-modules.`);
      continue;
    }

    console.log(`Org ${organization_id}: adding ${toAdd.join(', ')}`);
    for (const resource of toAdd) {
      await prisma.$executeRaw`
        INSERT INTO organization_modules (id, organization_id, resource, created_at)
        VALUES (uuid_generate_v4(), ${organization_id}::uuid, ${resource}, NOW())
        ON CONFLICT DO NOTHING
      `;
    }

    // Re-run setModules so ORG_ADMIN / HR_MANAGER role permissions get updated
    const allResources = [...existing, ...toAdd];
    try {
      await organizationModuleService.setModules(organization_id, allResources);
      console.log(`  → Updated role permissions for org ${organization_id}`);
    } catch (e: any) {
      console.warn(`  → Could not update role perms: ${e.message}`);
    }
  }

  console.log('Done.');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
