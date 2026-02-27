import axios, { AxiosError } from 'axios';
import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api/v1';

interface TestUser {
  email: string;
  password: string;
  role: UserRole;
  token?: string;
  userId?: string;
}

const testUsers: TestUser[] = [
  { email: `superadmin-${Date.now()}@test.com`, password: 'SuperAdmin@123', role: 'SUPER_ADMIN' },
  { email: `orgadmin-${Date.now()}@test.com`, password: 'OrgAdmin@123', role: 'ORG_ADMIN' },
  { email: `hrmanager-${Date.now()}@test.com`, password: 'HRManager@123', role: 'HR_MANAGER' },
  { email: `manager-${Date.now()}@test.com`, password: 'Manager@123', role: 'MANAGER' },
  { email: `employee-${Date.now()}@test.com`, password: 'Employee@123', role: 'EMPLOYEE' },
];

let testData = {
  organizationId: '',
  departmentId: '',
  positionId: '',
  employeeId: '',
};

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

// Helper function to log test results
function logResult(category: string, test: string, result: 'PASS' | 'FAIL' | 'SKIP', details?: string) {
  const icon = result === 'PASS' ? '✅' : result === 'FAIL' ? '❌' : '⏭️';
  const detailsStr = details ? ` - ${details}` : '';
  console.log(`${icon} [${category}] ${test}: ${result}${detailsStr}`);
}

// Create test users in database
async function createTestUsers() {
  console.log('\n👥 Creating test users with different roles...\n');

  // Get or create default organization
  let org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Test Organization',
        legalName: 'Test Organization Ltd',
        industry: 'Information Technology',
        sizeRange: '51-200',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        fiscalYearStart: new Date('2026-04-01'),
        address: {},
        settings: {},
      },
    });
  }
  testData.organizationId = org.id;

  for (const user of testUsers) {
    try {
      const passwordHash = await hashPassword(user.password);
      
      // Create user
      const dbUser = await prisma.user.create({
        data: {
          email: user.email,
          passwordHash,
          role: user.role,
          organizationId: org.id,
          isEmailVerified: true,
          isActive: true,
        },
      });

      // Create employee record
      const employeeCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await prisma.employee.create({
        data: {
          organizationId: org.id,
          employeeCode,
          userId: dbUser.id,
          firstName: user.role.split('_')[0],
          lastName: 'Test',
          email: user.email,
          employeeStatus: 'ACTIVE',
          dateOfJoining: new Date(),
        },
      });

      user.userId = dbUser.id;
      console.log(`✅ Created ${user.role}: ${user.email}`);
    } catch (error: any) {
      console.error(`❌ Failed to create ${user.role}: ${error.message}`);
    }
  }

  // Login all users to get tokens
  console.log('\n🔐 Logging in test users...\n');
  for (const user of testUsers) {
    try {
      const { status, data } = await apiCall('POST', '/auth/login', {
        email: user.email,
        password: user.password,
      });

      if (status === 200) {
        const tokens = data.tokens || data.data?.tokens || data;
        user.token = tokens.accessToken;
        console.log(`✅ Logged in ${user.role}: ${user.email}`);
      } else {
        console.error(`❌ Failed to login ${user.role}: ${data.message || JSON.stringify(data)}`);
      }
    } catch (error: any) {
      console.error(`❌ Error logging in ${user.role}: ${error.message}`);
    }
  }
}

