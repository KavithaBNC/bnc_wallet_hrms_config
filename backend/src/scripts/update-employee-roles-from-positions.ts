import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to update user roles based on employee positions
 * Usage: npx ts-node backend/src/scripts/update-employee-roles-from-positions.ts
 */
async function updateEmployeeRolesFromPositions() {
  try {
    console.log('\n🔄 Updating employee roles based on positions...\n');

    // Get all employees with positions and users
    const allEmployees = await prisma.employee.findMany({
      select: {
        id: true,
        userId: true,
        positionId: true,
      },
    });

    // Filter to only employees with both positionId and userId
    const employees = allEmployees.filter(
      (emp) => emp.positionId !== null && emp.userId !== null
    );

    let updated = 0;
    let skipped = 0;

    for (const employee of employees) {
      if (!employee.positionId || !employee.userId) {
        skipped++;
        continue;
      }

      // Get position
      const position = await prisma.jobPosition.findUnique({
        where: { id: employee.positionId },
        select: { title: true },
      });

      if (!position) {
        skipped++;
        continue;
      }

      // Get user record
      const user = await prisma.user.findUnique({
        where: { id: employee.userId },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        skipped++;
        continue;
      }

      const title = position.title.toLowerCase();
      let newRole: UserRole = 'EMPLOYEE';

      // Map position titles to user roles
      if (
        title.includes('hr admin') ||
        title.includes('hr manager') ||
        title.includes('hr administrator') ||
        title.includes('human resources manager') ||
        title.includes('human resource manager')
      ) {
        newRole = 'HR_MANAGER';
      } else if (title.includes('manager') && !title.includes('hr')) {
        newRole = 'MANAGER';
      } else if (title.includes('team lead') || title.includes('team leader') || title.includes('lead')) {
        newRole = 'MANAGER'; // Team leads should be managers to see their team
      }

      // Only update if role is different
      if (user.role !== newRole) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: newRole },
        });

        console.log(
          `✅ Updated: ${user.email} (${user.role} → ${newRole}) - Position: ${position.title}`
        );
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped} (already correct or no position)`);
    console.log(`   Total: ${employees.length}`);
  } catch (error: any) {
    console.error('❌ Error updating employee roles:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateEmployeeRolesFromPositions();
