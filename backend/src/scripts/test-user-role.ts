import axios, { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api/v1';
const prisma = new PrismaClient();

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function logResult(test: string, status: 'PASS' | 'FAIL', details: string = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${test}: ${details}`);
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

async function testUserRole() {
  console.log('\n🧪 TESTING USER ROLE AND PERMISSIONS MODULE ACCESS');
  console.log('='.repeat(70));
  console.log('Email: ayyanar@gmail.com');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Check user in database
    console.log('📋 Step 1: Checking user in database...\n');
    const user = await prisma.user.findUnique({
      where: { email: 'ayyanar@gmail.com' },
      include: {
        employee: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      logResult('User Exists in Database', 'FAIL', 'User not found in database');
      console.log('\n⚠️  User does not exist. Please create the user first.');
      return;
    }

    logResult('User Exists in Database', 'PASS', `Found user: ${user.email}`);
    logResult('User Role', 'PASS', `Role: ${user.role}`);
    logResult('User Organization', user.employee?.organization ? 'PASS' : 'FAIL', 
      user.employee?.organization?.name || 'No organization assigned');

    // 2. Test login
    console.log('\n🔐 Step 2: Testing login...\n');
    const { status, data } = await apiCall('POST', '/auth/login', {
      email: 'ayyanar@gmail.com',
      password: 'Admin@123',
    });

    if (status !== 200) {
      logResult('Login', 'FAIL', `Status: ${status} - ${data.message || JSON.stringify(data)}`);
      return;
    }

    const tokens = data.tokens || data.data?.tokens || data;
    const token = tokens.accessToken;

    if (!token) {
      logResult('Login', 'FAIL', 'No access token received');
      return;
    }

    logResult('Login', 'PASS', 'Successfully logged in');

    // 3. Get current user info
    console.log('\n👤 Step 3: Getting current user info...\n');
    const { status: userStatus, data: userData } = await apiCall('GET', '/auth/me', undefined, token);

    if (userStatus !== 200) {
      logResult('Get Current User', 'FAIL', `Status: ${userStatus}`);
      return;
    }

    const currentUser = userData.data?.user || userData.user || userData;
    logResult('Get Current User', 'PASS', `Retrieved user data`);
    logResult('Current User Role', 'PASS', `Role: ${currentUser.role}`);
    logResult('Has Employee Record', currentUser.employee ? 'PASS' : 'FAIL', 
      currentUser.employee ? 'Employee record exists' : 'No employee record');

    // 4. Check if role should have Permissions access
    console.log('\n🔐 Step 4: Checking Permissions module access...\n');
    const role = currentUser.role?.toUpperCase();
    const canManagePermissions = role === 'ORG_ADMIN' || role === 'HR_MANAGER';
    
    logResult('Role Check (Case-Insensitive)', 'PASS', `Role: ${role}`);
    logResult('Can Manage Permissions', canManagePermissions ? 'PASS' : 'FAIL', 
      canManagePermissions ? 'YES - Should see Permissions module' : 'NO - Should NOT see Permissions module');

    // 5. Test Permissions API access
    console.log('\n🔐 Step 5: Testing Permissions API access...\n');
    const { status: permStatus } = await apiCall('GET', '/permissions', undefined, token);

    if (permStatus === 200) {
      logResult('Permissions API Access', 'PASS', 'Can access permissions endpoint');
    } else if (permStatus === 403 || permStatus === 401) {
      logResult('Permissions API Access', 'FAIL', `Access denied: ${permStatus}`);
    } else {
      logResult('Permissions API Access', 'FAIL', `Status: ${permStatus}`);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Total: ${results.length}`);

    console.log('\n' + '='.repeat(70));
    console.log('💡 DASHBOARD PERMISSIONS MODULE EXPECTATION:');
    console.log('='.repeat(70));
    
    if (canManagePermissions) {
      console.log('✅ User SHOULD see Permissions module on dashboard');
      console.log('   - Module should be clickable');
      console.log('   - Should be able to access /permissions route');
    } else {
      console.log('❌ User should NOT see Permissions module (or see it as disabled)');
      console.log(`   - Current role: ${role}`);
      console.log('   - Only ORG_ADMIN and HR_MANAGER can manage permissions');
    }
    
    console.log('='.repeat(70) + '\n');

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - ${r.test}: ${r.details}`);
      });
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testUserRole();
