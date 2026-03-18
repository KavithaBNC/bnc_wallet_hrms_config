/**
 * Seed sub-departments and cost centres for BNC Motors organization.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/seed-bnc-motors-subdepartments-costcentres.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const ORG_ID = '26d9d4ff-aab0-4e52-ae02-dba5d455ced4';

// All unique sub-departments from the department-subdepartment hierarchy (BNC Motors)
const SUB_DEPARTMENTS: string[] = [
  'General Admin',
  'Testing',
  'Production',
  'Purchase',
  'Maintenance',
  'Quality',
  'R&D',
  'Stores',
  'HR',
  'Admin',
  'Safety',
  'HR Operations',
  'Recruitment',
  'Payroll',
  'Employee Relations',
  'IT Support',
  'Software Development',
  'Network Management',
  'Assembly',
  'Welding',
  'Painting',
  'Quality Control',
  'Material Handling',
  'Fabrication',
  'Machining',
  'Finishing',
  'Domestic Sales',
  'International Sales',
  'Sales Support',
  'Marketing',
  'After Sales Service',
  'Customer Relationship',
  'Business Development',
  'Service Operations',
  'Customer Support',
  'Field Service',
  'Technical Support',
  'Accounts Payable',
  'Accounts Receivable',
  'Treasury',
  'Taxation',
  'Auditing',
  'Budgeting',
  'Procurement',
  'Vendor Management',
  'Logistics',
  'Supply Chain',
  'Inventory Management',
  'Warehouse Operations',
  'Dispatch',
  'Quality Assurance',
  'Inspection',
  'Product Development',
  'Research',
  'Design',
  'Preventative Maintenance',
  'Corrective Maintenance',
  'Electrical Maintenance',
  'Mechanical Maintenance',
  'Safety Compliance',
  'Risk Assessment',
  'Emergency Response',
  'Safety Training',
  'Office Management',
  'Front Desk',
  'Security',
  'Housekeeping',
  'Transport',
  'Technical Training',
  'Soft Skills Training',
  'Compliance Training',
  'Legal Advisory',
  'Contract Management',
  'Litigation',
  'Digital Marketing',
  'Product Marketing',
  'Brand Management',
  'Market Research',
  'Transportation',
  'Warehouse & Distribution',
  'General Ledger',
  'Financial Reporting',
  'Production Operations',
  'Service Operations',
  'Supply Chain Operations',
  'Customer Service',
  'Help Desk',
  'Physical Security',
  'IT Security',
  'Access Control',
];

// Cost centres - unique list for BNC Motors (codes must be globally unique)
const COST_CENTRES: { name: string; code: string }[] = [
  { name: 'R&D - Prototyping', code: 'BNC_RD_PROTOTYPING' },
  { name: 'R&D - Fabrication / Painting', code: 'BNC_RD_FABRICATION_PAINTING' },
  { name: 'R&D - Electrical / Electronics', code: 'BNC_RD_ELECTRICAL_ELECTRONICS' },
  { name: 'R&D - Mechanical Design', code: 'BNC_RD_MECHANICAL_DESIGN' },
  { name: 'Vehicle - Sales', code: 'BNC_VEHICLE_SALES' },
  { name: 'Vehicle - Stores', code: 'BNC_VEHICLE_STORES' },
  { name: 'Vehicle - Production', code: 'BNC_VEHICLE_PRODUCTION' },
  { name: 'Vehicle - NPD', code: 'BNC_VEHICLE_NPD' },
  { name: 'Common', code: 'BNC_COMMON' },
  { name: 'Vehicle - IQC', code: 'BNC_VEHICLE_IQC' },
  { name: 'Battery - Production', code: 'BNC_BATTERY_PRODUCTION' },
  { name: 'Nemi - Production', code: 'BNC_NEMI_PRODUCTION' },
  { name: 'Vehicle - EIQC', code: 'BNC_VEHICLE_EIQC' },
  { name: 'Admin', code: 'BNC_ADMIN' },
  { name: 'Manitenance', code: 'BNC_MANITENANCE' },
  { name: 'Vehicle - PDI', code: 'BNC_VEHICLE_PDI' },
  { name: 'Vehicle - IPQC', code: 'BNC_VEHICLE_IPQC' },
  { name: 'Vehicle - Marketing', code: 'BNC_VEHICLE_MARKETING' },
  { name: 'HR', code: 'BNC_HR' },
  { name: 'Vehicle - SCM', code: 'BNC_VEHICLE_SCM' },
  { name: 'Service', code: 'BNC_SERVICE' },
  { name: 'Software', code: 'BNC_SOFTWARE' },
  { name: 'Creative Design', code: 'BNC_CREATIVE_DESIGN' },
  { name: 'Finance & Accounts', code: 'BNC_FINANCE_ACCOUNTS' },
  { name: 'IT', code: 'BNC_IT' },
  { name: 'Coimbatore', code: 'BNC_COIMBATORE' },
  { name: 'CRM', code: 'BNC_CRM' },
  { name: 'Homologation', code: 'BNC_HOMOLOGATION' },
  // Legacy codes for backward compatibility
  { name: 'BNC001', code: 'BNC_BNC001' },
];

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: { id: true, name: true },
  });

  if (!org) {
    console.error(`Organization ${ORG_ID} (BNC Motors) not found.`);
    process.exit(1);
  }

  console.log(`Seeding sub-departments and cost centres for: ${org.name} (${org.id})\n`);

  // 1. Sub-departments
  console.log('--- Sub-departments ---');
  let subCreated = 0;
  let subSkipped = 0;
  for (const name of SUB_DEPARTMENTS) {
    const existing = await prisma.subDepartment.findFirst({
      where: { organizationId: ORG_ID, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      subSkipped++;
      continue;
    }
    try {
      await prisma.subDepartment.create({
        data: { organizationId: ORG_ID, name: name.trim(), isActive: true },
      });
      console.log(`  ✅ Created sub-dept: ${name}`);
      subCreated++;
    } catch (err: any) {
      if (err?.code === 'P2002') subSkipped++;
      else console.error(`  ❌ Failed: ${name} - ${err?.message || err}`);
    }
  }
  console.log(`Sub-departments: Created ${subCreated}, Skipped ${subSkipped}\n`);

  // 2. Cost centres
  console.log('--- Cost centres ---');
  let ccCreated = 0;
  let ccSkipped = 0;
  for (const { name, code } of COST_CENTRES) {
    const existing = await prisma.costCentre.findFirst({
      where: {
        organizationId: ORG_ID,
        OR: [{ name: { equals: name, mode: 'insensitive' } }, { code }],
      },
    });
    if (existing) {
      ccSkipped++;
      continue;
    }
    try {
      await prisma.costCentre.create({
        data: { organizationId: ORG_ID, name, code, isActive: true },
      });
      console.log(`  ✅ Created cost centre: ${name} [${code}]`);
      ccCreated++;
    } catch (err: any) {
      if (err?.code === 'P2002') ccSkipped++;
      else console.error(`  ❌ Failed: ${name} - ${err?.message || err}`);
    }
  }
  console.log(`Cost centres: Created ${ccCreated}, Skipped ${ccSkipped}\n`);

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