// Create test data (department, position, employee)
async function createTestData() {
  console.log('\n📦 Creating test data (department, position, employee)...\n');

  const superAdmin = testUsers.find(u => u.role === 'SUPER_ADMIN');
  if (!superAdmin?.token) {
    console.error('❌ SUPER_ADMIN token not available');
    return;
  }

  // Create department
  const { status: deptStatus, data: deptData } = await apiCall(
    'POST',
    '/departments',
    {
      name: 'Test Department',
      code: 'TEST',
      organizationId: testData.organizationId,
      description: 'Test department for RBAC testing',
    },
    superAdmin.token
  );

  if (deptStatus === 201 || deptStatus === 200) {
    testData.departmentId = deptData.data?.department?.id || deptData.department?.id || deptData.id;
    logResult('Setup', 'Create Department', 'PASS', `ID: ${testData.departmentId}`);
  } else {
    logResult('Setup', 'Create Department', 'FAIL', deptData.message || JSON.stringify(deptData));
  }

  // Create position
  const { status: posStatus, data: posData } = await apiCall(
    'POST',
    '/positions',
    {
      title: 'Test Position',
      code: 'TEST-POS',
      departmentId: testData.departmentId,
      organizationId: testData.organizationId,
      description: 'Test position for RBAC testing',
    },
    superAdmin.token
  );

  if (posStatus === 201 || posStatus === 200) {
    testData.positionId = posData.data?.position?.id || posData.position?.id || posData.id;
    logResult('Setup', 'Create Position', 'PASS', `ID: ${testData.positionId}`);
  } else {
    logResult('Setup', 'Create Position', 'FAIL', posData.message || JSON.stringify(posData));
  }

  // Create employee
  const { status: empStatus, data: empData } = await apiCall(
    'POST',
    '/employees',
    {
      firstName: 'Test',
      lastName: 'Employee',
      email: `testemp-${Date.now()}@test.com`,
      phone: '+1234567890',
      dateOfBirth: '1990-01-01',
      gender: 'MALE',
      organizationId: testData.organizationId,
      departmentId: testData.departmentId,
      positionId: testData.positionId,
      dateOfJoining: new Date().toISOString().split('T')[0],
      employeeStatus: 'ACTIVE',
    },
    superAdmin.token
  );

  if (empStatus === 201 || empStatus === 200) {
    testData.employeeId = empData.data?.employee?.id || empData.employee?.id || empData.id;
    logResult('Setup', 'Create Employee', 'PASS', `ID: ${testData.employeeId}`);
  } else {
    logResult('Setup', 'Create Employee', 'FAIL', empData.message || JSON.stringify(empData));
  }
}

// Test endpoint access for a specific role
async function testEndpointAccess(
  role: UserRole,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  expectedStatus: number | number[],
  data?: any
) {
  const user = testUsers.find(u => u.role === role);
  if (!user?.token) {
    return { passed: false, reason: 'Token not available' };
  }

  const { status, data: responseData } = await apiCall(method, endpoint, data, user.token);
  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const passed = expectedStatuses.includes(status);

  return {
    passed,
    status,
    expectedStatus,
    message: responseData.message || responseData.error?.message || '',
  };
}

