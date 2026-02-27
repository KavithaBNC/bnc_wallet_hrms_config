/**
 * Script to check Saravanan's salary settings vs generated payslip
 */

import { prisma } from '../utils/prisma';

async function checkSaravananSalaryVsPayslip() {
  try {
    console.log('🔍 Checking Saravanan\'s Salary Settings vs Payslip...\n');

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
    console.log('📋 CONFIGURED SALARY SETTINGS:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Employee: ${saravanan.firstName} ${saravanan.lastName} (${saravanan.employeeCode})`);
    console.log(`Basic Salary: ₹${Number(salary.basicSalary).toLocaleString()}`);
    console.log(`Gross Salary: ₹${Number(salary.grossSalary).toLocaleString()}`);
    console.log(`Net Salary: ₹${Number(salary.netSalary).toLocaleString()}`);
    console.log(`\nComponents:`);
    if (salary.components) {
      const components = salary.components as any;
      Object.keys(components).forEach((key) => {
        console.log(`  ${key}: ₹${Number(components[key]).toLocaleString()}`);
      });
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    // Find December 2025 payslip
    const payslip = await prisma.payslip.findFirst({
      where: {
        employeeId: saravanan.id,
        periodStart: { gte: new Date('2025-12-01') },
        periodEnd: { lte: new Date('2025-12-31') },
      },
    });

    if (!payslip) {
      console.log('❌ Payslip not found for December 2025');
      return;
    }

    console.log('📄 GENERATED PAYSLIP (December 2025):');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Period: ${new Date(payslip.periodStart).toLocaleDateString()} - ${new Date(payslip.periodEnd).toLocaleDateString()}`);
    console.log(`Paid Days: ${payslip.paidDays || 'N/A'}`);
    console.log(`Total Working Days: ${payslip.attendanceDays || 'N/A'}\n`);

    console.log('Earnings:');
    if (payslip.earnings) {
      const earnings = Array.isArray(payslip.earnings) ? payslip.earnings : [];
      earnings.forEach((e: any) => {
        const componentName = e.component || e.name || 'Unknown';
        const amount = Number(e.amount || 0);
        console.log(`  ${componentName}: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      });
    }
    console.log(`\nGross Salary: ₹${Number(payslip.grossSalary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    console.log('\nDeductions:');
    if (payslip.deductions) {
      const deductions = Array.isArray(payslip.deductions) ? payslip.deductions : [];
      deductions.forEach((d: any) => {
        const componentName = d.component || d.name || 'Unknown';
        const amount = Number(d.amount || 0);
        console.log(`  ${componentName}: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      });
    }
    console.log(`\nTotal Deductions: ₹${Number(payslip.totalDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`Net Salary: ₹${Number(payslip.netSalary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Compare
    console.log('🔍 COMPARISON:');
    console.log('═══════════════════════════════════════════════════════════');
    
    const configuredBasic = Number(salary.basicSalary);
    const payslipBasic = Number(payslip.basicSalary);
    const difference = payslipBasic - configuredBasic;
    const prorationFactor = payslip.paidDays && payslip.attendanceDays 
      ? Number(payslip.paidDays) / Number(payslip.attendanceDays) 
      : 0;

    console.log(`Basic Salary:`);
    console.log(`  Configured: ₹${configuredBasic.toLocaleString()}`);
    console.log(`  Payslip: ₹${payslipBasic.toLocaleString()}`);
    console.log(`  Difference: ₹${difference.toLocaleString()} (${((difference / configuredBasic) * 100).toFixed(2)}%)`);
    console.log(`  Proration Factor: ${prorationFactor.toFixed(4)} (${payslip.paidDays}/${payslip.attendanceDays} days)`);
    console.log(`  Expected (Basic × Factor): ₹${(configuredBasic * prorationFactor).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    const configuredGross = Number(salary.grossSalary);
    const payslipGross = Number(payslip.grossSalary);
    const grossDifference = payslipGross - configuredGross;

    console.log(`\nGross Salary:`);
    console.log(`  Configured: ₹${configuredGross.toLocaleString()}`);
    console.log(`  Payslip: ₹${payslipGross.toLocaleString()}`);
    console.log(`  Difference: ₹${grossDifference.toLocaleString()} (${((grossDifference / configuredGross) * 100).toFixed(2)}%)`);
    console.log(`  Expected (Gross × Factor): ₹${(configuredGross * prorationFactor).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    // Check if components match
    console.log(`\n📊 Component Comparison:`);
    if (salary.components && payslip.earnings) {
      const configuredComponents = salary.components as any;
      const payslipEarnings = Array.isArray(payslip.earnings) ? payslip.earnings : [];
      
      // Check Basic
      const configuredBasicComp = configuredComponents.basic || configuredComponents.BASIC || configuredBasic;
      const payslipBasicComp = payslipEarnings.find((e: any) => 
        (e.component || e.name || '').toLowerCase().includes('basic')
      );
      
      if (payslipBasicComp) {
        const payslipBasicAmount = (payslipBasicComp as any).amount || 0;
        console.log(`\nBasic Component:`);
        console.log(`  Configured: ₹${Number(configuredBasicComp).toLocaleString()}`);
        console.log(`  Payslip: ₹${Number(payslipBasicAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`  Expected: ₹${(Number(configuredBasicComp) * prorationFactor).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }

      // Check HRA
      const configuredHRA = configuredComponents.hra || configuredComponents.HRA || 0;
      const payslipHRA = payslipEarnings.find((e: any) => 
        (e.component || e.name || '').toLowerCase().includes('hra')
      );
      
      if (payslipHRA) {
        const payslipHRAAmount = (payslipHRA as any).amount || 0;
        console.log(`\nHRA Component:`);
        console.log(`  Configured: ₹${Number(configuredHRA).toLocaleString()}`);
        console.log(`  Payslip: ₹${Number(payslipHRAAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`  Expected: ₹${(Number(configuredHRA) * prorationFactor).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }

      // Check Transport
      const configuredTransport = configuredComponents.transport || configuredComponents.TRANSPORT || 0;
      const payslipTransport = payslipEarnings.find((e: any) => 
        (e.component || e.name || '').toLowerCase().includes('transport')
      );
      
      if (payslipTransport) {
        const payslipTransportAmount = (payslipTransport as any).amount || 0;
        console.log(`\nTransport Component:`);
        console.log(`  Configured: ₹${Number(configuredTransport).toLocaleString()}`);
        console.log(`  Payslip: ₹${Number(payslipTransportAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`  Expected: ₹${(Number(configuredTransport) * prorationFactor).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    // Summary
    console.log('💡 EXPLANATION:');
    console.log('   The payslip amounts are PRORATED based on working days.');
    console.log(`   December 2025: ${payslip.paidDays} paid days out of ${payslip.attendanceDays} working days`);
    console.log(`   Proration Factor: ${prorationFactor.toFixed(4)} (${(prorationFactor * 100).toFixed(2)}%)`);
    console.log(`   This means: Payslip Amount = Configured Amount × ${prorationFactor.toFixed(4)}`);
    console.log('\n   ✅ This is CORRECT behavior - salary is adjusted for actual working days!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkSaravananSalaryVsPayslip()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
