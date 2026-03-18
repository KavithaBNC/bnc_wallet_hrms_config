import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to check jayaganesh's team and reporting structure
 * Usage: npx ts-node backend/src/scripts/check-jayaganesh-team.ts
 */
async function checkJayaganeshTeam() {
  try {
    console.log('\n🔍 Checking jayaganesh team structure...\n');

    // Find jayaganesh user
    const jayaganeshEmail = 'jayaganesh@gmail.com';
    const jayaganesh = await prisma.user.findUnique({
      where: { email: jayaganeshEmail },
      include: {
        employee: {
          include: {
            position: {
              select: { title: true },
            },
            organization: {
              select: { name: true },
            },
            department: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!jayaganesh) {
      console.log(`❌ User ${jayaganeshEmail} not found`);
      return;
    }

    if (!jayaganesh.employee) {
      console.log(`❌ User ${jayaganeshEmail} has no employee record`);
      return;
    }

    console.log(`\n📋 Manager: ${jayaganesh.employee.firstName} ${jayaganesh.employee.lastName}`);
    console.log(`   Email: ${jayaganesh.email}`);
    console.log(`   Role: ${jayaganesh.role}`);
    console.log(`   Employee ID: ${jayaganesh.employee.id}`);
    console.log(`   Employee Code: ${jayaganesh.employee.employeeCode}`);
    console.log(`   Position: ${jayaganesh.employee.position?.title || 'N/A'}`);
    console.log(`   Department: ${jayaganesh.employee.department?.name || 'N/A'}`);
    console.log(`   Department ID: ${jayaganesh.employee.departmentId || 'N/A'}`);
    console.log(`   Organization: ${jayaganesh.employee.organization?.name || 'N/A'}`);

    // Check who reports to jayaganesh
    const directReports = await prisma.employee.findMany({
      where: {
        reportingManagerId: jayaganesh.employee.id,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeCode: true,
        employeeStatus: true,
        position: {
          select: { title: true },
        },
        department: {
          select: { name: true },
        },
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    });

    console.log(`\n👥 Direct Reports: ${directReports.length}`);
    if (directReports.length > 0) {
      directReports.forEach((emp) => {
        console.log(`   ✅ ${emp.firstName} ${emp.lastName} (${emp.email})`);
        console.log(`      Employee Code: ${emp.employeeCode}`);
        console.log(`      Position: ${emp.position?.title || 'N/A'}`);
        console.log(`      Department: ${emp.department?.name || 'N/A'}`);
        console.log(`      Status: ${emp.employeeStatus}`);
        console.log(`      User Role: ${emp.user?.role || 'N/A'}`);
      });
    } else {
      console.log(`   ⚠️  No direct reports found!`);
    }

    // Check saravanan specifically
    console.log(`\n🔍 Checking saravanan...\n`);
    const saravanan = await prisma.employee.findFirst({
      where: {
        OR: [
          { email: { contains: 'saravanan', mode: 'insensitive' } },
          { firstName: { contains: 'saravanan', mode: 'insensitive' } },
          { lastName: { contains: 'saravanan', mode: 'insensitive' } },
        ],
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
        reportingManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
        position: {
          select: { title: true },
        },
        department: {
          select: { name: true },
        },
      },
    });

    if (saravanan) {
      console.log(`📋 Found: ${saravanan.firstName} ${saravanan.lastName}`);
      console.log(`   Email: ${saravanan.email}`);
      console.log(`   Employee ID: ${saravanan.id}`);
      console.log(`   Employee Code: ${saravanan.employeeCode}`);
      console.log(`   Position: ${saravanan.position?.title || 'N/A'}`);
      console.log(`   Department: ${saravanan.department?.name || 'N/A'}`);
      console.log(`   User Role: ${saravanan.user?.role || 'N/A'}`);
      console.log(`   Reporting Manager ID: ${saravanan.reportingManagerId || 'NONE'}`);
      
      if (saravanan.reportingManager) {
        console.log(`   Reporting Manager: ${saravanan.reportingManager.firstName} ${saravanan.reportingManager.lastName}`);
        console.log(`   Manager Email: ${saravanan.reportingManager.email}`);
        
        if (saravanan.reportingManagerId === jayaganesh.employee.id) {
          console.log(`   ✅ saravanan reports to jayaganesh - CORRECT!`);
        } else {
          console.log(`   ❌ saravanan reports to ${saravanan.reportingManager.firstName}, NOT jayaganesh!`);
          console.log(`   💡 Fix: Update saravanan's reportingManagerId to ${jayaganesh.employee.id}`);
        }
      } else {
        console.log(`   ❌ saravanan has NO reporting manager set!`);
        console.log(`   💡 Fix: Set saravanan's reportingManagerId to ${jayaganesh.employee.id}`);
      }
    } else {
      console.log(`   ❌ saravanan not found in database`);
    }

    // Check all employees in the same organization
    console.log(`\n📊 All employees in organization: ${jayaganesh.employee.organization?.name || 'N/A'}\n`);
    const allEmployees = await prisma.employee.findMany({
      where: {
        organizationId: jayaganesh.employee.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeCode: true,
        reportingManagerId: true,
        position: {
          select: { title: true },
        },
      },
    });

    console.log(`Total employees: ${allEmployees.length}`);
    if (jayaganesh.employee) {
      console.log(`Employees with reportingManagerId = ${jayaganesh.employee.id}: ${allEmployees.filter(e => e.reportingManagerId === jayaganesh.employee!.id).length}`);
    }

    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`Manager Role: ${jayaganesh.role}`);
    console.log(`Expected Role for Manager: MANAGER`);
    
    if (jayaganesh.role !== 'MANAGER') {
      console.log(`❌ ISSUE: jayaganesh role is "${jayaganesh.role}" but should be "MANAGER"`);
      console.log(`💡 Fix: Update role to MANAGER`);
    } else {
      console.log(`✅ Role is correct: MANAGER`);
    }

    console.log(`\nDirect Reports Count: ${directReports.length}`);
    if (directReports.length === 0) {
      console.log(`❌ ISSUE: No employees are reporting to jayaganesh`);
      console.log(`💡 Fix: Set employees' reportingManagerId to ${jayaganesh.employee.id}`);
    } else {
      console.log(`✅ Found ${directReports.length} direct report(s)`);
    }

    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJayaganeshTeam();