// Test RBAC for all endpoints
async function testRBAC() {
  console.log('\n🔒 Testing Role-Based Access Control (RBAC)...\n');

  const tests = [
    // Organizations
    {
      name: 'GET /organizations/:id',
      endpoint: `/organizations/${testData.organizationId}`,
      method: 'GET' as const,
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 200,
        MANAGER: 200,
        EMPLOYEE: 200,
      },
    },
    {
      name: 'PUT /organizations/:id',
      endpoint: `/organizations/${testData.organizationId}`,
      method: 'PUT' as const,
      data: { name: 'Updated Org' },
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 403,
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },
    {
      name: 'GET /organizations/:id/statistics',
      endpoint: `/organizations/${testData.organizationId}/statistics`,
      method: 'GET' as const,
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 200,
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },

    // Departments
    {
      name: 'GET /departments',
      endpoint: '/departments',
      method: 'GET' as const,
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 200,
        MANAGER: 200,
        EMPLOYEE: 200,
      },
    },
    {
      name: 'POST /departments',
      endpoint: '/departments',
      method: 'POST' as const,
      data: {
        name: 'New Department',
        code: 'NEW',
        organizationId: testData.organizationId,
      },
      roles: {
        SUPER_ADMIN: [200, 201],
        ORG_ADMIN: [200, 201],
        HR_MANAGER: [200, 201],
        MANAGER: [200, 201],
        EMPLOYEE: 403,
      },
    },
    {
      name: 'PUT /departments/:id',
      endpoint: `/departments/${testData.departmentId}`,
      method: 'PUT' as const,
      data: { name: 'Updated Department' },
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 200,
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },
    {
      name: 'DELETE /departments/:id',
      endpoint: `/departments/${testData.departmentId}`,
      method: 'DELETE' as const,
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 403,
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },

    // Positions
    {
      name: 'GET /positions',
      endpoint: '/positions',
      method: 'GET' as const,
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 200,
        MANAGER: 200,
        EMPLOYEE: 200,
      },
    },
    {
      name: 'POST /positions',
      endpoint: '/positions',
      method: 'POST' as const,
      data: {
        title: 'New Position',
        code: 'NEW-POS',
        departmentId: testData.departmentId,
        organizationId: testData.organizationId,
      },
      roles: {
        SUPER_ADMIN: [200, 201],
        ORG_ADMIN: [200, 201],
        HR_MANAGER: [200, 201],
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },
    {
      name: 'PUT /positions/:id',
      endpoint: `/positions/${testData.positionId}`,
      method: 'PUT' as const,
      data: { title: 'Updated Position' },
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 200,
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },
    {
      name: 'DELETE /positions/:id',
      endpoint: `/positions/${testData.positionId}`,
      method: 'DELETE' as const,
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 403,
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },

    // Employees
    {
      name: 'GET /employees',
      endpoint: '/employees',
      method: 'GET' as const,
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 200,
        MANAGER: 200,
        EMPLOYEE: 200,
      },
    },
    {
      name: 'POST /employees',
      endpoint: '/employees',
      method: 'POST' as const,
      data: {
        firstName: 'New',
        lastName: 'Employee',
        email: `newemp-${Date.now()}@test.com`,
        phone: '+1234567890',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        organizationId: testData.organizationId,
        dateOfJoining: new Date().toISOString().split('T')[0],
      },
      roles: {
        SUPER_ADMIN: [200, 201],
        ORG_ADMIN: [200, 201],
        HR_MANAGER: [200, 201],
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },
    {
      name: 'PUT /employees/:id',
      endpoint: `/employees/${testData.employeeId}`,
      method: 'PUT' as const,
      data: { firstName: 'Updated' },
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 200,
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },
    {
      name: 'DELETE /employees/:id',
      endpoint: `/employees/${testData.employeeId}`,
      method: 'DELETE' as const,
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 403,
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },
    {
      name: 'GET /employees/statistics/:orgId',
      endpoint: `/employees/statistics/${testData.organizationId}`,
      method: 'GET' as const,
      roles: {
        SUPER_ADMIN: 200,
        ORG_ADMIN: 200,
        HR_MANAGER: 200,
        MANAGER: 403,
        EMPLOYEE: 403,
      },
    },
  ];

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log('─'.repeat(60));

    for (const [role, expectedStatus] of Object.entries(test.roles)) {
      totalTests++;
      const result = await testEndpointAccess(
        role as UserRole,
        test.method,
        test.endpoint,
        expectedStatus,
        test.data
      );

      if (result.passed) {
        passedTests++;
        logResult(role, test.name, 'PASS', `Status: ${result.status}`);
      } else {
        failedTests++;
        logResult(
          role,
          test.name,
          'FAIL',
          `Expected: ${result.expectedStatus}, Got: ${result.status} - ${result.message}`
        );
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RBAC TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
  console.log('='.repeat(60));

  // SUPER_ADMIN specific summary
  const superAdminTests = tests.filter(t => {
    const result = Object.entries(t.roles).find(([role]) => role === 'SUPER_ADMIN');
    return result && result[1] !== 403;
  });
  console.log(`\n🔑 SUPER_ADMIN Access Tests: ${superAdminTests.length} endpoints`);
  console.log(`   SUPER_ADMIN should have access to all endpoints (except 404s)`);
}

// Cleanup test data
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...\n');

  try {
    // Delete test users and employees
    for (const user of testUsers) {
      if (user.userId) {
        await prisma.employee.deleteMany({
          where: { userId: user.userId },
        });
        await prisma.user.delete({
          where: { id: user.userId },
        });
      }
    }

    // Note: We don't delete the test department, position, and employee
    // as they might be useful for manual testing
    console.log('✅ Cleanup completed');
  } catch (error: any) {
    console.error(`❌ Cleanup error: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting RBAC Test Suite');
    console.log('='.repeat(60));

    await createTestUsers();
    await createTestData();
    await testRBAC();

    console.log('\n✅ RBAC testing completed!');
    console.log('\n💡 Note: Test data (department, position, employee) was not deleted.');
    console.log('   You can manually clean them up if needed.\n');
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
  } finally {
    await cleanup();
  }
}

// Run the tests
main();
