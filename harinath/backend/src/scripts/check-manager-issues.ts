import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to check manager filtering issues
 */
async function checkManagerIssues() {
  try {
    console.log('\n🔍 Checking manager filtering issues...\n');

    const email = 'sadasivam@gmail.com';
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employee: {
          include: {
            department: {
              select: { id: true, name: true },
            },
            position: {
              select: { title: true },
            },
          },
        },
      },
    });

    if (!user || !user.employee) {
      console.log(`❌ User ${email} not found`);
      return;
    }

    console.log(`📋 Manager: ${user.employee.firstName} ${user.employee.lastName}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Employee ID: ${user.employee.id}`);
    console.log(`   Department ID: ${user.employee.departmentId || 'N/A'}`);
    console.log(`   Department Name: ${user.employee.department?.name || 'N/A'}`);

    // Check all employees in the organization
    const allOrgEmployees = await prisma.employee.findMany({
      where: {
        organizationId: user.employee.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        reportingManagerId: true,
        departmentId: true,
        department: {
          select: { name: true },
        },
      },
    });

    console.log(`\n📊 All employees in organization: ${allOrgEmployees.length}`);
    
    // Check direct reports
    const directReports = allOrgEmployees.filter(
      (emp) => emp.reportingManagerId === user.employee!.id
    );

    console.log(`\n👥 Direct Reports (reportingManagerId = ${user.employee.id}): ${directReports.length}`);
    directReports.forEach((emp) => {
      console.log(`   - ${emp.firstName} ${emp.lastName} (${emp.email})`);
      console.log(`     Department: ${emp.department?.name || 'N/A'} (ID: ${emp.departmentId || 'N/A'})`);
    });

    // Check if department filter would exclude anyone
    if (user.employee.departmentId) {
      const sameDeptReports = directReports.filter(
        (emp) => emp.departmentId === user.employee!.departmentId
      );
      console.log(`\n⚠️  Same Department Reports: ${sameDeptReports.length}`);
      if (sameDeptReports.length < directReports.length) {
        console.log(`   ⚠️  WARNING: ${directReports.length - sameDeptReports.length} direct reports are in different departments!`);
        directReports.forEach((emp) => {
          if (emp.departmentId !== user.employee!.departmentId) {
            console.log(`      - ${emp.firstName} ${emp.lastName} is in different department`);
          }
        });
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkManagerIssues();
