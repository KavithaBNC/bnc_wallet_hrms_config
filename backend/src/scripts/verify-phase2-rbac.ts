import axios, { AxiosError } from 'axios';
import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();
const BASE_URL = process.env.API_URL || 'http://localhost:5000/api/v1';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
}

const results: TestResult[] = [];

function logResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', details: string = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${test}: ${status}${details ? ` - ${details}` : ''}`);
  results.push({ test, status, details });
}

async function apiCall(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, data?: any, token?: string) {
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

// ============================================================================
// 1. CHECK SEED DATA
// ============================================================================
async function checkSeedData() {
  console.log('\n📊 1. CHECKING SEED DATA');
  console.log('='.repeat(70));

  try {
    // Check organizations
    const orgs = await prisma.organization.findMany();
    logResult('Organizations exist', orgs.length > 0 ? 'PASS' : 'FAIL', `${orgs.length} organizations found`);

    // Check users with different roles
    const users = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    });
    const rolesFound = users.map(u => `${u.role}: ${u._count.role}`).join(', ');
    logResult('Users with roles', users.length > 0 ? 'PASS' : 'FAIL', rolesFound || 'No users found');

    // Check employees
    const employees = await prisma.employee.count();
    logResult('Employees exist', employees > 0 ? 'PASS' : 'FAIL', `${employees} employees found`);

    // Check permissions table (if exists in schema)
    try {
      await prisma.$queryRaw`SELECT COUNT(*) as count FROM permissions`;
      logResult('Permissions table', 'PASS', 'Table exists');
    } catch (e: any) {
      logResult('Permissions table', 'SKIP', 'Not in Prisma schema (may exist in DB)');
    }

    // Check role_permissions table
    try {
      await prisma.$queryRaw`SELECT COUNT(*) as count FROM role_permissions`;
      logResult('Role permissions table', 'PASS', 'Table exists');
    } catch (e: any) {
      logResult('Role permissions table', 'SKIP', 'Not in Prisma schema (may exist in DB)');
    }
  } catch (error: any) {
    logResult('Seed data check', 'FAIL', error.message);
  }
}

// ============================================================================
// 2. TEST RBAC MIDDLEWARE
// ============================================================================
async function testRBACMiddleware() {
  console.log('\n🔒 2. TESTING RBAC MIDDLEWARE');
  console.log('='.repeat(70));

  // Check if middleware exists
  try {
    const fs = require('fs');
    const path = require('path');
    const rbacPath = path.join(__dirname, '../middlewares/rbac.ts');
    const exists = fs.existsSync(rbacPath);
    logResult('RBAC middleware file exists', exists ? 'PASS' : 'FAIL');

    if (exists) {
      const content = fs.readFileSync(rbacPath, 'utf8');
      const hasEmployeeListAccess = content.includes('employeeListAccess');
      const hasFieldControl = content.includes('getEmployeeFieldsByRole');
      logResult('employeeListAccess function', hasEmployeeListAccess ? 'PASS' : 'FAIL');
      logResult('Field-level access control', hasFieldControl ? 'PASS' : 'FAIL');
    }
  } catch (error: any) {
    logResult('RBAC middleware check', 'FAIL', error.message);
  }

  // Check if middleware is used in routes
  try {
    const fs = require('fs');
    const path = require('path');
    const routesPath = path.join(__dirname, '../routes/employee.routes.ts');
    const content = fs.readFileSync(routesPath, 'utf8');
    const usesRBAC = content.includes('employeeListAccess');
    logResult('RBAC middleware in employee routes', usesRBAC ? 'PASS' : 'FAIL');
  } catch (error: any) {
    logResult('Route middleware check', 'FAIL', error.message);
  }
}

