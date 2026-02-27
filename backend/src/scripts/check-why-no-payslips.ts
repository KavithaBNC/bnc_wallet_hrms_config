/**
 * Script to check why December 2025 cycle has no payslips
 */

import { prisma } from '../utils/prisma';

async function checkWhyNoPayslips() {
  try {
    console.log('🔍 Checking why December 2025 cycle has no payslips...\n');

    // Find December 2025 cycle
    const cycle = await prisma.payrollCycle.findFirst({
      where: {
        payrollMonth: 12,
        payrollYear: 2025,
      },
      include: {
        organization: true,
        payslips: true,
      },
    });

    if (!cycle) {
      console.log('❌ December 2025 cycle not found');
      return;
    }

    console.log(`✅ Found cycle: ${cycle.name}`);
    console.log(`   Status: ${cycle.status}`);
    console.log(`   Payslips: ${cycle.payslips.length}`);
    console.log(`   Period: ${new Date(cycle.periodStart).toLocaleDateString()} - ${new Date(cycle.periodEnd).toLocaleDateString()}\n`);

    // Check employees with active salary during December 2025
    const periodStart = new Date(cycle.periodStart);
    const periodEnd = new Date(cycle.periodEnd);

    console.log('👥 Checking employees with active salary during December 2025...\n');

    const employeesWithSalary = await prisma.employee.findMany({
      where: {
        organizationId: cycle.organizationId,
        deletedAt: null,
        salaries: {
          some: {
            isActive: true,
            OR: [
              {
                effectiveDate: { lte: periodEnd },
                OR: [
                  { endDate: null },
                  { endDate: { gte: periodStart } },
                ],
              },
            ],
          },
        },
      },
      include: {
        salaries: {
          where: {
            isActive: true,
            OR: [
              {
                effectiveDate: { lte: periodEnd },
                OR: [
                  { endDate: null },
                  { endDate: { gte: periodStart } },
                ],
              },
            ],
          },
          take: 1,
        },
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    });

    console.log(`✅ Found ${employeesWithSalary.length} employee(s) with active salary:\n`);

    employeesWithSalary.forEach((emp, index) => {
      const salary = emp.salaries[0];
      console.log(`${index + 1}. ${emp.firstName} ${emp.lastName} (${emp.employeeCode})`);
      console.log(`   Email: ${emp.user?.email || 'No user account'}`);
      console.log(`   Salary: ₹${salary?.grossSalary.toLocaleString() || 'N/A'}/month`);
      console.log(`   Effective Date: ${salary?.effectiveDate ? new Date(salary.effectiveDate).toLocaleDateString() : 'N/A'}`);
      console.log(`   End Date: ${salary?.endDate ? new Date(salary.endDate).toLocaleDateString() : 'Active'}`);
      console.log('');
    });

    // Check if Mani is in the list
    const mani = employeesWithSalary.find((e) => 
      e.firstName.toLowerCase().includes('mani')
    );

    if (mani) {
      console.log('✅ Mani found with active salary!');
      console.log(`   Salary: ₹${mani.salaries[0]?.grossSalary.toLocaleString()}/month`);
    } else {
      console.log('❌ Mani not found with active salary during December 2025');
      console.log('   This could be why no payslips were generated');
    }

    // Check if payslips exist but not linked to cycle
    const allPayslips = await prisma.payslip.findMany({
      where: {
        employee: {
          organizationId: cycle.organizationId,
        },
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    console.log(`\n📄 Payslips for December 2025 period (any cycle): ${allPayslips.length}`);
    if (allPayslips.length > 0) {
      console.log('   Payslips found but may be linked to different cycle:');
      allPayslips.forEach((p) => {
        console.log(`   - ${p.employee.firstName} ${p.employee.lastName} - Cycle: ${p.payrollCycleId}`);
      });
    }

    // Recommendation
    console.log('\n\n💡 Recommendation:');
    if (employeesWithSalary.length > 0 && cycle.payslips.length === 0) {
      console.log('   ⚠️  Cycle is PROCESSED but has 0 payslips');
      console.log('   This suggests processing may have failed or no employees were found at processing time');
      console.log('   Solution: Re-process the cycle or create a new one');
    } else if (employeesWithSalary.length === 0) {
      console.log('   ⚠️  No employees with active salary during December 2025');
      console.log('   This is why no payslips were generated');
      console.log('   Solution: Assign salaries to employees first, then process');
    } else {
      console.log('   ✅ Employees with salary exist');
      console.log('   ✅ Cycle is processed');
      console.log('   ⚠️  But payslips count is 0 - may need to re-process');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkWhyNoPayslips()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
