import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n📋 All Users:\n');
    console.log('='.repeat(80));
    console.log(`${'Email'.padEnd(30)} ${'Role'.padEnd(15)} ${'Status'.padEnd(10)} ${'Name'}`);
    console.log('='.repeat(80));

    users.forEach(user => {
      const name = user.employee 
        ? `${user.employee.firstName} ${user.employee.lastName}` 
        : 'N/A';
      const status = user.isActive ? 'Active' : 'Inactive';
      console.log(
        `${user.email.padEnd(30)} ${user.role.padEnd(15)} ${status.padEnd(10)} ${name}`
      );
    });

    console.log('='.repeat(80));
    console.log(`\nTotal users: ${users.length}`);
    console.log('\n💡 To upgrade a user role, run:');
    console.log('   npx ts-node src/scripts/upgrade-user-role.ts <email> HR_MANAGER');
  } catch (error) {
    console.error('❌ Error listing users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
