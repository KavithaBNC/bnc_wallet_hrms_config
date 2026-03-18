/**
 * Direct test of payslip calculation to find the bug
 */

async function testCalculation() {
  try {
    console.log('🧪 Testing Payslip Calculation Directly...\n');

    // Simulate Mani's scenario
    const basicSalary = 50000;
    const grossSalary = 75000;
    const paidDays = 22;
    const totalWorkingDays = 23;
    const prorationFactor = 0; // This is the problem - joining date after period

    console.log('📊 Input Parameters:');
    console.log(`   Basic Salary: ₹${basicSalary.toLocaleString()}`);
    console.log(`   Gross Salary: ₹${grossSalary.toLocaleString()}`);
    console.log(`   Paid Days: ${paidDays}`);
    console.log(`   Total Working Days: ${totalWorkingDays}`);
    console.log(`   Proration Factor: ${prorationFactor}\n`);

    // Test the calculation logic
    const paidDaysFactor = totalWorkingDays > 0 ? paidDays / totalWorkingDays : 0;
    console.log(`   Paid Days Factor: ${paidDaysFactor}`);

    // Current logic (from code)
    const finalProrationFactor1 = prorationFactor > 0 ? prorationFactor * paidDaysFactor : paidDaysFactor;
    console.log(`   Final Proration Factor (current): ${finalProrationFactor1}`);

    // Calculate basic amount with current logic
    const basicAmount1 = totalWorkingDays > 0 && paidDays > 0 
      ? basicSalary * finalProrationFactor1 
      : (prorationFactor > 0 ? basicSalary * prorationFactor : basicSalary * paidDaysFactor);
    
    console.log(`\n💰 Calculation Result (current logic):`);
    console.log(`   Basic Amount: ₹${basicAmount1.toLocaleString()}`);
    console.log(`   Expected: ₹${(basicSalary * paidDaysFactor).toLocaleString()}\n`);

    if (basicAmount1 === 0) {
      console.log('❌ PROBLEM: Basic amount is 0!');
      console.log('\n🔍 Debugging the condition:');
      console.log(`   totalWorkingDays > 0 && paidDays > 0: ${totalWorkingDays > 0 && paidDays > 0}`);
      console.log(`   prorationFactor > 0: ${prorationFactor > 0}`);
      console.log(`   basicSalary * finalProrationFactor1: ${basicSalary * finalProrationFactor1}`);
      console.log(`   basicSalary * prorationFactor: ${basicSalary * prorationFactor}`);
      console.log(`   basicSalary * paidDaysFactor: ${basicSalary * paidDaysFactor}\n`);

      console.log('💡 The issue is in the ternary condition!');
      console.log('   When prorationFactor = 0, finalProrationFactor = paidDaysFactor (correct)');
      console.log('   But the ternary checks: totalWorkingDays > 0 && paidDays > 0');
      console.log('   If true, uses: basicSalary * finalProrationFactor1');
      console.log('   If false, uses the nested ternary which might also fail\n');

      // Fixed logic
      console.log('✅ FIXED LOGIC:');
      const finalProrationFactor2 = prorationFactor > 0 ? prorationFactor * paidDaysFactor : paidDaysFactor;
      // Safety check
      const safeProrationFactor = finalProrationFactor2 === 0 && paidDays > 0 && totalWorkingDays > 0 
        ? paidDaysFactor 
        : finalProrationFactor2;
      const basicAmount2 = basicSalary * safeProrationFactor;
      console.log(`   Safe Proration Factor: ${safeProrationFactor}`);
      console.log(`   Basic Amount (fixed): ₹${basicAmount2.toLocaleString()}\n`);
    } else {
      console.log('✅ Calculation works correctly!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCalculation();
