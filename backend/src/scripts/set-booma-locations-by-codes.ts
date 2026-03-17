import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping from Associate Code (employeeCode) to Location name
const CODE_TO_LOCATION: Record<string, string> = {
  B863: 'KOLKATA',
  B841: 'Delhi',
  B864: 'Delhi',
  B826: 'Coimbatore',
  B827: 'Coimbatore',
  B861: 'Pune',
  B866: 'Delhi',
  B828: 'Coimbatore',
  B865: 'Coimbatore',
  B862: 'Coimbatore',
  B829: 'Coimbatore',
  B842: 'Chennai',
  B832: 'Coimbatore',
  B834: 'Coimbatore',
  B867: 'Coimbatore',
  B839: 'Coimbatore',
  B858: 'Coimbatore',
  B830: 'Chennai',
  B831: 'Coimbatore',
  B835: 'Coimbatore',
  B860: 'Coimbatore',
  B878: 'Chennai',
  B893: 'Coimbatore',
  B895: 'Coimbatore',
};

async function main() {
  console.log('📍 Setting locations for selected associate codes...\n');

  const codes = Object.keys(CODE_TO_LOCATION);

  const employees = await prisma.employee.findMany({
    where: {
      employeeCode: { in: codes },
    },
    select: {
      id: true,
      employeeCode: true,
      organizationId: true,
      locationId: true,
      organization: { select: { name: true } },
    },
  });

  if (!employees.length) {
    console.log('No employees found for the given associate codes.');
    return;
  }

  console.log(`Found ${employees.length} employees for the given codes.`);

  // Group employees by organization, then by target location name
  const byOrg = new Map<string, typeof employees>();
  for (const emp of employees) {
    const list = byOrg.get(emp.organizationId) ?? [];
    list.push(emp);
    byOrg.set(emp.organizationId, list);
  }

  for (const [orgId, orgEmployees] of byOrg.entries()) {
    const orgName = orgEmployees[0]?.organization?.name ?? orgId;
    console.log(`\n🏢 Organization: ${orgName} (${orgId})`);

    // Build per-location bucket
    const byLocation = new Map<string, string[]>(); // locationName -> employeeIds
    for (const emp of orgEmployees) {
      const locName = CODE_TO_LOCATION[emp.employeeCode];
      if (!locName) continue;
      const ids = byLocation.get(locName) ?? [];
      ids.push(emp.id);
      byLocation.set(locName, ids);
    }

    for (const [locName, empIds] of byLocation.entries()) {
      // Find Booma Motors entity for this organization (set earlier by set-booma-entity-by-codes.ts)
      const boomaEntity = await prisma.entity.findFirst({
        where: {
          organizationId: orgId,
          name: 'Booma Motors',
        },
      });

      if (!boomaEntity) {
        console.warn(`  ⚠️ No "Booma Motors" entity found for org ${orgId}; skipping location "${locName}".`);
        continue;
      }

      // Ensure location exists for this org + Booma entity + name
      const existingLocation = await prisma.location.findFirst({
        where: {
          organizationId: orgId,
          entityId: boomaEntity.id,
          name: locName,
        },
      });

      const location =
        existingLocation ??
        (await prisma.location.create({
          data: {
            organizationId: orgId,
            entityId: boomaEntity.id,
            name: locName,
            code: locName.toUpperCase().replace(/\s+/g, '_'),
            isActive: true,
          },
        }));

      const result = await prisma.employee.updateMany({
        where: {
          id: { in: empIds },
        },
        data: {
          locationId: location.id,
          workLocation: locName,
        },
      });

      console.log(
        `  Location "${locName}" [${location.id}] -> updated ${result.count} employee(s).`,
      );
    }
  }

  console.log('\n✅ Done.');
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

