/**
 * Script to re-process December 2025 payroll cycle
 * This deletes existing payslips (if any) and re-processes the cycle
 */

import { prisma } from '../utils/prisma';

async function reprocessDecemberPayroll() {
  try {
    console.log('🔍 Finding December 2025 payroll cycle...\n');

    // Find December 2025 cycle
    const cycle = await prisma.payrollCycle.findFirst({
      where: {
        payrollMonth: 12,
        payrollYear: 2025,
      },
      include: {
        payslips: true,
      },
    });

    if (!cycle) {
      console.log('❌ December 2025 cycle not found');
      return;
    }

    console.log(`✅ Found cycle: ${cycle.name}`);
    console.log(`   ID: ${cycle.id}`);
    console.log(`   Status: ${cycle.status}`);
    console.log(`   Current Payslips: ${cycle.payslips.length}\n`);

    // Check if cycle can be re-processed
    if (cycle.status === 'PAID') {
      console.log('❌ Cannot re-process a PAID cycle');
      return;
    }

    if ((cycle as any).isLocked && cycle.status === 'FINALIZED') {
      console.log('❌ Cycle is FINALIZED and locked. Cannot re-process.');
      console.log('   Use rollback first, then re-process.');
      return;
    }

    // Delete existing payslips for this cycle
    if (cycle.payslips.length > 0) {
      console.log(`🗑️  Deleting ${cycle.payslips.length} existing payslip(s)...`);
      await prisma.payslip.deleteMany({
        where: {
          payrollCycleId: cycle.id,
        },
      });
      console.log('   ✅ Payslips deleted\n');
    }

    // Reset cycle status to DRAFT so it can be processed
    console.log('🔄 Resetting cycle status to DRAFT...');
    await prisma.payrollCycle.update({
      where: { id: cycle.id },
      data: {
        status: 'DRAFT',
        processedBy: null as any,
        processedAt: null as any,
        totalEmployees: null,
        totalGross: null,
        totalDeductions: null,
        totalNet: null,
      } as any,
    });
    console.log('   ✅ Cycle reset to DRAFT\n');

    console.log('✅ Cycle is now ready to be processed!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Go to http://localhost:3000/payroll');
    console.log('   2. Find "Deember 2025" cycle');
    console.log('   3. Click "⚙️ Process" button');
    console.log('   4. Payslips will be generated for Mani and Saravanan');
    console.log('   5. Mani can then see his payslip!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

reprocessDecemberPayroll()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
