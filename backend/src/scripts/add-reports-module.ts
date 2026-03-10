/**
 * Migration Script: Add 'reports' resource to organization_modules for all existing orgs.
 *
 * Run with: cd backend && npx ts-node --transpile-only src/scripts/add-reports-module.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding "reports" to organization_modules for all existing orgs...\n');

  const orgs = await prisma.$queryRaw<Array<{ organization_id: string }>>`
    SELECT DISTINCT organization_id FROM organization_modules
  `;

  if (orgs.length === 0) {
    console.log('No organizations found in organization_modules table. Nothing to do.');
    return;
  }

  let added = 0;
  for (const { organization_id } of orgs) {
    const result = await prisma.$executeRaw`
      INSERT INTO organization_modules (id, organization_id, resource, created_at)
      VALUES (uuid_generate_v4(), ${organization_id}::uuid, 'reports', NOW())
      ON CONFLICT DO NOTHING
    `;
    if (Number(result) > 0) {
      console.log(`  ✓ Added reports for org ${organization_id}`);
      added++;
    } else {
      console.log(`  ℹ Already present for org ${organization_id}`);
    }
  }

  console.log(`\nDone. Added "reports" for ${added} organization(s).`);
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
