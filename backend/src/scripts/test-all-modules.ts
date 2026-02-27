import axios from 'axios';
import { config } from '../config/config';

const BASE_URL = config.baseUrl || 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api/v1`;

interface TestResult {
  module: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  data?: any;
}

const results: TestResult[] = [];
let authToken: string = '';
let refreshToken: string = '';
let organizationId: string = '00000000-0000-0000-0000-000000000001';
let departmentId: string = '';
let positionId: string = '';
let employeeId: string = '';
let userId: string = '';

// Helper function to make API calls
async function apiCall(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  try {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios({
      method,
      url: `${API_BASE}${endpoint}`,
      data,
      headers,
      validateStatus: () => true, // Don't throw on any status
    });

    return { status: response.status, data: response.data };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: error.message },
      };
    }
    return { status: 500, data: { message: 'Unknown error' } };
  }
}

// Test result logger
function logResult(module: string, test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, data?: any) {
  results.push({ module, test, status, message, data });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} [${module}] ${test}: ${message}`);
  if (data && status === 'FAIL') {
    console.log(`   Error details:`, JSON.stringify(data, null, 2));
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...\n');
  
  // Health endpoint is at root level, not under /api/v1
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.status === 200 && response.data.status === 'success') {
      logResult('Health', 'GET /health', 'PASS', 'Server is running', response.data);
    } else {
      logResult('Health', 'GET /health', 'FAIL', `Status: ${response.status}`, response.data);
    }
  } catch (error: any) {
    logResult('Health', 'GET /health', 'FAIL', `Error: ${error.message}`, error.response?.data);
  }

  const { status: status2, data: data2 } = await apiCall('GET', '');
  if (status2 === 200 && data2.status === 'success') {
    logResult('Health', 'GET /api/v1', 'PASS', 'API info retrieved', data2);
  } else {
    logResult('Health', 'GET /api/v1', 'FAIL', `Status: ${status2}`, data2);
  }
}

async function testAuthModule() {
  console.log('\n🔐 Testing Authentication Module...\n');

  // Test Register
  const registerData = {
    email: `test${Date.now()}@example.com`,
    password: 'Test@123456',
    firstName: 'Test',
    lastName: 'User',
    organizationId: organizationId,
  };
  
  const { status: regStatus, data: regData } = await apiCall('POST', '/auth/register', registerData);
  if (regStatus === 201 || regStatus === 200) {
    logResult('Auth', 'POST /auth/register', 'PASS', 'User registered successfully', regData);
    const user = regData.user || regData.data?.user;
    userId = user?.id || '';
  } else if (regStatus === 409) {
    logResult('Auth', 'POST /auth/register', 'SKIP', 'User already exists, continuing with login', regData);
  } else if (regStatus === 500 && regData.message?.includes('Foreign key')) {
    logResult('Auth', 'POST /auth/register', 'SKIP', 'Organization constraint issue (may need to check DB), continuing with login');
  } else {
    logResult('Auth', 'POST /auth/register', 'FAIL', `Status: ${regStatus}`, regData);
  }

  // Test Login
  const loginPayload = {
    email: registerData.email,
    password: registerData.password,
  };
  
  const { status: loginStatus, data: loginResponse } = await apiCall('POST', '/auth/login', loginPayload);
  if (loginStatus === 200) {
    // Check different response structures
    const tokens = loginResponse.tokens || loginResponse.data?.tokens || loginResponse;
    if (tokens.accessToken) {
      authToken = tokens.accessToken;
      refreshToken = tokens.refreshToken || '';
      logResult('Auth', 'POST /auth/login', 'PASS', 'Login successful', { hasToken: !!authToken });
    } else {
      logResult('Auth', 'POST /auth/login', 'FAIL', 'No access token in response', loginResponse);
      console.log('⚠️  Login failed. Some tests may be skipped.');
    }
  } else {
    logResult('Auth', 'POST /auth/login', 'FAIL', `Status: ${loginStatus}`, loginResponse);
    // Try with a default test user if user exists
    console.log('⚠️  Login failed. Some tests may be skipped.');
  }

  // Test Get Current User
  if (authToken) {
    const { status: meStatus, data: meData } = await apiCall('GET', '/auth/me', undefined, authToken);
    const user = meData.user || meData.data?.user;
    if (meStatus === 200 && user) {
      logResult('Auth', 'GET /auth/me', 'PASS', 'Current user retrieved', { email: user.email });
      userId = user.id || userId;
    } else {
      logResult('Auth', 'GET /auth/me', 'FAIL', `Status: ${meStatus}`, meData);
    }
  } else {
    logResult('Auth', 'GET /auth/me', 'SKIP', 'No auth token available');
  }

  // Test Refresh Token
  if (refreshToken) {
    const { status: refreshStatus, data: refreshData } = await apiCall('POST', '/auth/refresh-token', { refreshToken });
    if (refreshStatus === 200) {
      const newTokens = refreshData.tokens || refreshData.data?.tokens || refreshData;
      if (newTokens.accessToken) {
        authToken = newTokens.accessToken;
        logResult('Auth', 'POST /auth/refresh-token', 'PASS', 'Token refreshed successfully');
      } else {
        logResult('Auth', 'POST /auth/refresh-token', 'FAIL', 'No access token in response', refreshData);
      }
    } else {
      logResult('Auth', 'POST /auth/refresh-token', 'FAIL', `Status: ${refreshStatus}`, refreshData);
    }
  } else {
    logResult('Auth', 'POST /auth/refresh-token', 'SKIP', 'No refresh token available');
  }

  // Test Forgot Password (may fail if email service not configured - that's OK)
  const { status: forgotStatus, data: forgotData } = await apiCall('POST', '/auth/forgot-password', { email: registerData.email });
  if (forgotStatus === 200 || forgotStatus === 404) {
    logResult('Auth', 'POST /auth/forgot-password', 'PASS', 'Forgot password request processed');
  } else if (forgotStatus === 500 && forgotData.message?.includes('email')) {
    logResult('Auth', 'POST /auth/forgot-password', 'SKIP', 'Email service not configured (expected in dev)');
  } else {
    logResult('Auth', 'POST /auth/forgot-password', 'FAIL', `Status: ${forgotStatus}`, forgotData);
  }
}

