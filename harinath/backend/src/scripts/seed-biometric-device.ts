/**
 * Register a biometric device (eSSL/ZKTeco) for /iclock/cdata.
 * Creates a company (linked to first org) and a device with the given serial.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seed-biometric-device.ts
 * Env: BIOMETRIC_DEVICE_SERIAL (default: CQZ7224460246), COMPANY_NAME (default: "Default Company")
 */
import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

const SERIAL = process.env.BIOMETRIC_DEVICE_SERIAL || 'CQZ7224460246';
const COMPANY_NAME = process.env.COMPANY_NAME || 'Default Company';

async function main() {
  const existing = await prisma.biometricDevice.findUnique({
    where: { serialNumber: SERIAL },
    include: { company: true },
  });
  if (existing) {
    console.log('✅ Device already registered:', SERIAL);
    console.log('   Company:', existing.company.name);
    return;
  }

  let org = process.env.ORGANIZATION_ID
    ? await prisma.organization.findUnique({ where: { id: process.env.ORGANIZATION_ID } })
    : await prisma.organization.findFirst();
  if (!org) {
    console.log('⚠️ No organization found. Creating company without organization link.');
  }

  let company = await prisma.company.findFirst({
    where: { name: COMPANY_NAME },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: COMPANY_NAME,
        organizationId: org?.id ?? undefined,
      },
    });
    console.log('✅ Company created:', company.name);
  } else {
    if (!company.organizationId && org) {
      await prisma.company.update({
        where: { id: company.id },
        data: { organizationId: org.id },
      });
      console.log('✅ Company linked to organization:', org.name);
    }
  }

  await prisma.biometricDevice.create({
    data: {
      companyId: company.id,
      serialNumber: SERIAL,
      name: 'eSSL Biometric',
      isActive: true,
    },
  });
  console.log('✅ Device registered with serial:', SERIAL);
  console.log('   Configure device Server URL to: <your-server>/iclock/cdata');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
