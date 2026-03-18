/**
 * Script to check Mani's payslip data and why gross salary is 0
 */

import { prisma } from '../utils/prisma';

async function checkManiPayslipData() {
  try {
    console.log('🔍 Checking Mani\'s payslip data...\n');

    // Find Mani
    const mani = await prisma.employee.findFirst({
      where: {
        firstName: { contains: 'Mani', mode: 'insensitive' },
      },
      include: {
        user: true,
        salaries: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!mani) {
      console.log('❌ Mani not found');
      return;
    }

    console.log(`✅ Found Mani: ${mani.firstName} ${mani.lastName}`);
    console.log(`   Employee ID: ${mani.id}`);
    console.log(`   Salary: ₹${mani.salaries[0]?.grossSalary.toLocaleString() || 'N/A'}/month\n`);

    // Find Mani's payslips
    const payslips = await prisma.payslip.findMany({
      where: {
        employeeId: mani.id,
      },
      include: {
        payrollCycle: true,
        employeeSalary: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📄 Found ${payslips.length} payslip(s) for Mani:\n`);

    payslips.forEach((payslip, index) => {
      console.log(`\n${index + 1}. Payslip ID: ${payslip.id}`);
      console.log(`   Period: ${new Date(payslip.periodStart).toLocaleDateString()} - ${new Date(payslip.periodEnd).toLocaleDateString()}`);
      console.log(`   Gross Salary: ₹${Number(payslip.grossSalary).toLocaleString()}`);
      console.log(`   Basic Salary: ₹${Number(payslip.basicSalary).toLocaleString()}`);
      console.log(`   Total Deductions: ₹${Number(payslip.totalDeductions || 0).toLocaleString()}`);
      console.log(`   Net Salary: ₹${Number(payslip.netSalary).toLocaleString()}`);
      console.log(`   Paid Days: ${payslip.paidDays || 'N/A'}`);
      console.log(`   Unpaid Days: ${payslip.unpaidDays || 'N/A'}`);
      console.log(`   Status: ${payslip.status}`);
      
      // Check earnings
      if (payslip.earnings) {
        const earnings = Array.isArray(payslip.earnings) ? payslip.earnings : [];
        console.log(`   Earnings Components: ${earnings.length}`);
        earnings.forEach((e: any) => {
          console.log(`     - ${e.component || e.name}: ₹${Number(e.amount || 0).toLocaleString()}`);
        });
      }

      // Check deductions
      if (payslip.deductions) {
        const deductions = Array.isArray(payslip.deductions) ? payslip.deductions : [];
        console.log(`   Deductions Components: ${deductions.length}`);
        deductions.forEach((d: any) => {
          console.log(`     - ${d.component || d.name}: ₹${Number(d.amount || 0).toLocaleString()}`);
        });
      }

      // Check employee salary
      if (payslip.employeeSalary) {
        console.log(`   Employee Salary Record:`);
        console.log(`     - Basic: ₹${Number(payslip.employeeSalary.basicSalary).toLocaleString()}`);
        console.log(`     - Gross: ₹${Number(payslip.employeeSalary.grossSalary).toLocaleString()}`);
        console.log(`     - Net: ₹${Number(payslip.employeeSalary.netSalary).toLocaleString()}`);
      }
    });

    // Check if gross is 0
    const zeroGrossPayslips = payslips.filter((p) => Number(p.grossSalary) === 0);
    if (zeroGrossPayslips.length > 0) {
      console.log(`\n⚠️  Found ${zeroGrossPayslips.length} payslip(s) with gross salary = 0`);
      console.log(`   This could be due to:`);
      console.log(`   1. Calculation error during processing`);
      console.log(`   2. No working days in the period`);
      console.log(`   3. All days marked as unpaid/absent`);
      console.log(`   4. Pro-rata calculation resulted in 0`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkManiPayslipData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