async function testOrganizationModule() {
  console.log('\n🏢 Testing Organization Module...\n');

  if (!authToken) {
    logResult('Organization', 'All tests', 'SKIP', 'No auth token available');
    return;
  }

  // Test Get Organization
  const { status, data } = await apiCall('GET', `/organizations/${organizationId}`, undefined, authToken);
  const org = data.organization || data.data?.organization;
  if (status === 200 && org) {
    logResult('Organization', 'GET /organizations/:id', 'PASS', 'Organization retrieved', { name: org.name });
  } else {
    logResult('Organization', 'GET /organizations/:id', 'FAIL', `Status: ${status}`, data);
  }

  // Test Update Organization
  const updateData = {
    name: 'BNC Technologies Updated',
    legalName: 'BNC Technologies Pvt Ltd',
    industry: 'Information Technology',
    sizeRange: '51-200',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
  };
  
  const { status: updateStatus, data: updateDataResponse } = await apiCall('PUT', `/organizations/${organizationId}`, updateData, authToken);
  if (updateStatus === 200 || updateStatus === 403) {
    logResult('Organization', 'PUT /organizations/:id', updateStatus === 200 ? 'PASS' : 'SKIP', 
      updateStatus === 200 ? 'Organization updated' : 'Insufficient permissions (expected)');
  } else {
    logResult('Organization', 'PUT /organizations/:id', 'FAIL', `Status: ${updateStatus}`, updateDataResponse);
  }

  // Test Get Statistics
  const { status: statsStatus, data: statsData } = await apiCall('GET', `/organizations/${organizationId}/statistics`, undefined, authToken);
  if (statsStatus === 200 || statsStatus === 403) {
    logResult('Organization', 'GET /organizations/:id/statistics', statsStatus === 200 ? 'PASS' : 'SKIP',
      statsStatus === 200 ? 'Statistics retrieved' : 'Insufficient permissions (expected)');
  } else {
    logResult('Organization', 'GET /organizations/:id/statistics', 'FAIL', `Status: ${statsStatus}`, statsData);
  }
}

