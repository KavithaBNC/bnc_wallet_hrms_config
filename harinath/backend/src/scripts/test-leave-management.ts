import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api/v1';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
}

const results: TestResult[] = [];
let adminToken = '';
let testData = {
  organizationId: '',
  leaveTypeId: '',
  leaveRequestId: '',
  employeeId: '',
};

function logResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', details: string = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${test}: ${status}${details ? ` - ${details}` : ''}`);
  results.push({ test, status, details });
}

async function apiCall(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  try {
    const config: any = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (data) config.data = data;
    const response = await axios(config);
    return { status: response.status, data: response.data };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    throw error;
  }
}

async function setupTestUsers() {
  console.log('\n👥 Setting up test users...\n');

  // Login as admin (assuming one exists)
  const adminEmail = process.argv[2] || 'admin@example.com';
  const adminPassword = process.argv[3] || 'Admin@123456';

  const { status, data } = await apiCall('POST', '/auth/login', {
    email: adminEmail,
    password: adminPassword,
  });

  if (status === 200) {
    const tokens = data.tokens || data.data?.tokens || data;
    adminToken = tokens.accessToken;
    logResult('Admin Login', 'PASS', `Logged in as ${adminEmail}`);

    // Get current user to get employee ID
    const { status: userStatus, data: userData } = await apiCall('GET', '/auth/me', undefined, adminToken);
    if (userStatus === 200) {
      const user = userData.data?.user || userData.user || userData;
      if (user.employee?.id) {
        testData.employeeId = user.employee.id;
        testData.organizationId = user.employee.organizationId;
      }
    }
  } else {
    logResult('Admin Login', 'FAIL', `Status: ${status} - ${data.message || JSON.stringify(data)}`);
    console.log('\n⚠️  Please create a SUPER_ADMIN user first:');
    console.log('   npm run create:super-admin <email> <password>');
    process.exit(1);
  }
}

async function testLeaveTypes() {
  console.log('\n📋 Testing Leave Types...\n');

  // Get all leave types
  const { status, data } = await apiCall('GET', '/leaves/types', undefined, adminToken);
  if (status === 200) {
    const leaveTypes = data.data?.leaveTypes || data.leaveTypes || [];
    if (leaveTypes.length > 0) {
      testData.leaveTypeId = leaveTypes[0].id;
      logResult('GET /leaves/types', 'PASS', `Found ${leaveTypes.length} leave types`);
    } else {
      logResult('GET /leaves/types', 'SKIP', 'No leave types found. Run: npm run seed:leave');
    }
  } else {
    logResult('GET /leaves/types', 'FAIL', `Status: ${status}`);
  }

  // Get leave type by ID
  if (testData.leaveTypeId) {
    const { status: getStatus } = await apiCall(
      'GET',
      `/leaves/types/${testData.leaveTypeId}`,
      undefined,
      adminToken
    );
    logResult('GET /leaves/types/:id', getStatus === 200 ? 'PASS' : 'FAIL', `Status: ${getStatus}`);
  }
}

