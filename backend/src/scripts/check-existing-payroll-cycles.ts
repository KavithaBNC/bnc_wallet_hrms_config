/**
 * Script to check existing payroll cycles
 */

import { prisma } from '../utils/prisma';

async function checkExistingPayrollCycles() {
  try {
    console.log('🔍 Checking existing payroll cycles...\n');

    // Get all payroll cycles
    const cycles = await prisma.payrollCycle.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        payslips: {
          select: { id: true, employeeId: true },
        },
        _count: {
          select: { payslips: true },
        },
      },
    });

    if (cycles.length === 0) {
      console.log('❌ No payroll cycles found');
      return;
    }

    console.log(`✅ Found ${cycles.length} payroll cycle(s):\n`);
    console.log('═══════════════════════════════════════════════════════════');

    cycles.forEach((cycle, index) => {
      const payrollMonth = (cycle as any).payrollMonth || 'N/A';
      const payrollYear = (cycle as any).payrollYear || 'N/A';
      const isLocked = (cycle as any).isLocked || false;
      const payslipCount = cycle._count?.payslips || 0;

      console.log(`\n${index + 1}. ${cycle.name}`);
      console.log(`   ID: ${cycle.id}`);
      console.log(`   Organization: ${cycle.organization.name}`);
      console.log(`   Period: ${new Date(cycle.periodStart).toLocaleDateString()} - ${new Date(cycle.periodEnd).toLocaleDateString()}`);
      console.log(`   Month/Year: ${payrollMonth}/${payrollYear}`);
      console.log(`   Payment Date: ${new Date(cycle.paymentDate).toLocaleDateString()}`);
      console.log(`   Status: ${cycle.status}`);
      console.log(`   Locked: ${isLocked ? '🔒 Yes' : '🔓 No'}`);
      console.log(`   Payslips: ${payslipCount}`);
      console.log(`   Created: ${new Date(cycle.createdAt).toLocaleString()}`);

      // Show action needed
      if (cycle.status === 'DRAFT') {
        console.log(`   ⚠️  Action: Process this cycle to generate payslips`);
      } else if (cycle.status === 'PROCESSED') {
        console.log(`   ✅ Processed - Payslips should be available`);
      } else if (cycle.status === 'FINALIZED') {
        console.log(`   🔒 Finalized - Cannot modify`);
      } else if (cycle.status === 'PAID') {
        console.log(`   💰 Paid - Completed`);
      }
    });

    // Check for December 2025 specifically
    const december2025 = cycles.find((c) => {
      const month = (c as any).payrollMonth;
      const year = (c as any).payrollYear;
      return month === 12 && year === 2025;
    });

    if (december2025) {
      console.log('\n\n🎯 December 2025 Payroll Cycle Found:');
      console.log(`   Name: ${december2025.name}`);
      console.log(`   Status: ${december2025.status}`);
      console.log(`   Payslips: ${december2025._count?.payslips || 0}`);
      
      if (december2025.status === 'DRAFT') {
        console.log('\n   💡 Next Step: Process this cycle to generate payslips for Mani');
        console.log('      - Go to /payroll in frontend');
        console.log('      - Find this cycle in the list');
        console.log('      - Click "⚙️ Process" button');
      } else if (december2025.status === 'PROCESSED') {
        console.log('\n   ✅ Cycle is processed - Payslips should be available!');
        console.log('      - Mani should be able to see payslips now');
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error checking payroll cycles:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkExistingPayrollCycles()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