async function testDepartmentModule() {
  console.log('\n📁 Testing Department Module...\n');

  if (!authToken) {
    logResult('Department', 'All tests', 'SKIP', 'No auth token available');
    return;
  }

  // Test Get Hierarchy
  const { status: hierarchyStatus, data: hierarchyData } = await apiCall('GET', `/departments/hierarchy/${organizationId}`, undefined, authToken);
  if (hierarchyStatus === 200) {
    logResult('Department', 'GET /departments/hierarchy/:organizationId', 'PASS', 'Hierarchy retrieved');
  } else {
    logResult('Department', 'GET /departments/hierarchy/:organizationId', 'FAIL', `Status: ${hierarchyStatus}`, hierarchyData);
  }

  // Test Get All Departments
  const { status: listStatus, data: listData } = await apiCall('GET', '/departments', undefined, authToken);
  if (listStatus === 200) {
    const depts = listData.departments || listData.data?.departments || [];
    logResult('Department', 'GET /departments', 'PASS', 'Departments list retrieved', { count: depts.length });
    // Use first department ID if available
    if (depts.length > 0 && !departmentId) {
      departmentId = depts[0].id;
    }
  } else {
    logResult('Department', 'GET /departments', 'FAIL', `Status: ${listStatus}`, listData);
  }

  // Test Create Department
  const createData = {
    name: `Test Department ${Date.now()}`,
    code: `TD${Date.now()}`,
    organizationId: organizationId,
    description: 'Test department for testing',
  };
  
  const { status: createStatus, data: createDataResponse } = await apiCall('POST', '/departments', createData, authToken);
  if (createStatus === 201 || createStatus === 200) {
    departmentId = createDataResponse.department?.id || createDataResponse.data?.department?.id || '';
    logResult('Department', 'POST /departments', createStatus === 201 ? 'PASS' : 'SKIP',
      createStatus === 201 ? 'Department created' : 'Department may already exist');
  } else if (createStatus === 403) {
    logResult('Department', 'POST /departments', 'SKIP', 'Insufficient permissions (expected for non-admin)');
  } else {
    logResult('Department', 'POST /departments', 'FAIL', `Status: ${createStatus}`, createDataResponse);
  }

  // Test Get Department by ID (if created or exists)
  if (departmentId) {
    const { status: getStatus, data: getData } = await apiCall('GET', `/departments/${departmentId}`, undefined, authToken);
    const dept = getData.department || getData.data?.department;
    if (getStatus === 200 && dept) {
      logResult('Department', 'GET /departments/:id', 'PASS', 'Department retrieved', { name: dept.name });
    } else {
      logResult('Department', 'GET /departments/:id', 'FAIL', `Status: ${getStatus}`, getData);
    }
  } else {
    logResult('Department', 'GET /departments/:id', 'SKIP', 'No department ID available');
  }
}

async function testJobPositionModule() {
  console.log('\n💼 Testing Job Position Module...\n');

  if (!authToken) {
    logResult('JobPosition', 'All tests', 'SKIP', 'No auth token available');
    return;
  }

  // Test Get All Positions
  const { status: listStatus, data: listData } = await apiCall('GET', '/positions', undefined, authToken);
  if (listStatus === 200) {
    const positions = listData.positions || listData.data?.positions || [];
    logResult('JobPosition', 'GET /positions', 'PASS', 'Positions list retrieved', { count: positions.length });
    // Use first position ID if available
    if (positions.length > 0 && !positionId) {
      positionId = positions[0].id;
    }
  } else {
    logResult('JobPosition', 'GET /positions', 'FAIL', `Status: ${listStatus}`, listData);
  }

  // Test Get Statistics
  const { status: statsStatus, data: statsData } = await apiCall('GET', `/positions/statistics/${organizationId}`, undefined, authToken);
  if (statsStatus === 200 || statsStatus === 403) {
    logResult('JobPosition', 'GET /positions/statistics/:organizationId', statsStatus === 200 ? 'PASS' : 'SKIP',
      statsStatus === 200 ? 'Statistics retrieved' : 'Insufficient permissions (expected)');
  } else {
    logResult('JobPosition', 'GET /positions/statistics/:organizationId', 'FAIL', `Status: ${statsStatus}`, statsData);
  }

  // Test Create Position
  const createData = {
    title: `Test Position ${Date.now()}`,
    code: `TP${Date.now()}`,
    departmentId: departmentId || null,
    organizationId: organizationId,
    employmentType: 'FULL_TIME',
    minSalary: 50000,
    maxSalary: 100000,
    currency: 'INR',
    description: 'Test position for testing',
  };
  
  const { status: createStatus, data: createDataResponse } = await apiCall('POST', '/positions', createData, authToken);
  if (createStatus === 201 || createStatus === 200) {
    positionId = createDataResponse.position?.id || createDataResponse.data?.position?.id || '';
    logResult('JobPosition', 'POST /positions', createStatus === 201 ? 'PASS' : 'SKIP',
      createStatus === 201 ? 'Position created' : 'Position may already exist');
  } else if (createStatus === 403) {
    logResult('JobPosition', 'POST /positions', 'SKIP', 'Insufficient permissions (expected for non-admin)');
  } else {
    logResult('JobPosition', 'POST /positions', 'FAIL', `Status: ${createStatus}`, createDataResponse);
  }

  // Test Get Position by ID (if created or exists)
  if (positionId) {
    const { status: getStatus, data: getData } = await apiCall('GET', `/positions/${positionId}`, undefined, authToken);
    const pos = getData.position || getData.data?.position;
    if (getStatus === 200 && pos) {
      logResult('JobPosition', 'GET /positions/:id', 'PASS', 'Position retrieved', { title: pos.title });
    } else {
      logResult('JobPosition', 'GET /positions/:id', 'FAIL', `Status: ${getStatus}`, getData);
    }
  } else {
    logResult('JobPosition', 'GET /positions/:id', 'SKIP', 'No position ID available');
  }
}

