import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();

/**
 * Script to reset password for an employee
 * Usage: npm run ts-node backend/src/scripts/reset-employee-password.ts <employeeEmail> <newPassword>
 */
async function resetEmployeePassword(email: string, newPassword: string) {
  try {
    console.log(`\n🔐 Resetting password for employee: ${email}\n`);

    // Find employee by email
    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { user: true },
    });

    if (!employee) {
      console.error(`❌ Employee with email ${email} not found`);
      process.exit(1);
    }

    if (!employee.user) {
      console.error(`❌ Employee ${email} does not have a user account`);
      process.exit(1);
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: employee.userId },
      data: {
        passwordHash,
        refreshToken: null, // Invalidate all sessions
      },
    });

    console.log('✅ Password reset successfully!');
    console.log(`   Email: ${email}`);
    console.log(`   Employee: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Employee Code: ${employee.employeeCode}`);
    console.log(`   New Password: ${newPassword}`);
    console.log(`\n🔑 You can now login with these credentials.`);
  } catch (error: any) {
    console.error('❌ Error resetting password:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get parameters from command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('❌ Usage: npm run ts-node backend/src/scripts/reset-employee-password.ts <employeeEmail> <newPassword>');
  console.error('   Example: npm run ts-node backend/src/scripts/reset-employee-password.ts employee@example.com NewPass123!');
  process.exit(1);
}

if (password.length < 8) {
  console.error('❌ Password must be at least 8 characters');
  process.exit(1);
}

resetEmployeePassword(email, password);
