import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to check employee reporting structure
 * Usage: npx ts-node backend/src/scripts/check-reporting-structure.ts
 */
async function checkReportingStructure() {
  try {
    console.log('\n🔍 Checking employee reporting structure...\n');

    // Get specific users
    const users = ['sathish@gmail.com', 'sadasivam@gmail.com', 'jayaganesh@gmail.com'];

    for (const email of users) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          employee: {
            include: {
              position: {
                select: { title: true },
              },
              organization: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!user || !user.employee) {
        console.log(`\n❌ User ${email} not found or has no employee record`);
        continue;
      }

      console.log(`\n📋 User: ${email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Name: ${user.employee.firstName} ${user.employee.lastName}`);
      console.log(`   Position: ${user.employee.position?.title || 'N/A'}`);
      console.log(`   Organization: ${user.employee.organization?.name || 'N/A'}`);
      console.log(`   Employee ID: ${user.employee.id}`);

      // Check who reports to this employee
      const subordinates = await prisma.employee.findMany({
        where: {
          reportingManagerId: user.employee.id,
          deletedAt: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeCode: true,
          position: {
            select: { title: true },
          },
        },
      });

      console.log(`   Direct Reports: ${subordinates.length}`);
      if (subordinates.length > 0) {
        subordinates.forEach((sub) => {
          console.log(`      - ${sub.firstName} ${sub.lastName} (${sub.email}) - ${sub.position?.title || 'N/A'}`);
        });
      } else {
        console.log(`      ⚠️  No employees report to this manager`);
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkReportingStructure();
