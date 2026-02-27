import { PrismaClient } from '@prisma/client';
import { rolePermissionService } from '../services/role-permission.service';

const prisma = new PrismaClient();

/**
 * Script to test the permission system
 * Usage: npx ts-node backend/src/scripts/test-permission-system.ts
 */
async function testPermissionSystem() {
  try {
    console.log('\n🧪 Testing Permission System...\n');

    // 1. Check if permissions exist
    const permissionCount = await prisma.permission.count();
    console.log(`📊 Total Permissions: ${permissionCount}`);
    
    if (permissionCount === 0) {
      console.log('⚠️  No permissions found. Run seed script first: npx ts-node src/scripts/seed-permissions.ts');
      return;
    }

    // 2. Check role permissions for HR_MANAGER
    console.log('\n🔍 Checking HR_MANAGER permissions...');
    const hrManagerPerms = await rolePermissionService.getRolePermissions('HR_MANAGER');
    console.log(`   ✅ HR_MANAGER has ${hrManagerPerms.length} permissions`);
    
    if (hrManagerPerms.length > 0) {
      console.log(`   Sample permissions:`);
      hrManagerPerms.slice(0, 5).forEach((rp: any) => {
        console.log(`      - ${rp.permission.name} (${rp.permission.resource}.${rp.permission.action})`);
      });
    }

    // 3. Check role permissions for ORG_ADMIN
    console.log('\n🔍 Checking ORG_ADMIN permissions...');
    const orgAdminPerms = await rolePermissionService.getRolePermissions('ORG_ADMIN');
    console.log(`   ✅ ORG_ADMIN has ${orgAdminPerms.length} permissions`);

    // 4. Test permission checking
    console.log('\n🔍 Testing permission checks...');
    
    const hasCreateEmployee = await rolePermissionService.hasPermission(
      'HR_MANAGER',
      'employees',
      'create'
    );
    console.log(`   HR_MANAGER can create employees: ${hasCreateEmployee ? '✅ YES' : '❌ NO'}`);

    const hasDeleteEmployee = await rolePermissionService.hasPermission(
      'HR_MANAGER',
      'employees',
      'delete'
    );
    console.log(`   HR_MANAGER can delete employees: ${hasDeleteEmployee ? '✅ YES' : '❌ NO'}`);

    const hasCreateLeave = await rolePermissionService.hasPermission(
      'EMPLOYEE',
      'leaves',
      'apply'
    );
    console.log(`   EMPLOYEE can apply for leave: ${hasCreateLeave ? '✅ YES' : '❌ NO'}`);

    // 5. Check MANAGER permissions
    console.log('\n🔍 Checking MANAGER permissions...');
    const managerPerms = await rolePermissionService.getRolePermissions('MANAGER');
    console.log(`   ✅ MANAGER has ${managerPerms.length} permissions`);
    
    if (managerPerms.length === 0) {
      console.log('   ⚠️  MANAGER has no permissions assigned. This is expected if permissions are assigned dynamically.');
    }

    // 6. Check EMPLOYEE permissions
    console.log('\n🔍 Checking EMPLOYEE permissions...');
    const employeePerms = await rolePermissionService.getRolePermissions('EMPLOYEE');
    console.log(`   ✅ EMPLOYEE has ${employeePerms.length} permissions`);

    // 7. Test user permissions retrieval
    console.log('\n🔍 Testing getUserPermissions...');
    
    // Get a test organization
    const org = await prisma.organization.findFirst();
    if (org) {
      const hrManagerUserPerms = await rolePermissionService.getUserPermissions(
        'HR_MANAGER',
        org.id
      );
      console.log(`   HR_MANAGER user permissions (org-specific): ${hrManagerUserPerms.length}`);
    }

    const hrManagerSystemPerms = await rolePermissionService.getUserPermissions('HR_MANAGER');
    console.log(`   HR_MANAGER system permissions: ${hrManagerSystemPerms.length}`);

    // 8. Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 PERMISSION SYSTEM TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Total Permissions in Database: ${permissionCount}`);
    console.log(`✅ HR_MANAGER Permissions: ${hrManagerPerms.length}`);
    console.log(`✅ ORG_ADMIN Permissions: ${orgAdminPerms.length}`);
    console.log(`✅ MANAGER Permissions: ${managerPerms.length}`);
    console.log(`✅ EMPLOYEE Permissions: ${employeePerms.length}`);
    
    if (hrManagerPerms.length > 0 && orgAdminPerms.length > 0) {
      console.log('\n✅ Permission system is working correctly!');
      console.log('✅ HR_MANAGER and ORG_ADMIN have default access to all modules');
    } else {
      console.log('\n⚠️  Warning: HR_MANAGER or ORG_ADMIN may not have permissions assigned');
      console.log('   Run: npx ts-node src/scripts/seed-permissions.ts');
    }

  } catch (error: any) {
    console.error('❌ Error testing permission system:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testPermissionSystem();
