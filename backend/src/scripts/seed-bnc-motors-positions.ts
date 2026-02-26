/**
 * Seed job positions (designations) for BNC Motors organization.
 * Usage: npm run seed:bnc-motors-positions
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const ORG_ID = '26d9d4ff-aab0-4e52-ae02-dba5d455ced4';

const POSITIONS = [
  'Area Sales Manager',
  'Assistant Manager',
  'Assistant Manager - F & A',
  'Associate',
  'Business Head',
  'CEO',
  'Chief Financial Officer',
  'Chief Strategy Officer',
  'Craftman',
  'Customer support Manager',
  'Customer support Technician',
  'Designer',
  'Distinguished Craftsman',
  'Driver',
  'Engineer',
  'Engineer - Electrical',
  'Engineer - Embedded Software',
  'Engineer - IT Support',
  'Engineer - PED',
  'Engineer - Quality',
  'Engineer - SCM (Planning)',
  'Executive',
  'Executive - Accounts',
  'Executive - Business Development',
  'Executive - CRM',
  'Executive - Marketing',
  'Executive - Stores',
  'General Manager - Accounts & Admin',
  'GET',
  'Head - Electronics',
  'Head of HR',
  'Head of Sales & Marketing',
  'HR Business Partner',
  'Homologation Manager',
  'House Keeping',
  'Hardware Engineer',
  'Jr. Associate',
  'Jr. Engineer',
  'Jr. Engineer - Embedded Software',
  'Jr. Engineer - QA',
  'Jr. Engineer - Testing',
  'Jr.Executive',
  'JR.ENGINEER',
  'JUNIOR ENGINEER - QC',
  'Junior Craftman',
  'Lead Engineer',
  'Manager',
  'Manager - International Sales',
  'Manager - Operations',
  'Manager - QA',
  'Manager - Service Operations',
  'Master Craftsman',
  'Master Technician',
  'PHP Developer',
  'QUALITY INSPECTOR',
  'Senior Accountant',
  'Senior Architect - Embedded',
  'Senior Craftsman',
  'Senior Design Engineer',
  'Senior Engineer',
  'Senior Engineer - NPD',
  'Senior Engineer - Service',
  'Senior Engineer - Testing',
  'Senior Manager - Testing',
  'Senior Technician',
  'Sr Executive',
  'Sr. Engineer - SCM',
  'Sr.Manager',
  'Technician',
  'Technical Lead',
  'Technical Lead - Design (E&E)',
  'Technical Lead - Testing',
  'Territory Sales Manager',
  'Territory sales officer',
  'TEST RIDER',
  'Trainee',
  'Trainee Engineer',
  'Trainee - Software',
  'Trainee - Software Testing',
  'Vehicle Certification Manager',
  'Welder',
];

function toCode(index: number): string {
  return `BNC_POS_${index + 1}`;
}

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

  console.log(`Seeding positions for: ${org.name} (${org.id})\n`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < POSITIONS.length; i++) {
    const title = POSITIONS[i];
    const code = toCode(i);

    const existing = await prisma.jobPosition.findFirst({
      where: { organizationId: ORG_ID, title },
    });

    if (existing) {
      console.log(`⏭️  Skipped (exists): ${title}`);
      skipped++;
      continue;
    }

    try {
      await prisma.jobPosition.create({
        data: {
          organizationId: ORG_ID,
          title,
          code,
          isActive: true,
        },
      });
      console.log(`✅ Created: ${title}`);
      created++;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        try {
          await prisma.jobPosition.create({
            data: {
              organizationId: ORG_ID,
              title,
              code: `BNC_${Date.now()}_${i}`,
              isActive: true,
            },
          });
          console.log(`✅ Created (alt code): ${title}`);
          created++;
        } catch (retryErr: any) {
          console.error(`❌ Failed: ${title} - ${retryErr?.message || retryErr}`);
        }
      } else {
        console.error(`❌ Failed: ${title} - ${err?.message || err}`);
      }
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
