import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to test and verify organizationId is stored correctly in User, Employee, Department, and Position tables
 * Usage: npm run ts-node backend/src/scripts/test-organization-id-storage.ts
 */
async function testOrganizationIdStorage() {
  try {
    console.log('\n🔍 Testing Organization ID Storage...\n');

    // Get all organizations
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    if (organizations.length === 0) {
      console.log('❌ No organizations found. Please create an organization first.');
      process.exit(1);
    }

    console.log(`📊 Found ${organizations.length} organization(s):\n`);
    organizations.forEach((org) => {
      console.log(`   - ${org.name} (${org.id})`);
    });

    let allCorrect = true;

    // Test Users
    console.log('\n👤 Testing Users:');
    const users = await prisma.user.findMany({
      include: {
        employee: {
          select: { organizationId: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    let userIssues = 0;
    for (const user of users) {
      const expectedOrgId = user.employee?.organizationId || null;
      const actualOrgId = user.organizationId;

      if (expectedOrgId && actualOrgId !== expectedOrgId) {
        console.log(`   ❌ ${user.email}: Expected ${expectedOrgId}, Got ${actualOrgId || 'NULL'}`);
        userIssues++;
        allCorrect = false;
      } else if (!expectedOrgId && actualOrgId) {
        console.log(`   ⚠️  ${user.email}: Has organizationId (${actualOrgId}) but no employee record`);
      } else if (expectedOrgId && actualOrgId === expectedOrgId) {
        console.log(`   ✅ ${user.email}: Correct (${actualOrgId})`);
      } else {
        console.log(`   ⚠️  ${user.email}: No organizationId (might be SUPER_ADMIN)`);
      }
    }

    if (userIssues === 0) {
      console.log(`   ✅ All ${users.length} users have correct organizationId`);
    } else {
      console.log(`   ❌ Found ${userIssues} user(s) with incorrect organizationId`);
    }

    // Test Employees
    console.log('\n👥 Testing Employees:');
    const employees = await prisma.employee.findMany({
      include: {
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { organizationId: true },
        },
      },
    });

    let employeeIssues = 0;
    for (const employee of employees) {
      const orgId = employee.organizationId;
      const userOrgId = employee.user?.organizationId;

      if (!orgId) {
        console.log(`   ❌ ${employee.email}: Missing organizationId`);
        employeeIssues++;
        allCorrect = false;
      } else if (userOrgId && userOrgId !== orgId) {
        console.log(`   ❌ ${employee.email}: Employee orgId (${orgId}) != User orgId (${userOrgId})`);
        employeeIssues++;
        allCorrect = false;
      } else if (!employee.organization) {
        console.log(`   ❌ ${employee.email}: organizationId (${orgId}) references non-existent organization`);
        employeeIssues++;
        allCorrect = false;
      } else {
        console.log(`   ✅ ${employee.email}: Correct (${orgId} - ${employee.organization.name})`);
      }
    }

    if (employeeIssues === 0) {
      console.log(`   ✅ All ${employees.length} employees have correct organizationId`);
    } else {
      console.log(`   ❌ Found ${employeeIssues} employee(s) with incorrect organizationId`);
    }

    // Test Departments
    console.log('\n🏢 Testing Departments:');
    const departments = await prisma.department.findMany({
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    let departmentIssues = 0;
    for (const dept of departments) {
      const orgId = dept.organizationId;

      if (!orgId) {
        console.log(`   ❌ ${dept.name}: Missing organizationId`);
        departmentIssues++;
        allCorrect = false;
      } else if (!dept.organization) {
        console.log(`   ❌ ${dept.name}: organizationId (${orgId}) references non-existent organization`);
        departmentIssues++;
        allCorrect = false;
      } else {
        console.log(`   ✅ ${dept.name}: Correct (${orgId} - ${dept.organization.name})`);
      }
    }

    if (departmentIssues === 0) {
      console.log(`   ✅ All ${departments.length} departments have correct organizationId`);
    } else {
      console.log(`   ❌ Found ${departmentIssues} department(s) with incorrect organizationId`);
    }

    // Test Job Positions
    console.log('\n💼 Testing Job Positions:');
    const positions = await prisma.jobPosition.findMany({
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    let positionIssues = 0;
    for (const position of positions) {
      const orgId = position.organizationId;

      if (!orgId) {
        console.log(`   ❌ ${position.title}: Missing organizationId`);
        positionIssues++;
        allCorrect = false;
      } else if (!position.organization) {
        console.log(`   ❌ ${position.title}: organizationId (${orgId}) references non-existent organization`);
        positionIssues++;
        allCorrect = false;
      } else {
        console.log(`   ✅ ${position.title}: Correct (${orgId} - ${position.organization.name})`);
      }
    }

    if (positionIssues === 0) {
      console.log(`   ✅ All ${positions.length} positions have correct organizationId`);
    } else {
      console.log(`   ❌ Found ${positionIssues} position(s) with incorrect organizationId`);
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Users: ${users.length} total, ${userIssues} issues`);
    console.log(`   Employees: ${employees.length} total, ${employeeIssues} issues`);
    console.log(`   Departments: ${departments.length} total, ${departmentIssues} issues`);
    console.log(`   Positions: ${positions.length} total, ${positionIssues} issues`);

    if (allCorrect) {
      console.log('\n✅ All organizationId values are stored correctly!');
    } else {
      console.log('\n❌ Some organizationId values are incorrect. Please review the issues above.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error testing organizationId storage:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testOrganizationIdStorage();
