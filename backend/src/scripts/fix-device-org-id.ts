/**
 * Fix device CQZ7224460246's company to use correct organization_id
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/fix-device-org-id.ts
 */
import { prisma } from '../utils/prisma';

const DEVICE_SERIAL = 'CQZ7224460246';
const CORRECT_ORG_ID = '26d9d4ff-aab0-4e52-ae02-dba5d455ced4';

async function main() {
  const device = await prisma.biometricDevice.findUnique({
    where: { serialNumber: DEVICE_SERIAL },
    include: { company: true },
  });

  if (!device) {
    console.error('Device not found:', DEVICE_SERIAL);
    process.exit(1);
  }

  const company = device.company;
  if (!company) {
    console.error('Device has no company');
    process.exit(1);
  }

  if (company.organizationId === CORRECT_ORG_ID) {
    console.log('Company already has correct organization_id. No change needed.');
    await prisma.$disconnect();
    return;
  }

  // Check if org already has a company (organizationId is unique)
  const existingCompanyForOrg = await prisma.company.findFirst({
    where: { organizationId: CORRECT_ORG_ID },
  });

  if (existingCompanyForOrg) {
    // Move device to the existing company for Harinath's org
    console.log('Org already has a company. Moving device to that company...');
    await prisma.biometricDevice.update({
      where: { serialNumber: DEVICE_SERIAL },
      data: { companyId: existingCompanyForOrg.id },
    });
    console.log('Device moved to company', existingCompanyForOrg.id);
  } else {
    // Update current company's organization_id
    console.log('Before:', { companyId: company.id, organizationId: company.organizationId });
    await prisma.company.update({
      where: { id: company.id },
      data: { organizationId: CORRECT_ORG_ID },
    });
    console.log('After: Updated company organization_id to', CORRECT_ORG_ID);
  }

  console.log('Device CQZ7224460246 is now linked to Harinath\'s organization. Punches should work.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