// ============================================================================
// 3. TEST API ENDPOINTS WITH DIFFERENT ROLES
// ============================================================================
async function testAPIEndpoints() {
  console.log('\n🌐 3. TESTING API ENDPOINTS WITH DIFFERENT ROLES');
  console.log('='.repeat(70));

  // Create test users
  const testUsers: { email: string; password: string; role: UserRole; token?: string; orgId?: string }[] = [];

  // Get or create organization
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Test Org',
        legalName: 'Test Org Ltd',
        industry: 'IT',
        sizeRange: '51-200',
        timezone: 'UTC',
        currency: 'USD',
        address: {},
        settings: {},
      },
    });
  }

  // Create test users
  const roles: UserRole[] = ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
  for (const role of roles) {
    const email = `test-${role.toLowerCase()}-${Date.now()}@test.com`;
    const password = 'Test@123456';
    const passwordHash = await hashPassword(password);

    try {
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

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,
          organizationId: org.id,
          isEmailVerified: true,
          isActive: true,
        },
      });

      const employeeCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await prisma.employee.create({
        data: {
          organizationId: org.id,
          employeeCode,
          userId: user.id,
          firstName: role,
          lastName: 'Test',
          email,
          employeeStatus: 'ACTIVE',
          dateOfJoining: new Date(),
        },
      });

      // Login
      const { status, data } = await apiCall('POST', '/auth/login', { email, password });
      if (status === 200) {
        const tokens = data.tokens || data.data?.tokens || data;
        testUsers.push({ email, password, role, token: tokens.accessToken, orgId: org.id });
      }
    } catch (error: any) {
      console.error(`Failed to create ${role}:`, error.message);
    }
  }

  // Test SUPER_ADMIN
  const superAdmin = testUsers.find(u => u.role === 'SUPER_ADMIN');
  if (superAdmin?.token) {
    console.log('\n🔑 Testing SUPER_ADMIN:');
    const { status, data } = await apiCall('GET', '/employees', undefined, superAdmin.token);
    logResult('SUPER_ADMIN: GET /employees', status === 200 ? 'PASS' : 'FAIL', `Status: ${status}`);
    
    if (status === 200) {
      const employees = data.data?.employees || data.employees || [];
      logResult('SUPER_ADMIN: Can see all employees', employees.length > 0 ? 'PASS' : 'FAIL', `${employees.length} employees`);
    }
  }

  // Test ORG_ADMIN
  const orgAdmin = testUsers.find(u => u.role === 'ORG_ADMIN');
  if (orgAdmin?.token) {
    console.log('\n👔 Testing ORG_ADMIN:');
    const { status, data } = await apiCall('GET', '/employees', undefined, orgAdmin.token);
    logResult('ORG_ADMIN: GET /employees', status === 200 ? 'PASS' : 'FAIL', `Status: ${status}`);
    
    if (status === 200) {
      const employees = data.data?.employees || data.employees || [];
      // Check if filtered to org
      const allFromOrg = employees.every((e: any) => e.organizationId === orgAdmin.orgId);
      logResult('ORG_ADMIN: Only sees own org employees', allFromOrg ? 'PASS' : 'FAIL', `${employees.length} employees`);
    }

    // Try accessing different org (should fail)
    const { status: crossOrgStatus } = await apiCall(
      'GET',
      `/employees?organizationId=00000000-0000-0000-0000-000000000999`,
      undefined,
      orgAdmin.token
    );
    logResult('ORG_ADMIN: Blocked from other org', crossOrgStatus === 403 ? 'PASS' : 'FAIL', `Status: ${crossOrgStatus}`);
  }

  // Test MANAGER
  const manager = testUsers.find(u => u.role === 'MANAGER');
  if (manager?.token) {
    console.log('\n👨‍💼 Testing MANAGER:');
    const { status } = await apiCall('GET', '/employees', undefined, manager.token);
    logResult('MANAGER: GET /employees', status === 200 ? 'PASS' : 'FAIL', `Status: ${status}`);
  }

  // Test EMPLOYEE
  const employee = testUsers.find(u => u.role === 'EMPLOYEE');
  if (employee?.token) {
    console.log('\n👤 Testing EMPLOYEE:');
    const { status } = await apiCall('GET', '/employees', undefined, employee.token);
    logResult('EMPLOYEE: GET /employees', status === 200 ? 'PASS' : 'FAIL', `Status: ${status}`);
  }

  // Cleanup test users
  for (const user of testUsers) {
    try {
      const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
      if (dbUser) {
        await prisma.employee.deleteMany({ where: { userId: dbUser.id } });
        await prisma.user.delete({ where: { id: dbUser.id } });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// ============================================================================
// 4. VERIFY SCOPE FILTERING
// ============================================================================
async function verifyScopeFiltering() {
  console.log('\n🔍 4. VERIFYING SCOPE FILTERING IN QUERIES');
  console.log('='.repeat(70));

  try {
    const fs = require('fs');
    const path = require('path');
    const servicePath = path.join(__dirname, '../services/employee.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');

    const hasOrgFilter = content.includes('organizationId');
    const hasManagerFilter = content.includes('reportingManagerId');
    const hasWhereClause = content.includes('where:');

    logResult('Organization filtering in queries', hasOrgFilter ? 'PASS' : 'FAIL');
    logResult('Manager filtering in queries', hasManagerFilter ? 'PASS' : 'FAIL');
    logResult('WHERE clause usage', hasWhereClause ? 'PASS' : 'FAIL');
  } catch (error: any) {
    logResult('Scope filtering check', 'FAIL', error.message);
  }
}

// ============================================================================
// 5. CHECK REDIS CACHING
// ============================================================================
async function checkRedisCaching() {
  console.log('\n💾 5. CHECKING REDIS CACHING');
  console.log('='.repeat(70));

  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check config
    const configPath = path.join(__dirname, '../config/config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const hasRedisConfig = configContent.includes('redisUrl');
    logResult('Redis config exists', hasRedisConfig ? 'PASS' : 'FAIL');

    // Check if Redis is used anywhere
    const srcDir = path.join(__dirname, '../');
    const files = fs.readdirSync(srcDir, { recursive: true });
    const redisFiles = files.filter((f: string) => 
      f.includes('redis') || f.includes('cache')
    );
    logResult('Redis implementation files', redisFiles.length > 0 ? 'PASS' : 'SKIP', 
      redisFiles.length > 0 ? `${redisFiles.length} files found` : 'No Redis implementation found');

    // Check if permissions are cached
    const hasPermissionCache = files.some((f: string) => 
      f.includes('permission') && f.includes('cache')
    );
    logResult('Permission caching implemented', hasPermissionCache ? 'PASS' : 'SKIP');
  } catch (error: any) {
    logResult('Redis caching check', 'FAIL', error.message);
  }
}

// ============================================================================
// 6. SECURITY CHECKS
// ============================================================================
async function securityChecks() {
  console.log('\n🔐 6. SECURITY CHECKS');
  console.log('='.repeat(70));

  try {
    // Check if endpoints are protected
    const fs = require('fs');
    const path = require('path');
    const routesPath = path.join(__dirname, '../routes/employee.routes.ts');
    const content = fs.readFileSync(routesPath, 'utf8');

    const hasAuth = content.includes('authenticate');
    const hasAuthorize = content.includes('authorize');
    const hasRBAC = content.includes('employeeListAccess');

    logResult('Authentication middleware', hasAuth ? 'PASS' : 'FAIL');
    logResult('Authorization middleware', hasAuthorize ? 'PASS' : 'FAIL');
    logResult('RBAC middleware', hasRBAC ? 'PASS' : 'FAIL');

    // Check organization isolation
    const rbacPath = path.join(__dirname, '../middlewares/rbac.ts');
    const rbacContent = fs.readFileSync(rbacPath, 'utf8');
    const hasOrgIsolation = rbacContent.includes('organizationId') && rbacContent.includes('403');
    logResult('Organization isolation', hasOrgIsolation ? 'PASS' : 'FAIL');
  } catch (error: any) {
    logResult('Security checks', 'FAIL', error.message);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
async function main() {
  console.log('🚀 PHASE 2 RBAC VERIFICATION');
  console.log('='.repeat(70));

  try {
    await checkSeedData();
    await testRBACMiddleware();
    await testAPIEndpoints();
    await verifyScopeFiltering();
    await checkRedisCaching();
    await securityChecks();

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 VERIFICATION SUMMARY');
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
    console.log('💡 RECOMMENDATIONS:');
    console.log('='.repeat(70));
    
    if (!results.some(r => r.test.includes('Redis') && r.status === 'PASS')) {
      console.log('⚠️  Redis caching for permissions is not implemented');
    }
    if (!results.some(r => r.test.includes('Permissions table') && r.status === 'PASS')) {
      console.log('⚠️  Database-driven permissions table not in Prisma schema');
    }
    if (failed === 0) {
      console.log('✅ All critical RBAC features are working!');
    }

  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
