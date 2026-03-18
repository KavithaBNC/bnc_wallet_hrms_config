import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to check and fix user roles based on employee positions
 * Usage: npx ts-node backend/src/scripts/check-user-role.ts <email>
 */
async function checkUserRole(email?: string) {
  try {
    console.log('\n🔍 Checking user roles...\n');

    const whereClause = email ? { email } : {};

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            position: {
              select: { title: true },
            },
            organization: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }

    for (const user of users) {
      console.log(`\n📋 User: ${user.email}`);
      console.log(`   Current Role: ${user.role}`);
      console.log(`   Organization: ${user.employee?.organization?.name || 'N/A'}`);
      console.log(`   Position: ${user.employee?.position?.title || 'N/A'}`);

      if (user.employee?.position) {
        const title = user.employee.position.title.toLowerCase();
        let expectedRole: string = 'EMPLOYEE';

        // Map position titles to user roles
        if (
          title.includes('hr admin') ||
          title.includes('hr manager') ||
          title.includes('hr administrator') ||
          title.includes('human resources manager') ||
          title.includes('human resource manager')
        ) {
          expectedRole = 'HR_MANAGER';
        } else if (title.includes('manager') && !title.includes('hr')) {
          expectedRole = 'MANAGER';
        }

        console.log(`   Expected Role: ${expectedRole}`);

        if (user.role !== expectedRole) {
          console.log(`   ⚠️  MISMATCH! Role should be ${expectedRole} but is ${user.role}`);
          console.log(`   💡 Run update script to fix: npx ts-node backend/src/scripts/update-employee-roles-from-positions.ts`);
        } else {
          console.log(`   ✅ Role is correct`);
        }
      } else {
        console.log(`   ⚠️  No position assigned`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line arguments
const email = process.argv[2];

checkUserRole(email);
