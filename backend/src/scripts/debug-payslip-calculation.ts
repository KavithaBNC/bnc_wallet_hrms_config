/**
 * Script to debug why payslip calculation results in 0
 */

import { prisma } from '../utils/prisma';
import { PayrollCalculationEngine } from '../utils/payroll-calculation-engine';

async function debugPayslipCalculation() {
  try {
    console.log('🔍 Debugging payslip calculation for Saravanan...\n');

    // Find Saravanan
    const saravanan = await prisma.employee.findFirst({
      where: {
        firstName: { contains: 'Saravanan', mode: 'insensitive' },
      },
      include: {
        salaries: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!saravanan || !saravanan.salaries[0]) {
      console.log('❌ Saravanan or salary not found');
      return;
    }

    const salary = saravanan.salaries[0];
    console.log(`✅ Found Saravanan: ${saravanan.firstName} ${saravanan.lastName}`);
    console.log(`   Basic Salary: ₹${Number(salary.basicSalary).toLocaleString()}`);
    console.log(`   Gross Salary: ₹${Number(salary.grossSalary).toLocaleString()}`);
    console.log(`   Components:`, salary.components);
    console.log(`   Date of Joining: ${saravanan.dateOfJoining ? new Date(saravanan.dateOfJoining).toLocaleDateString() : 'N/A'}\n`);

    // Get December 2025 payslip
    const payslip = await prisma.payslip.findFirst({
      where: {
        employeeId: saravanan.id,
        periodStart: { gte: new Date('2025-12-01') },
        periodEnd: { lte: new Date('2025-12-31') },
      },
      include: {
        payrollCycle: true,
      },
    });

    if (!payslip) {
      console.log('❌ Payslip not found');
      return;
    }

    console.log(`📄 Payslip Details:`);
    console.log(`   Period: ${new Date(payslip.periodStart).toLocaleDateString()} - ${new Date(payslip.periodEnd).toLocaleDateString()}`);
    console.log(`   Paid Days: ${payslip.paidDays}`);
    console.log(`   Gross Salary: ₹${Number(payslip.grossSalary).toLocaleString()}`);
    console.log(`   Basic Salary: ₹${Number(payslip.basicSalary).toLocaleString()}\n`);

    // Simulate the calculation
    const periodStart = new Date(payslip.periodStart);
    const periodEnd = new Date(payslip.periodEnd);

    // Get attendance data
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: saravanan.id,
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const presentDays = attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const totalWorkingDays = PayrollCalculationEngine.calculateWorkingDays(periodStart, periodEnd);

    console.log(`📊 Attendance Data:`);
    console.log(`   Present Days: ${presentDays}`);
    console.log(`   Total Working Days: ${totalWorkingDays}`);
    console.log(`   Paid Days (from payslip): ${payslip.paidDays}\n`);

    // Calculate proration factor
    const prorationFactor = PayrollCalculationEngine.calculateProrationFactor(
      periodStart,
      periodEnd,
      totalWorkingDays,
      saravanan.dateOfJoining ? new Date(saravanan.dateOfJoining) : undefined,
      saravanan.dateOfLeaving ? new Date(saravanan.dateOfLeaving) : undefined
    );

    const paidDays = Number(payslip.paidDays || 0);
    
    console.log(`🔢 Calculation Factors:`);
    console.log(`   Proration Factor: ${prorationFactor}`);
    const paidDaysFactorCalc = totalWorkingDays > 0 ? paidDays / totalWorkingDays : 0;
    console.log(`   Paid Days Factor: ${paidDaysFactorCalc}`);
    const finalProrationFactorCalc = prorationFactor > 0 ? prorationFactor * paidDaysFactorCalc : paidDaysFactorCalc;
    console.log(`   Final Proration Factor: ${finalProrationFactorCalc}\n`);

    // Calculate what basic amount should be
    const basicSalary = Number(salary.basicSalary);
    const paidDaysFactor = paidDaysFactorCalc;
    const finalProrationFactor = prorationFactor > 0 ? prorationFactor * paidDaysFactor : paidDaysFactor;
    const calculatedBasic = basicSalary * finalProrationFactor;

    console.log(`💰 Expected Calculation:`);
    console.log(`   Basic Salary: ₹${basicSalary.toLocaleString()}`);
    console.log(`   × Final Proration Factor: ${finalProrationFactor}`);
    console.log(`   = Calculated Basic: ₹${calculatedBasic.toLocaleString()}\n`);

    if (calculatedBasic === 0) {
      console.log('❌ PROBLEM FOUND: Calculated basic is 0!');
      console.log(`   Reason: ${prorationFactor === 0 ? 'Proration factor is 0' : ''}${paidDaysFactor === 0 ? 'Paid days factor is 0' : ''}`);
      console.log(`   Solution: Check why prorationFactor or paidDaysFactor is 0\n`);
    } else {
      console.log('✅ Calculation should work correctly');
      console.log('   The issue might be in how the calculation is being called\n');
    }

    // Check if salary structure components exist
    let salaryStructureComponents: any[] = [];
    if (salary.salaryStructureId) {
      const structure = await prisma.salaryStructure.findUnique({
        where: { id: salary.salaryStructureId },
      });
      if (structure) {
        salaryStructureComponents = (structure.components as any[]) || [];
      }
    }

    console.log(`📋 Salary Structure Components: ${salaryStructureComponents.length}`);
    if (salaryStructureComponents.length === 0) {
      console.log('   ⚠️  No salary structure components found!');
      console.log('   This might cause earnings to be calculated incorrectly\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

debugPayslipCalculation()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