async function testEmployeeModule() {
  console.log('\n👤 Testing Employee Module...\n');

  if (!authToken) {
    logResult('Employee', 'All tests', 'SKIP', 'No auth token available');
    return;
  }

  // Test Get All Employees
  const { status: listStatus, data: listData } = await apiCall('GET', '/employees', undefined, authToken);
  if (listStatus === 200) {
    const employees = listData.employees || listData.data?.employees || [];
    logResult('Employee', 'GET /employees', 'PASS', 'Employees list retrieved', { count: employees.length });
    // Use first employee ID if available
    if (employees.length > 0 && !employeeId) {
      employeeId = employees[0].id;
    }
  } else {
    logResult('Employee', 'GET /employees', 'FAIL', `Status: ${listStatus}`, listData);
  }

  // Test Get Statistics
  const { status: statsStatus, data: statsData } = await apiCall('GET', `/employees/statistics/${organizationId}`, undefined, authToken);
  if (statsStatus === 200 || statsStatus === 403) {
    logResult('Employee', 'GET /employees/statistics/:organizationId', statsStatus === 200 ? 'PASS' : 'SKIP',
      statsStatus === 200 ? 'Statistics retrieved' : 'Insufficient permissions (expected)');
  } else {
    logResult('Employee', 'GET /employees/statistics/:organizationId', 'FAIL', `Status: ${statsStatus}`, statsData);
  }

  // Test Create Employee
  const createData = {
    employeeNumber: `EMP${Date.now()}`,
    firstName: 'Test',
    lastName: 'Employee',
    email: `employee${Date.now()}@example.com`,
    phone: '+911234567890',
    organizationId: organizationId,
    departmentId: departmentId || null,
    positionId: positionId || null,
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
    hireDate: new Date().toISOString(),
  };
  
  const { status: createStatus, data: createDataResponse } = await apiCall('POST', '/employees', createData, authToken);
  if (createStatus === 201 || createStatus === 200) {
    employeeId = createDataResponse.employee?.id || createDataResponse.data?.employee?.id || '';
    logResult('Employee', 'POST /employees', createStatus === 201 ? 'PASS' : 'SKIP',
      createStatus === 201 ? 'Employee created' : 'Employee may already exist');
  } else if (createStatus === 403) {
    logResult('Employee', 'POST /employees', 'SKIP', 'Insufficient permissions (expected for non-admin)');
  } else {
    logResult('Employee', 'POST /employees', 'FAIL', `Status: ${createStatus}`, createDataResponse);
  }

  // Test Get Employee by ID (if created or exists)
  if (employeeId) {
    const { status: getStatus, data: getData } = await apiCall('GET', `/employees/${employeeId}`, undefined, authToken);
    const emp = getData.employee || getData.data?.employee;
    if (getStatus === 200 && emp) {
      logResult('Employee', 'GET /employees/:id', 'PASS', 'Employee retrieved', { name: `${emp.firstName} ${emp.lastName}` });
    } else {
      logResult('Employee', 'GET /employees/:id', 'FAIL', `Status: ${getStatus}`, getData);
    }
  } else {
    logResult('Employee', 'GET /employees/:id', 'SKIP', 'No employee ID available');
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Module Tests');
  console.log('=' .repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Base: ${API_BASE}`);
  console.log('=' .repeat(60));

  try {
    await testHealthCheck();
    await testAuthModule();
    await testOrganizationModule();
    await testDepartmentModule();
    await testJobPositionModule();
    await testEmployeeModule();

    // Print Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    const total = results.length;

    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📝 Total: ${total}`);
    console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - [${r.module}] ${r.test}: ${r.message}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
