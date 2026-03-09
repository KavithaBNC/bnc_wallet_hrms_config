/**
 * Check if employee with employeeCode N001 exists.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/check-employee-n001.ts
 */
import { prisma } from '../utils/prisma';

async function main() {
  const emp = await prisma.employee.findFirst({
    where: { employeeCode: 'N001', deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      email: true,
      organizationId: true,
    },
  });
  if (!emp) {
    console.log('No employee found with employeeCode N001.');
  } else {
    console.log('Employee N001 EXISTS:');
    console.log('  id:', emp.id);
    console.log('  name:', emp.firstName, emp.lastName);
    console.log('  employeeCode:', emp.employeeCode);
    console.log('  email:', emp.email ?? '(null)');
    console.log('  organizationId:', emp.organizationId);
  }
  await prisma.$disconnect();
}

main();
