import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default organization
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' }, // Default UUID
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'BNC Technologies',
      legalName: 'BNC Technologies Pvt Ltd',
      industry: 'Information Technology',
      sizeRange: '51-200',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      fiscalYearStart: new Date('2026-04-01'),
      address: {},
      settings: {},
    },
  });

  console.log('✅ Default organization created:', org.name);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });