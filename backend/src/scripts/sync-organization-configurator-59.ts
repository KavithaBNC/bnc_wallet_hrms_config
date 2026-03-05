/**
 * Sync HRMS organization with Configurator company 59 (BNC Motors).
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/sync-organization-configurator-59.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Syncing organization with configurator_company_id = 59...\n');

  // Check if already synced
  const existing = await prisma.organization.findFirst({
    where: { configuratorCompanyId: 59 },
    select: { id: true, name: true },
  });
  if (existing) {
    console.log(`✅ Already synced: ${existing.name} (${existing.id}) has configurator_company_id=59`);
    console.log('\nYou can login with superadmin@bncmotors.com');
    return;
  }

  // Update BNC Motors or first org
  const updated = await prisma.$executeRaw`
    UPDATE organizations 
    SET configurator_company_id = 59 
    WHERE (name ILIKE '%BNC Motors%' OR name ILIKE '%BNC%')
      AND (configurator_company_id IS NULL OR configurator_company_id != 59)
  `;

  if (Number(updated) === 0) {
    // Fallback: set for first organization
    const firstOrg = await prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, configuratorCompanyId: true },
    });
    if (firstOrg) {
      await prisma.organization.update({
        where: { id: firstOrg.id },
        data: { configuratorCompanyId: 59 },
      });
      console.log(`✅ Set configurator_company_id=59 for: ${firstOrg.name} (${firstOrg.id})`);
    } else {
      console.log('❌ No organizations found in HRMS. Create one first.');
      process.exit(1);
    }
  } else {
    console.log(`✅ Updated ${updated} organization(s) with configurator_company_id=59`);
  }

  const org = await prisma.organization.findFirst({
    where: { configuratorCompanyId: 59 },
    select: { id: true, name: true, configuratorCompanyId: true },
  });
  console.log('\nVerified:', org);
  console.log('\n✅ Sync complete. You can now login with superadmin@bncmotors.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
