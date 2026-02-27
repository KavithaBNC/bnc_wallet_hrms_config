/**
 * Update employees (other than BMPL entity) to BNC entity and Coimbatore location.
 * - Employees with entity = BMPL: unchanged
 * - Employees with entity != BMPL or entityId null: set entityId=BNC, locationId=Coimbatore
 *
 * Usage: cd backend && npx ts-node -r tsconfig-paths/register src/scripts/update-non-bmpl-to-bnc-entity-coimbatore.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BNC_MOTORS_ORG_ID = '26d9d4ff-aab0-4e52-ae02-dba5d455ced4';
const BNC_ENTITY_NAME = 'BNC';
const BMPL_ENTITY_NAME = 'BMPL';
const COIMBATORE_LOCATION_NAME = 'Coimbatore';

async function main() {
  const org = await prisma.organization.findUnique({
    where: { id: BNC_MOTORS_ORG_ID },
    select: { id: true, name: true },
  });
  if (!org) {
    console.error('Organization not found:', BNC_MOTORS_ORG_ID);
    process.exit(1);
  }
  console.log('Organization:', org.name);

  let bncEntity = await prisma.entity.findFirst({
    where: {
      organizationId: BNC_MOTORS_ORG_ID,
      name: { equals: BNC_ENTITY_NAME, mode: 'insensitive' },
    },
    select: { id: true, name: true },
  });
  if (!bncEntity) {
    bncEntity = await prisma.entity.create({
      data: {
        organizationId: BNC_MOTORS_ORG_ID,
        name: BNC_ENTITY_NAME,
        code: 'BNC',
      },
      select: { id: true, name: true },
    });
    console.log('Created BNC entity:', bncEntity.id);
  } else {
    console.log('Found BNC entity:', bncEntity.id);
  }

  let coimbatoreLocation = await prisma.location.findFirst({
    where: {
      entityId: bncEntity.id,
      name: { equals: COIMBATORE_LOCATION_NAME, mode: 'insensitive' },
    },
    select: { id: true, name: true },
  });
  if (!coimbatoreLocation) {
    coimbatoreLocation = await prisma.location.create({
      data: {
        organizationId: BNC_MOTORS_ORG_ID,
        entityId: bncEntity.id,
        name: COIMBATORE_LOCATION_NAME,
        code: 'COIMBATORE',
      },
      select: { id: true, name: true },
    });
    console.log('Created Coimbatore location:', coimbatoreLocation.id);
  } else {
    console.log('Found Coimbatore location:', coimbatoreLocation.id);
  }

  const bmplEntity = await prisma.entity.findFirst({
    where: {
      organizationId: BNC_MOTORS_ORG_ID,
      name: { equals: BMPL_ENTITY_NAME, mode: 'insensitive' },
    },
    select: { id: true, name: true },
  });
  if (bmplEntity) {
    console.log('Found BMPL entity:', bmplEntity.id, '- employees with BMPL will NOT be updated');
  } else {
    console.log('No BMPL entity found - all employees in org will be updated');
  }

  const employeesToUpdate = await prisma.employee.findMany({
    where: bmplEntity
      ? {
          organizationId: BNC_MOTORS_ORG_ID,
          deletedAt: null,
          OR: [{ entityId: null }, { entityId: { not: bmplEntity.id } }],
        }
      : {
          organizationId: BNC_MOTORS_ORG_ID,
          deletedAt: null,
        },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      entityId: true,
      locationId: true,
      entity: { select: { name: true } },
    },
  });

  const filtered = employeesToUpdate;

  if (filtered.length === 0) {
    console.log('No employees to update.');
    return;
  }

  console.log(`\nUpdating ${filtered.length} employee(s) to BNC entity and Coimbatore location:`);
  filtered.forEach((e) => {
    console.log(`  - ${e.employeeCode} | ${e.firstName} ${e.lastName} | current entity: ${e.entity?.name || '(none)'}`);
  });

  const ids = filtered.map((e) => e.id);
  const result = await prisma.employee.updateMany({
    where: { id: { in: ids } },
    data: {
      entityId: bncEntity.id,
      locationId: coimbatoreLocation.id,
    },
  });

  console.log(`\nDone. Updated ${result.count} employee(s) to BNC entity and Coimbatore location.`);
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
