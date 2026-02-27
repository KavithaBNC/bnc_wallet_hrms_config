import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to fix missing organizationId in User table by copying from Employee table
 * Usage: npm run ts-node backend/src/scripts/fix-user-organization-id.ts
 */
async function fixUserOrganizationId() {
  try {
    console.log('\n🔧 Fixing User organizationId from Employee records...\n');

    // Get all users with employees
    const users = await prisma.user.findMany({
      where: {
        employee: { isNot: null },
      },
      include: {
        employee: {
          select: { organizationId: true },
        },
      },
    });

    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.employee) {
        skipped++;
        continue;
      }

      const employeeOrgId = user.employee.organizationId;

      // Update if organizationId is missing or different
      if (!user.organizationId || user.organizationId !== employeeOrgId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { organizationId: employeeOrgId },
        });

        console.log(
          `✅ Updated: ${user.email} - Set organizationId to ${employeeOrgId}`
        );
        updated++;
      } else {
        skipped++;
      }
    }

    // Handle SUPER_ADMIN users (they might not have employees)
    const superAdmins = await prisma.user.findMany({
      where: {
        role: 'SUPER_ADMIN',
        organizationId: null,
      },
    });

    if (superAdmins.length > 0) {
      // Get first organization or create default
      let defaultOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      if (!defaultOrg) {
        defaultOrg = await prisma.organization.create({
          data: {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Default Organization',
            legalName: 'Default Organization',
            industry: 'Information Technology',
            sizeRange: '1-10',
            timezone: 'UTC',
            currency: 'USD',
            address: {},
            settings: {},
          },
        });
      }

      for (const admin of superAdmins) {
        await prisma.user.update({
          where: { id: admin.id },
          data: { organizationId: defaultOrg.id },
        });
        console.log(
          `✅ Updated SUPER_ADMIN: ${admin.email} - Set organizationId to ${defaultOrg.id}`
        );
        updated++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped} (already correct)`);
    console.log(`   Total processed: ${users.length + superAdmins.length}`);
  } catch (error: any) {
    console.error('❌ Error fixing user organizationId:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserOrganizationId();
