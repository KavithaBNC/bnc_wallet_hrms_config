/**
 * Script to test Mani's payslip view (simulating employee login)
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

async function testManiPayslipView() {
  try {
    console.log('🔍 Testing Mani\'s Payslip View...\n');

    // Step 1: Login as Mani
    console.log('1️⃣  Logging in as Mani...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'mani@gmail.com',
      password: 'Test@123', // Try common password
    }).catch(async (err) => {
      // If Test@123 doesn't work, try password123
      if (err.response?.status === 401) {
        console.log('   ⚠️  Test@123 failed, trying password123...');
        return await axios.post(`${API_BASE_URL}/auth/login`, {
          email: 'mani@gmail.com',
          password: 'password123',
        });
      }
      throw err;
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed');
      console.log('   Response:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.data.token;
    const user = loginResponse.data.data.user;
    const employeeId = user.employee?.id;

    console.log('   ✅ Login successful!');
    console.log(`   User: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Employee ID: ${employeeId || 'N/A'}`);

    if (!employeeId) {
      console.log('\n❌ Mani has no employee record linked to user account');
      return;
    }

    // Step 2: Fetch Mani's payslips
    console.log('\n2️⃣  Fetching Mani\'s payslips...');
    const payslipsResponse = await axios.get(
      `${API_BASE_URL}/payroll/payslips/employee/${employeeId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          page: '1',
          limit: '50',
        },
      }
    );

    const payslips = payslipsResponse.data.data || [];
    const pagination = payslipsResponse.data.pagination || {};

    console.log(`   ✅ Found ${payslips.length} payslip(s)`);
    console.log(`   Total: ${pagination.total || 0}`);

    if (payslips.length === 0) {
      console.log('\n❌ No payslips found for Mani');
      console.log('\n💡 Why no payslips?');
      console.log('   1. Payroll cycle not created yet');
      console.log('   2. Payroll cycle not processed yet');
      console.log('   3. Payslips only generated after processing payroll');
      console.log('\n📋 To generate payslips:');
      console.log('   1. Login as ORG_ADMIN');
      console.log('   2. Go to /payroll');
      console.log('   3. Create December 2025 payroll cycle');
      console.log('   4. Click "Process" button');
      console.log('   5. Mani will then see payslips');
      return;
    }

    // Step 3: Display payslips
    console.log('\n3️⃣  Payslip Details:');
    console.log('═══════════════════════════════════════════════════════════');
    payslips.forEach((payslip: any, index: number) => {
      console.log(`\n📄 Payslip ${index + 1}:`);
      console.log(`   ID: ${payslip.id}`);
      console.log(`   Period: ${new Date(payslip.periodStart).toLocaleDateString()} - ${new Date(payslip.periodEnd).toLocaleDateString()}`);
      console.log(`   Payment Date: ${new Date(payslip.paymentDate).toLocaleDateString()}`);
      console.log(`   Basic Salary: ₹${Number(payslip.basicSalary).toLocaleString()}`);
      console.log(`   Gross Salary: ₹${Number(payslip.grossSalary).toLocaleString()}`);
      console.log(`   Total Deductions: ₹${Number(payslip.totalDeductions).toLocaleString()}`);
      console.log(`   Net Salary: ₹${Number(payslip.netSalary).toLocaleString()}`);
      console.log(`   Attendance Days: ${payslip.attendanceDays || 'N/A'}`);
      console.log(`   Paid Days: ${payslip.paidDays || 'N/A'}`);
      console.log(`   Unpaid Days: ${payslip.unpaidDays || 'N/A'}`);
      console.log(`   Status: ${payslip.status}`);
      
      if (payslip.ytdGrossSalary) {
        console.log(`   YTD Gross: ₹${Number(payslip.ytdGrossSalary).toLocaleString()}`);
        console.log(`   YTD Deductions: ₹${Number(payslip.ytdDeductions).toLocaleString()}`);
        console.log(`   YTD Net: ₹${Number(payslip.ytdNetSalary).toLocaleString()}`);
      }
    });

    // Step 4: Test comprehensive payslip view
    if (payslips.length > 0) {
      console.log('\n4️⃣  Testing comprehensive payslip view...');
      const comprehensiveResponse = await axios.get(
        `${API_BASE_URL}/payroll/payslips/${payslips[0].id}/comprehensive`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const comprehensive = comprehensiveResponse.data.data;
      console.log('   ✅ Comprehensive view available');
      console.log(`   Earnings Breakdown: ${comprehensive.earningsBreakdown?.length || 0} items`);
      console.log(`   Deductions Breakdown: ${comprehensive.deductionsBreakdown?.length || 0} items`);
      if (comprehensive.bankDetails) {
        console.log(`   Bank: ${comprehensive.bankDetails.bankName} - ${comprehensive.bankDetails.accountNumber}`);
      }
    }

    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Mani can login: ✅`);
    console.log(`   - Mani has employee record: ✅`);
    console.log(`   - Payslips found: ${payslips.length > 0 ? '✅' : '❌'}`);
    if (payslips.length > 0) {
      console.log(`   - Payslip details accessible: ✅`);
    }

  } catch (error: any) {
    console.error('\n❌ Error testing Mani\'s payslip view:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.response.data?.error || 'Unknown error'}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response received. Is the backend running?');
      console.error('   Make sure backend is running on http://localhost:5000');
    } else {
      console.error('   Error:', error.message);
    }
  }
}

testManiPayslipView()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
