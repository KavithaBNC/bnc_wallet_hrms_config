import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function upgradeUserRole(email: string, role: UserRole = 'HR_MANAGER') {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    await prisma.user.update({
      where: { email },
      data: { role },
    });

    console.log(`✅ User role updated: ${email} -> ${role}`);
  } catch (error) {
    console.error('❌ Error updating user role:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email and role from command line arguments
const email = process.argv[2];
const role = (process.argv[3] as UserRole) || 'HR_MANAGER';

if (!email || email === '--help') {
  console.log(`
Usage: npx ts-node src/scripts/upgrade-user-role.ts <email> [role]

Examples:
  npx ts-node src/scripts/upgrade-user-role.ts user@example.com                    # Upgrade to HR_MANAGER (default)
  npx ts-node src/scripts/upgrade-user-role.ts user@example.com ORG_ADMIN          # Upgrade to ORG_ADMIN
  npx ts-node src/scripts/upgrade-user-role.ts user@example.com SUPER_ADMIN        # Upgrade to SUPER_ADMIN

Available roles: SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER, EMPLOYEE
  `);
  process.exit(0);
}

// Validate role
const validRoles: UserRole[] = ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
if (!validRoles.includes(role)) {
  console.log(`❌ Invalid role: ${role}`);
  console.log(`Valid roles: ${validRoles.join(', ')}`);
  process.exit(1);
}

upgradeUserRole(email, role);
