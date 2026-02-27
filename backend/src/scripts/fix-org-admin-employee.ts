import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fix ORG_ADMIN users who don't have employee records
 * This script ensures all ORG_ADMIN users have proper employee records with organizationId
 */
async function fixOrgAdminEmployees() {
  try {
    console.log('🔍 Finding ORG_ADMIN users without employee records...\n');

    // Find all ORG_ADMIN users
    const orgAdmins = await prisma.user.findMany({
      where: {
        role: 'ORG_ADMIN',
      },
      include: {
        employee: true,
      },
    });

    console.log(`Found ${orgAdmins.length} ORG_ADMIN users\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const admin of orgAdmins) {
      if (admin.employee) {
        console.log(`✅ ${admin.email} - Already has employee record (Org: ${admin.employee.organizationId})`);
        skipped++;
        continue;
      }

      try {
        // Try to find an organization for this user
        // First, check if there's an organization with a similar name or check all orgs
        const organizations = await prisma.organization.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10, // Check recent organizations
        });

        if (organizations.length === 0) {
          console.log(`⚠️  ${admin.email} - No organizations found. Please create an organization first.`);
          errors++;
          continue;
        }

        // For now, assign to the first organization (or you can add logic to match by email domain, etc.)
        const organization = organizations[0];

        // Generate unique employee code
        let employeeCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        let codeExists = await prisma.employee.findUnique({
          where: { employeeCode },
        });

        while (codeExists) {
          employeeCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          codeExists = await prisma.employee.findUnique({
            where: { employeeCode },
          });
        }

        // Create employee record
        await prisma.employee.create({
          data: {
            organizationId: organization.id,
            employeeCode,
            userId: admin.id,
            firstName: admin.email.split('@')[0].split('.')[0] || 'Admin',
            lastName: 'User',
            email: admin.email,
            employeeStatus: 'ACTIVE',
            dateOfJoining: new Date(),
          },
        });

        console.log(`✅ ${admin.email} - Created employee record (Org: ${organization.name}, Code: ${employeeCode})`);
        fixed++;
      } catch (error: any) {
        console.error(`❌ ${admin.email} - Error: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`\n✅ Fix completed!`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixOrgAdminEmployees();