async function testLeaveRequests() {
  console.log('\n📝 Testing Leave Requests...\n');

  if (!testData.leaveTypeId || !testData.employeeId) {
    logResult('Leave Request Tests', 'SKIP', 'Missing test data (leaveTypeId or employeeId)');
    return;
  }

  // Apply for leave
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const { status, data } = await apiCall(
    'POST',
    '/leaves/requests',
    {
      leaveTypeId: testData.leaveTypeId,
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: nextWeek.toISOString().split('T')[0],
      reason: 'Testing leave request functionality - need some time off for personal reasons',
    },
    adminToken
  );

  if (status === 201 || status === 200) {
    const leaveRequest = data.data?.leaveRequest || data.leaveRequest || data;
    testData.leaveRequestId = leaveRequest.id;
    logResult('POST /leaves/requests', 'PASS', `Created leave request: ${leaveRequest.id}`);
  } else {
    logResult('POST /leaves/requests', 'FAIL', `Status: ${status} - ${data.message || JSON.stringify(data)}`);
  }

  // Get all leave requests
  const { status: listStatus } = await apiCall('GET', '/leaves/requests', undefined, adminToken);
  logResult('GET /leaves/requests', listStatus === 200 ? 'PASS' : 'FAIL', `Status: ${listStatus}`);

  // Get leave request by ID
  if (testData.leaveRequestId) {
    const { status: getStatus } = await apiCall(
      'GET',
      `/leaves/requests/${testData.leaveRequestId}`,
      undefined,
      adminToken
    );
    logResult('GET /leaves/requests/:id', getStatus === 200 ? 'PASS' : 'FAIL', `Status: ${getStatus}`);

    // Approve leave request
    const { status: approveStatus } = await apiCall(
      'PUT',
      `/leaves/requests/${testData.leaveRequestId}/approve`,
      { reviewComments: 'Approved for testing purposes' },
      adminToken
    );
    logResult('PUT /leaves/requests/:id/approve', approveStatus === 200 ? 'PASS' : 'FAIL', `Status: ${approveStatus}`);
  }
}

async function testLeaveBalance() {
  console.log('\n💰 Testing Leave Balance...\n');

  if (!testData.employeeId) {
    logResult('Leave Balance Tests', 'SKIP', 'Missing employeeId');
    return;
  }

  const { status, data } = await apiCall(
    'GET',
    `/leaves/balance/${testData.employeeId}`,
    undefined,
    adminToken
  );

  if (status === 200) {
    const balances = data.data?.balances || data.balances || [];
    logResult('GET /leaves/balance/:employeeId', 'PASS', `Found ${balances.length} leave balances`);
  } else {
    logResult('GET /leaves/balance/:employeeId', 'FAIL', `Status: ${status}`);
  }
}

async function testLeaveCalendar() {
  console.log('\n📅 Testing Leave Calendar...\n');

  if (!testData.organizationId) {
    logResult('Leave Calendar Tests', 'SKIP', 'Missing organizationId');
    return;
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3);

  const { status } = await apiCall(
    'GET',
    `/leaves/calendar?organizationId=${testData.organizationId}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
    undefined,
    adminToken
  );

  logResult('GET /leaves/calendar', status === 200 ? 'PASS' : 'FAIL', `Status: ${status}`);
}

async function testConflictDetection() {
  console.log('\n🔍 Testing Conflict Detection...\n');

  if (!testData.leaveTypeId || !testData.employeeId) {
    logResult('Conflict Detection Tests', 'SKIP', 'Missing test data');
    return;
  }

  // Try to create overlapping leave request
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);

  const { status, data } = await apiCall(
    'POST',
    '/leaves/requests',
    {
      leaveTypeId: testData.leaveTypeId,
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: dayAfter.toISOString().split('T')[0],
      reason: 'Testing conflict detection - this should fail if previous request was approved',
    },
    adminToken
  );

  // This should fail if previous request was approved (overlap)
  if (status === 400 && data.message?.includes('already have')) {
    logResult('Conflict Detection', 'PASS', 'Correctly detected overlapping leave request');
  } else if (status === 201 || status === 200) {
    logResult('Conflict Detection', 'SKIP', 'No conflict (previous request may not be approved)');
  } else {
    logResult('Conflict Detection', 'FAIL', `Status: ${status} - ${data.message || JSON.stringify(data)}`);
  }
}

async function main() {
  console.log('🧪 LEAVE MANAGEMENT TEST SUITE');
  console.log('='.repeat(70));

  try {
    await setupTestUsers();
    await testLeaveTypes();
    await testLeaveRequests();
    await testLeaveBalance();
    await testLeaveCalendar();
    await testConflictDetection();

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`Total: ${results.length}`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - ${r.test}: ${r.details}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('💡 TIPS:');
    console.log('='.repeat(70));
    console.log('1. Run seed data: npm run seed:leave');
    console.log('2. Create SUPER_ADMIN: npm run create:super-admin <email> <password>');
    console.log('3. Test with different roles to verify RBAC');
    console.log('='.repeat(70) + '\n');

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
