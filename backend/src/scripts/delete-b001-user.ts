/**
 * Delete B001 employee and associated user from BNC Motors organization.
 * Clears all related references before deletion.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/delete-b001-user.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findFirst({
    where: {
      employeeCode: 'B001',
      organization: { name: { contains: 'BNC Motors', mode: 'insensitive' } },
    },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, userId: true },
  });

  if (!emp) {
    console.log('No employee with code B001 found in BNC Motors organization.');
    return;
  }

  console.log(`Found: ${emp.employeeCode} - ${emp.firstName} ${emp.lastName} (${emp.email})`);
  console.log('Clearing related references...');

  await prisma.$transaction(async (tx) => {
    // Clear references that would block deletion
    const empId = emp.id;
    await tx.$executeRaw`UPDATE departments SET manager_id = NULL WHERE manager_id = ${empId}::uuid`;
    await tx.employee.updateMany({ where: { reportingManagerId: empId }, data: { reportingManagerId: null } });
    await tx.$executeRaw`UPDATE attendance_logs SET employee_id = NULL WHERE employee_id = ${empId}::uuid`;
    await tx.encashmentCarryForward.updateMany({ where: { associateId: empId }, data: { associateId: null } });
    await tx.jobOpening.updateMany({ where: { hiringManagerId: empId }, data: { hiringManagerId: null } });
    await tx.candidate.updateMany({ where: { referredBy: empId }, data: { referredBy: null } });
    await tx.application.updateMany({ where: { assignedTo: empId }, data: { assignedTo: null } });
    console.log('  Cleared department manager, reporting manager, attendance, encashment, job, candidate, and application refs');

    await tx.employee.delete({ where: { id: empId } });
    console.log('  Deleted employee');

    try {
      await tx.user.delete({ where: { id: emp.userId } });
      console.log('  Deleted user');
    } catch (e: any) {
      if (e?.code === 'P2003') console.log('  User already removed or has other refs');
      else throw e;
    }
  });

  console.log('Done. B001 removed from BNC Motors organization and all related tables.');
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
