import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api/v1';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  passed: boolean;
  message?: string;
}

// Helper function to make API calls
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
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { status: response.status, data: response.data };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    throw error;
  }
}

// Test SUPER_ADMIN access to all endpoints
async function testSuperAdminAccess(superAdminToken: string, testData: {
  organizationId: string;
  departmentId: string;
  positionId: string;
  employeeId: string;
}) {
  console.log('\n🔑 Testing SUPER_ADMIN Access to All Endpoints\n');
  console.log('='.repeat(70));

  const results: TestResult[] = [];

  // Test Organizations
  console.log('\n📊 Organizations');
  console.log('─'.repeat(70));

  let result = await apiCall('GET', `/organizations/${testData.organizationId}`, undefined, superAdminToken);
  results.push({
    endpoint: 'GET /organizations/:id',
    method: 'GET',
    status: result.status,
    passed: result.status === 200,
    message: result.data.message,
  });
  console.log(`${result.status === 200 ? '✅' : '❌'} GET /organizations/:id - Status: ${result.status}`);

  result = await apiCall('PUT', `/organizations/${testData.organizationId}`, { name: 'Test Org' }, superAdminToken);
  results.push({
    endpoint: 'PUT /organizations/:id',
    method: 'PUT',
    status: result.status,
    passed: result.status === 200,
    message: result.data.message,
  });
  console.log(`${result.status === 200 ? '✅' : '❌'} PUT /organizations/:id - Status: ${result.status}`);

  result = await apiCall('GET', `/organizations/${testData.organizationId}/statistics`, undefined, superAdminToken);
  results.push({
    endpoint: 'GET /organizations/:id/statistics',
    method: 'GET',
    status: result.status,
    passed: result.status === 200,
    message: result.data.message,
  });
  console.log(`${result.status === 200 ? '✅' : '❌'} GET /organizations/:id/statistics - Status: ${result.status}`);

  // Test Departments
  console.log('\n📁 Departments');
  console.log('─'.repeat(70));

  result = await apiCall('GET', '/departments', undefined, superAdminToken);
  results.push({
    endpoint: 'GET /departments',
    method: 'GET',
    status: result.status,
    passed: result.status === 200,
    message: result.data.message,
  });
  console.log(`${result.status === 200 ? '✅' : '❌'} GET /departments - Status: ${result.status}`);

  if (testData.departmentId) {
    result = await apiCall('GET', `/departments/${testData.departmentId}`, undefined, superAdminToken);
    results.push({
      endpoint: 'GET /departments/:id',
      method: 'GET',
      status: result.status,
      passed: result.status === 200,
      message: result.data.message,
    });
    console.log(`${result.status === 200 ? '✅' : '❌'} GET /departments/:id - Status: ${result.status}`);

    result = await apiCall('PUT', `/departments/${testData.departmentId}`, { name: 'Updated Dept' }, superAdminToken);
    results.push({
      endpoint: 'PUT /departments/:id',
      method: 'PUT',
      status: result.status,
      passed: result.status === 200,
      message: result.data.message,
    });
    console.log(`${result.status === 200 ? '✅' : '❌'} PUT /departments/:id - Status: ${result.status}`);

    result = await apiCall('DELETE', `/departments/${testData.departmentId}`, undefined, superAdminToken);
    results.push({
      endpoint: 'DELETE /departments/:id',
      method: 'DELETE',
      status: result.status,
      passed: result.status === 200,
      message: result.data.message,
    });
    console.log(`${result.status === 200 ? '✅' : '❌'} DELETE /departments/:id - Status: ${result.status}`);
  }

  result = await apiCall('POST', '/departments', {
    name: 'Super Admin Test Dept',
    code: 'SA-TEST',
    organizationId: testData.organizationId,
  }, superAdminToken);
  results.push({
    endpoint: 'POST /departments',
    method: 'POST',
    status: result.status,
    passed: result.status === 200 || result.status === 201,
    message: result.data.message,
  });
  console.log(`${(result.status === 200 || result.status === 201) ? '✅' : '❌'} POST /departments - Status: ${result.status}`);

  // Test Positions
  console.log('\n💼 Job Positions');
  console.log('─'.repeat(70));

  result = await apiCall('GET', '/positions', undefined, superAdminToken);
  results.push({
    endpoint: 'GET /positions',
    method: 'GET',
    status: result.status,
    passed: result.status === 200,
    message: result.data.message,
  });
  console.log(`${result.status === 200 ? '✅' : '❌'} GET /positions - Status: ${result.status}`);

  if (testData.positionId) {
    result = await apiCall('GET', `/positions/${testData.positionId}`, undefined, superAdminToken);
    results.push({
      endpoint: 'GET /positions/:id',
      method: 'GET',
      status: result.status,
      passed: result.status === 200,
      message: result.data.message,
    });
    console.log(`${result.status === 200 ? '✅' : '❌'} GET /positions/:id - Status: ${result.status}`);

    result = await apiCall('PUT', `/positions/${testData.positionId}`, { title: 'Updated Position' }, superAdminToken);
    results.push({
      endpoint: 'PUT /positions/:id',
      method: 'PUT',
      status: result.status,
      passed: result.status === 200,
      message: result.data.message,
    });
    console.log(`${result.status === 200 ? '✅' : '❌'} PUT /positions/:id - Status: ${result.status}`);

    result = await apiCall('DELETE', `/positions/${testData.positionId}`, undefined, superAdminToken);
    results.push({
      endpoint: 'DELETE /positions/:id',
      method: 'DELETE',
      status: result.status,
      passed: result.status === 200,
      message: result.data.message,
    });
    console.log(`${result.status === 200 ? '✅' : '❌'} DELETE /positions/:id - Status: ${result.status}`);
  }

  result = await apiCall('POST', '/positions', {
    title: 'Super Admin Test Position',
    code: 'SA-TEST-POS',
    departmentId: testData.departmentId || '00000000-0000-0000-0000-000000000001',
    organizationId: testData.organizationId,
  }, superAdminToken);
  results.push({
    endpoint: 'POST /positions',
    method: 'POST',
    status: result.status,
    passed: result.status === 200 || result.status === 201,
    message: result.data.message,
  });
  console.log(`${(result.status === 200 || result.status === 201) ? '✅' : '❌'} POST /positions - Status: ${result.status}`);

  // Test Employees
  console.log('\n👥 Employees');
  console.log('─'.repeat(70));

  result = await apiCall('GET', '/employees', undefined, superAdminToken);
  results.push({
    endpoint: 'GET /employees',
    method: 'GET',
    status: result.status,
    passed: result.status === 200,
    message: result.data.message,
  });
  console.log(`${result.status === 200 ? '✅' : '❌'} GET /employees - Status: ${result.status}`);

  if (testData.employeeId) {
    result = await apiCall('GET', `/employees/${testData.employeeId}`, undefined, superAdminToken);
    results.push({
      endpoint: 'GET /employees/:id',
      method: 'GET',
      status: result.status,
      passed: result.status === 200,
      message: result.data.message,
    });
    console.log(`${result.status === 200 ? '✅' : '❌'} GET /employees/:id - Status: ${result.status}`);

    result = await apiCall('PUT', `/employees/${testData.employeeId}`, { firstName: 'Updated' }, superAdminToken);
    results.push({
      endpoint: 'PUT /employees/:id',
      method: 'PUT',
      status: result.status,
      passed: result.status === 200,
      message: result.data.message,
    });
    console.log(`${result.status === 200 ? '✅' : '❌'} PUT /employees/:id - Status: ${result.status}`);

    result = await apiCall('DELETE', `/employees/${testData.employeeId}`, undefined, superAdminToken);
    results.push({
      endpoint: 'DELETE /employees/:id',
      method: 'DELETE',
      status: result.status,
      passed: result.status === 200,
      message: result.data.message,
    });
    console.log(`${result.status === 200 ? '✅' : '❌'} DELETE /employees/:id - Status: ${result.status}`);
  }

  result = await apiCall('GET', `/employees/statistics/${testData.organizationId}`, undefined, superAdminToken);
  results.push({
    endpoint: 'GET /employees/statistics/:orgId',
    method: 'GET',
    status: result.status,
    passed: result.status === 200,
    message: result.data.message,
  });
  console.log(`${result.status === 200 ? '✅' : '❌'} GET /employees/statistics/:orgId - Status: ${result.status}`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUPER_ADMIN ACCESS TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Endpoints Tested: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(2)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Endpoints:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.method} ${r.endpoint} (Status: ${r.status})`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('💡 SUPER_ADMIN should have access to ALL endpoints');
  console.log('   (200/201 status codes indicate success)');
  console.log('='.repeat(70) + '\n');
}

// Main execution
async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password || email === '--help') {
    console.log(`
Usage: npm run test:super-admin <email> <password>

This script tests SUPER_ADMIN access to all endpoints.

Example:
  npm run test:super-admin admin@example.com Admin@123456

Note: Make sure you have:
  1. Created a SUPER_ADMIN user (npm run create:super-admin)
  2. Created test data (departments, positions, employees)
  3. Backend server is running (npm run dev)
    `);
    process.exit(0);
  }

  try {
    console.log('🔐 Logging in as SUPER_ADMIN...');
    const { status, data } = await apiCall('POST', '/auth/login', {
      email,
      password,
    });

    if (status !== 200) {
      console.error(`❌ Login failed: ${data.message || JSON.stringify(data)}`);
      process.exit(1);
    }

    const tokens = data.tokens || data.data?.tokens || data;
    const token = tokens.accessToken;

    if (!token) {
      console.error('❌ No access token received');
      process.exit(1);
    }

    // Get user info to verify role
    const { status: userStatus, data: userData } = await apiCall('GET', '/auth/me', undefined, token);
    if (userStatus === 200) {
      const user = userData.data?.user || userData.user || userData;
      if (user.role !== 'SUPER_ADMIN') {
        console.error(`❌ User is not SUPER_ADMIN. Current role: ${user.role}`);
        console.error('   Please use: npm run upgrade:role <email> SUPER_ADMIN');
        process.exit(1);
      }
      console.log(`✅ Logged in as SUPER_ADMIN: ${user.email}\n`);
    }

    // Get organization ID (assuming first organization)
    const { status: orgStatus } = await apiCall('GET', '/organizations/00000000-0000-0000-0000-000000000001', undefined, token);
    let organizationId = '00000000-0000-0000-0000-000000000001';
    if (orgStatus !== 200) {
      // Try to get any organization
      const { data: deptsData } = await apiCall('GET', '/departments', undefined, token);
      if (deptsData.data?.departments?.[0]?.organizationId) {
        organizationId = deptsData.data.departments[0].organizationId;
      }
    }

    // Get test data IDs
    const { data: deptsData } = await apiCall('GET', '/departments', undefined, token);
    const departmentId = deptsData.data?.departments?.[0]?.id || deptsData.departments?.[0]?.id || '';

    const { data: posData } = await apiCall('GET', '/positions', undefined, token);
    const positionId = posData.data?.positions?.[0]?.id || posData.positions?.[0]?.id || '';

    const { data: empData } = await apiCall('GET', '/employees', undefined, token);
    const employeeId = empData.data?.employees?.[0]?.id || empData.employees?.[0]?.id || '';

    const testData = {
      organizationId,
      departmentId,
      positionId,
      employeeId,
    };

    await testSuperAdminAccess(token, testData);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
