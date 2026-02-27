import axios from 'axios';
import { config } from '../config/config';

const BASE_URL = config.baseUrl || 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api/v1`;

interface TestResult {
  module: string;
  operation: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
}

const results: TestResult[] = [];
let adminToken: string = '';
let organizationId: string = '00000000-0000-0000-0000-000000000001';
let departmentId: string = '';
let positionId: string = '';
let employeeId: string = '';

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
      validateStatus: () => true,
    });

    return { status: response.status, data: response.data };
  } catch (error: any) {
    return {
      status: error.response?.status || 500,
      data: error.response?.data || { message: error.message },
    };
  }
}

function logResult(module: string, operation: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string) {
  results.push({ module, operation, status, message });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} [${module}] ${operation}: ${message}`);
}

async function createAdminUser() {
  console.log('\n👤 Creating Admin User for Testing...\n');

  const adminEmail = `admin${Date.now()}@test.com`;
  const adminPassword = 'Admin@123456';

  // Register admin user
  const { status: regStatus, data: regData } = await apiCall('POST', '/auth/register', {
    email: adminEmail,
    password: adminPassword,
    firstName: 'Admin',
    lastName: 'User',
    role: 'HR_MANAGER', // Register as HR_MANAGER
  });

  if (regStatus !== 201 && regStatus !== 200) {
    logResult('Setup', 'Register Admin', 'FAIL', `Status: ${regStatus} - ${regData.message || JSON.stringify(regData)}`);
    return null;
  }

  // Login as admin
  const { status: loginStatus, data: loginData } = await apiCall('POST', '/auth/login', {
    email: adminEmail,
    password: adminPassword,
  });

  if (loginStatus === 200) {
    const tokens = loginData.tokens || loginData.data?.tokens || loginData;
    if (tokens.accessToken) {
      adminToken = tokens.accessToken;
      logResult('Setup', 'Login Admin', 'PASS', 'Admin user logged in');
      return { email: adminEmail, password: adminPassword };
    }
  }

  logResult('Setup', 'Login Admin', 'FAIL', `Status: ${loginStatus}`);
  return null;
}

async function testDepartmentCRUD() {
  console.log('\n📁 Testing Department CRUD Operations...\n');

  if (!adminToken) {
    logResult('Department', 'All operations', 'SKIP', 'No admin token available');
    return;
  }

  // CREATE
  const createData = {
    name: `Test Department ${Date.now()}`,
    code: `TD${Date.now()}`,
    organizationId: organizationId,
    description: 'Test department for CRUD testing',
  };

  const { status: createStatus, data: createDataResponse } = await apiCall('POST', '/departments', createData, adminToken);
  if (createStatus === 201 || createStatus === 200) {
    departmentId = createDataResponse.department?.id || createDataResponse.data?.department?.id || '';
    logResult('Department', 'CREATE', 'PASS', `Department created: ${createData.name}`);
  } else {
    logResult('Department', 'CREATE', 'FAIL', `Status: ${createStatus} - ${createDataResponse.message || JSON.stringify(createDataResponse)}`);
    return;
  }

  // READ (Get by ID)
  if (departmentId) {
    const { status: getStatus, data: getData } = await apiCall('GET', `/departments/${departmentId}`, undefined, adminToken);
    const dept = getData.department || getData.data?.department;
    if (getStatus === 200 && dept) {
      logResult('Department', 'READ', 'PASS', `Department retrieved: ${dept.name}`);
    } else {
      logResult('Department', 'READ', 'FAIL', `Status: ${getStatus}`);
    }
  }

  // UPDATE
  if (departmentId) {
    const updateData = {
      name: `Updated Department ${Date.now()}`,
      description: 'Updated description',
    };
    const { status: updateStatus, data: updateDataResponse } = await apiCall('PUT', `/departments/${departmentId}`, updateData, adminToken);
    if (updateStatus === 200) {
      logResult('Department', 'UPDATE', 'PASS', 'Department updated successfully');
    } else {
      logResult('Department', 'UPDATE', 'FAIL', `Status: ${updateStatus} - ${updateDataResponse.message || JSON.stringify(updateDataResponse)}`);
    }
  }

  // DELETE (optional - comment out if you want to keep test data)
  // if (departmentId) {
  //   const { status: deleteStatus } = await apiCall('DELETE', `/departments/${departmentId}`, undefined, adminToken);
  //   if (deleteStatus === 200) {
  //     logResult('Department', 'DELETE', 'PASS', 'Department deleted successfully');
  //   } else {
  //     logResult('Department', 'DELETE', 'FAIL', `Status: ${deleteStatus}`);
  //   }
  // }
}

