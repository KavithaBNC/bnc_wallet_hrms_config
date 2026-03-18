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
  employeeId: '',
  leaveTypeId: '',
  leaveRequestId: '',
  shiftId: '',
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
  } catch (error: unknown) {
    if (error instanceof AxiosError && error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    throw error;
  }
}

async function setupTestUser() {
  console.log('\n👥 Setting up test user...\n');

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

async function testShiftManagement() {
  console.log('\n⏰ Testing Shift Management...\n');

  if (!testData.organizationId) {
    logResult('Shift Tests', 'SKIP', 'Missing organizationId');
    return;
  }

  // Create shift
  const { status, data } = await apiCall(
    'POST',
    '/shifts',
    {
      organizationId: testData.organizationId,
      name: 'Morning Shift',
      code: 'MORN',
      startTime: '09:00',
      endTime: '18:00',
      breakDuration: 60,
      geofenceEnabled: true,
      geofenceRadius: 100,
      geofenceLocation: {
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Test Office Location',
      },
    },
    adminToken
  );

  if (status === 201 || status === 200) {
    const shift = data.data?.shift || data.shift || data;
    testData.shiftId = shift.id;
    logResult('POST /shifts', 'PASS', `Created shift: ${shift.id}`);
  } else {
    logResult('POST /shifts', 'FAIL', `Status: ${status} - ${data.message || JSON.stringify(data)}`);
  }

  // Get all shifts
  const { status: listStatus } = await apiCall('GET', '/shifts', undefined, adminToken);
  logResult('GET /shifts', listStatus === 200 ? 'PASS' : 'FAIL', `Status: ${listStatus}`);

  // Get shift by ID
  if (testData.shiftId) {
    const { status: getStatus } = await apiCall('GET', `/shifts/${testData.shiftId}`, undefined, adminToken);
    logResult('GET /shifts/:id', getStatus === 200 ? 'PASS' : 'FAIL', `Status: ${getStatus}`);
  }
}

async function testAttendanceManagement() {
  console.log('\n📊 Testing Attendance Management...\n');

  if (!testData.employeeId) {
    logResult('Attendance Tests', 'SKIP', 'Missing employeeId');
    return;
  }

  // Check-in
  const { status, data } = await apiCall(
    'POST',
    '/attendance/check-in',
    {
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Office Location',
      },
      notes: 'Testing check-in functionality',
    },
    adminToken
  );

  if (status === 201 || status === 200) {
    logResult('POST /attendance/check-in', 'PASS', 'Checked in successfully');
  } else {
    logResult('POST /attendance/check-in', 'FAIL', `Status: ${status} - ${data.message || JSON.stringify(data)}`);
  }

  // Check-out
  const { status: checkoutStatus } = await apiCall(
    'POST',
    '/attendance/check-out',
    {
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Office Location',
      },
      notes: 'Testing check-out functionality',
    },
    adminToken
  );

  logResult('POST /attendance/check-out', checkoutStatus === 200 ? 'PASS' : 'FAIL', `Status: ${checkoutStatus}`);

  // Get attendance records
  const { status: recordsStatus } = await apiCall('GET', '/attendance/records', undefined, adminToken);
  logResult('GET /attendance/records', recordsStatus === 200 ? 'PASS' : 'FAIL', `Status: ${recordsStatus}`);

  // Get attendance summary
  if (testData.employeeId) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();

    const { status: summaryStatus } = await apiCall(
      'GET',
      `/attendance/summary/${testData.employeeId}?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
      undefined,
      adminToken
    );
    logResult('GET /attendance/summary/:employeeId', summaryStatus === 200 ? 'PASS' : 'FAIL', `Status: ${summaryStatus}`);
  }
}

async function testAttendanceRegularization() {
  console.log('\n📝 Testing Attendance Regularization...\n');

  if (!testData.employeeId) {
    logResult('Regularization Tests', 'SKIP', 'Missing employeeId');
    return;
  }

  // Create regularization request
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { status, data } = await apiCall(
    'POST',
    '/attendance/regularization',
    {
      date: yesterday.toISOString().split('T')[0],
      requestedCheckIn: `${yesterday.toISOString().split('T')[0]}T09:00:00`,
      requestedCheckOut: `${yesterday.toISOString().split('T')[0]}T18:00:00`,
      reason: 'Forgot to check in yesterday - testing regularization functionality',
    },
    adminToken
  );

  if (status === 201 || status === 200) {
    const regularization = data.data?.regularization || data.regularization || data;
    logResult('POST /attendance/regularization', 'PASS', `Created regularization: ${regularization.id}`);
  } else {
    logResult('POST /attendance/regularization', 'FAIL', `Status: ${status} - ${data.message || JSON.stringify(data)}`);
  }

  // Get all regularizations
  const { status: listStatus } = await apiCall('GET', '/attendance/regularization', undefined, adminToken);
  logResult('GET /attendance/regularization', listStatus === 200 ? 'PASS' : 'FAIL', `Status: ${listStatus}`);
}

async function testLeaveManagement() {
  console.log('\n🏖️  Testing Leave Management...\n');

  if (!testData.organizationId || !testData.employeeId) {
    logResult('Leave Tests', 'SKIP', 'Missing test data');
    return;
  }

  // Get leave types
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

  // Apply for leave
  if (testData.leaveTypeId) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { status: applyStatus, data: applyData } = await apiCall(
      'POST',
      '/leaves/requests',
      {
        leaveTypeId: testData.leaveTypeId,
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0],
        reason: 'Testing leave request functionality',
      },
      adminToken
    );

    if (applyStatus === 201 || applyStatus === 200) {
      const leaveRequest = applyData.data?.leaveRequest || applyData.leaveRequest || applyData;
      testData.leaveRequestId = leaveRequest.id;
      logResult('POST /leaves/requests', 'PASS', `Created leave request: ${leaveRequest.id}`);
    } else {
      logResult('POST /leaves/requests', 'FAIL', `Status: ${applyStatus} - ${applyData.message || JSON.stringify(applyData)}`);
    }
  }

  // Get leave balance
  if (testData.employeeId) {
    const { status: balanceStatus } = await apiCall('GET', `/leaves/balance/${testData.employeeId}`, undefined, adminToken);
    logResult('GET /leaves/balance/:employeeId', balanceStatus === 200 ? 'PASS' : 'FAIL', `Status: ${balanceStatus}`);
  }
}

async function testCoreModules() {
  console.log('\n👥 Testing Core Modules (Employee, Department, Position)...\n');

  // Test Employees
  const { status: empStatus } = await apiCall('GET', '/employees', undefined, adminToken);
  logResult('GET /employees', empStatus === 200 ? 'PASS' : 'FAIL', `Status: ${empStatus}`);

  // Test Departments
  const { status: deptStatus } = await apiCall('GET', '/departments', undefined, adminToken);
  logResult('GET /departments', deptStatus === 200 ? 'PASS' : 'FAIL', `Status: ${deptStatus}`);

  // Test Positions
  const { status: posStatus } = await apiCall('GET', '/positions', undefined, adminToken);
  logResult('GET /positions', posStatus === 200 ? 'PASS' : 'FAIL', `Status: ${posStatus}`);
}

async function main() {
  console.log('🧪 COMPREHENSIVE HRMS TEST SUITE - ALL MODULES');
  console.log('='.repeat(70));

  try {
    await setupTestUser();
    await testCoreModules();
    await testShiftManagement();
    await testAttendanceManagement();
    await testAttendanceRegularization();
    await testLeaveManagement();

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
    console.log('3. Ensure server is running: npm run dev');
    console.log('='.repeat(70) + '\n');

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
