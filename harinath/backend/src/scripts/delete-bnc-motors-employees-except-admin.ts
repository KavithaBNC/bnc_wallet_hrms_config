/**
 * Remove all employees under BNC Motors organization, except the admin.
 * Keeps: employeeCode EMP1772105747580-inwa5, email admin@bncmotors.com
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/delete-bnc-motors-employees-except-admin.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BNC_MOTORS_ORG_ID = '26d9d4ff-aab0-4e52-ae02-dba5d455ced4';
const KEEP_EMPLOYEE_CODE = 'EMP1772105747580-inwa5';
const KEEP_EMAIL = 'admin@bncmotors.com';

async function main() {
  const toDelete = await prisma.employee.findMany({
    where: {
      organizationId: BNC_MOTORS_ORG_ID,
      NOT: {
        OR: [
          { employeeCode: KEEP_EMPLOYEE_CODE },
          { email: KEEP_EMAIL },
        ],
      },
    },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, userId: true },
  });

  const toKeep = await prisma.employee.findFirst({
    where: {
      organizationId: BNC_MOTORS_ORG_ID,
      OR: [{ employeeCode: KEEP_EMPLOYEE_CODE }, { email: KEEP_EMAIL }],
    },
    select: { employeeCode: true, email: true },
  });

  if (toKeep) {
    console.log(`Keeping: ${toKeep.employeeCode} (${toKeep.email})`);
  } else {
    console.log('Note: Admin employee not found in DB (may have different code/email).');
  }

  if (toDelete.length === 0) {
    console.log('No other employees to delete in BNC Motors organization.');
    return;
  }

  const ids = toDelete.map((e) => e.id);
  const userIds = toDelete.map((e) => e.userId);

  console.log(`\nDeleting ${toDelete.length} employee(s)...`);
  toDelete.forEach((e) => console.log(`  - ${e.employeeCode} | ${e.firstName} ${e.lastName} | ${e.email}`));

  await prisma.$transaction(async (tx) => {
    await tx.department.updateMany({ where: { managerId: { in: ids } }, data: { managerId: null } });
    await tx.employee.updateMany({ where: { reportingManagerId: { in: ids } }, data: { reportingManagerId: null } });
    await tx.attendanceLog.updateMany({ where: { employeeId: { in: ids } }, data: { employeeId: null } });
    await tx.encashmentCarryForward.updateMany({ where: { associateId: { in: ids } }, data: { associateId: null } });
    await tx.jobOpening.updateMany({ where: { hiringManagerId: { in: ids } }, data: { hiringManagerId: null } });
    await tx.candidate.updateMany({ where: { referredBy: { in: ids } }, data: { referredBy: null } });
    await tx.application.updateMany({ where: { assignedTo: { in: ids } }, data: { assignedTo: null } });

    await tx.employee.deleteMany({ where: { id: { in: ids } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });

  console.log('\nDone. All BNC Motors employees removed except admin.');
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
