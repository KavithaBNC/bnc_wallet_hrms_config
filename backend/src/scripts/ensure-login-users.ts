/**
 * Ensures SUPER_ADMIN and HR_MANAGER login users exist and have known passwords.
 * Run if you cannot login: npx ts-node -r tsconfig-paths/register src/scripts/ensure-login-users.ts
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

dotenv.config();
const prisma = new PrismaClient();

const CREDENTIALS = [
  { email: 'admin@hrms.com', password: 'Admin@123456', role: 'SUPER_ADMIN' as const },
  { email: 'hr@hrms.com', password: 'Hr@123456', role: 'HR_MANAGER' as const },
  { email: 'orgadmin@hrms.com', password: 'OrgAdmin@123', role: 'ORG_ADMIN' as const },
];

async function main() {
  console.log('\n--- Ensure login users (reset password & unlock) ---\n');

  for (const { email, password, role } of CREDENTIALS) {
    // Find user by email (case-insensitive)
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { employee: true },
    });

    if (!user) {
      console.log(`⚠️  User not found: ${email}. Run seed first: npm run seed:org-and-logins`);
      continue;
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true,
        lockedUntil: null,
        loginAttempts: 0,
        role,
      },
    });
    console.log(`✅ Password reset & unlocked: ${user.email} (${role})`);

    if (!user.employee) {
      const org = await prisma.organization.findFirst();
      if (org) {
        const empCode = `EMP${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await prisma.employee.create({
          data: {
            organizationId: org.id,
            employeeCode: empCode,
            userId: user.id,
            firstName: role.replace('_', ' '),
            lastName: 'User',
            email: user.email,
            employeeStatus: 'ACTIVE',
            dateOfJoining: new Date(),
          },
        });
        console.log(`   Created missing employee record for ${user.email}`);
      }
    } else if (user.employee.employeeStatus !== 'ACTIVE') {
      await prisma.employee.update({
        where: { id: user.employee.id },
        data: { employeeStatus: 'ACTIVE' },
      });
      console.log(`   Set employee status to ACTIVE for ${user.email}`);
    }
  }

  console.log('\nTry logging in with:\n  Super Admin: admin@hrms.com / Admin@123456\n  HR Manager:  hr@hrms.com / Hr@123456\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