async function testPositionCRUD() {
  console.log('\n💼 Testing Job Position CRUD Operations...\n');

  if (!adminToken) {
    logResult('Position', 'All operations', 'SKIP', 'No admin token available');
    return;
  }

  // CREATE
  const createData = {
    title: `Test Position ${Date.now()}`,
    code: `TP${Date.now()}`,
    organizationId: organizationId,
    departmentId: departmentId || null,
    employmentType: 'FULL_TIME',
    description: 'Test position for CRUD testing',
  };

  const { status: createStatus, data: createDataResponse } = await apiCall('POST', '/positions', createData, adminToken);
  if (createStatus === 201 || createStatus === 200) {
    positionId = createDataResponse.position?.id || createDataResponse.data?.position?.id || '';
    logResult('Position', 'CREATE', 'PASS', `Position created: ${createData.title}`);
  } else {
    logResult('Position', 'CREATE', 'FAIL', `Status: ${createStatus} - ${createDataResponse.message || JSON.stringify(createDataResponse)}`);
    return;
  }

  // READ (Get by ID)
  if (positionId) {
    const { status: getStatus, data: getData } = await apiCall('GET', `/positions/${positionId}`, undefined, adminToken);
    const pos = getData.position || getData.data?.position;
    if (getStatus === 200 && pos) {
      logResult('Position', 'READ', 'PASS', `Position retrieved: ${pos.title}`);
    } else {
      logResult('Position', 'READ', 'FAIL', `Status: ${getStatus}`);
    }
  }

  // UPDATE
  if (positionId) {
    const updateData = {
      title: `Updated Position ${Date.now()}`,
      description: 'Updated position description',
    };
    const { status: updateStatus } = await apiCall('PUT', `/positions/${positionId}`, updateData, adminToken);
    if (updateStatus === 200) {
      logResult('Position', 'UPDATE', 'PASS', 'Position updated successfully');
    } else {
      logResult('Position', 'UPDATE', 'FAIL', `Status: ${updateStatus}`);
    }
  }
}

async function testEmployeeCRUD() {
  console.log('\n👤 Testing Employee CRUD Operations...\n');

  if (!adminToken) {
    logResult('Employee', 'All operations', 'SKIP', 'No admin token available');
    return;
  }

  // CREATE
  const createData = {
    organizationId: organizationId,
    firstName: 'Test',
    lastName: `Employee${Date.now()}`,
    email: `employee${Date.now()}@test.com`,
    phone: '+911234567890',
    dateOfBirth: '1990-01-01',
    gender: 'MALE',
    departmentId: departmentId || null,
    positionId: positionId || null,
    dateOfJoining: new Date().toISOString().split('T')[0],
    employeeStatus: 'ACTIVE',
  };

  const { status: createStatus, data: createDataResponse } = await apiCall('POST', '/employees', createData, adminToken);
  if (createStatus === 201 || createStatus === 200) {
    employeeId = createDataResponse.employee?.id || createDataResponse.data?.employee?.id || '';
    logResult('Employee', 'CREATE', 'PASS', `Employee created: ${createData.firstName} ${createData.lastName}`);
  } else {
    logResult('Employee', 'CREATE', 'FAIL', `Status: ${createStatus} - ${createDataResponse.message || JSON.stringify(createDataResponse)}`);
    return;
  }

  // READ (Get by ID)
  if (employeeId) {
    const { status: getStatus, data: getData } = await apiCall('GET', `/employees/${employeeId}`, undefined, adminToken);
    const emp = getData.employee || getData.data?.employee;
    if (getStatus === 200 && emp) {
      logResult('Employee', 'READ', 'PASS', `Employee retrieved: ${emp.firstName} ${emp.lastName}`);
    } else {
      logResult('Employee', 'READ', 'FAIL', `Status: ${getStatus}`);
    }
  }

  // UPDATE
  if (employeeId) {
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
    };
    const { status: updateStatus } = await apiCall('PUT', `/employees/${employeeId}`, updateData, adminToken);
    if (updateStatus === 200) {
      logResult('Employee', 'UPDATE', 'PASS', 'Employee updated successfully');
    } else {
      logResult('Employee', 'UPDATE', 'FAIL', `Status: ${updateStatus}`);
    }
  }
}

async function runTests() {
  console.log('🚀 Starting CRUD Operations Test');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Base: ${API_BASE}`);
  console.log('='.repeat(60));

  try {
    // Create admin user and login
    await createAdminUser();

    if (!adminToken) {
      console.log('\n❌ Failed to create admin user. Cannot proceed with CRUD tests.');
      process.exit(1);
    }

    // Test CRUD operations
    await testDepartmentCRUD();
    await testPositionCRUD();
    await testEmployeeCRUD();

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
        console.log(`   - [${r.module}] ${r.operation}: ${r.message}`);
      });
    }

    console.log('\n' + '='.repeat(60));

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  }
}

runTests();
