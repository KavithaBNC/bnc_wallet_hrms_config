import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function createSuperAdmin(email: string, password: string, firstName: string, lastName: string) {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`⚠️  User with email "${email}" already exists`);
      console.log(`   Current role: ${existingUser.role}`);
      
      // Ask if we should upgrade the role
      if (existingUser.role !== 'SUPER_ADMIN') {
        console.log(`\n🔄 Upgrading user role to SUPER_ADMIN...`);
        await prisma.user.update({
          where: { email },
          data: { role: 'SUPER_ADMIN' },
        });
        console.log(`✅ User role upgraded to SUPER_ADMIN: ${email}`);
      } else {
        console.log(`✅ User is already a SUPER_ADMIN`);
      }
      
      await prisma.$disconnect();
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Get or create default organization
    let defaultOrganization = await prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!defaultOrganization) {
      console.log('📦 Creating default organization...');
      defaultOrganization = await prisma.organization.create({
        data: {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'BNC Technologies',
          legalName: 'BNC Technologies Pvt Ltd',
          industry: 'Information Technology',
          sizeRange: '51-200',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          fiscalYearStart: new Date('2026-04-01'),
          address: {},
          settings: {},
        },
      });
      console.log('✅ Default organization created');
    }

    // Generate unique employee code
    let employeeCode = `EMP${Date.now()}`;
    let codeExists = await prisma.employee.findUnique({
      where: { employeeCode },
    });
    
    while (codeExists) {
      employeeCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      codeExists = await prisma.employee.findUnique({
        where: { employeeCode },
      });
    }

    // Create SUPER_ADMIN user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        organizationId: defaultOrganization.id, // Super admin belongs to default org
        isEmailVerified: true, // Auto-verify for super admin
        isActive: true,
      },
    });

    // Create employee record for super admin
    await prisma.employee.create({
      data: {
        organizationId: defaultOrganization.id,
        employeeCode,
        userId: user.id,
        firstName,
        lastName,
        email,
        employeeStatus: 'ACTIVE',
        dateOfJoining: new Date(),
      },
    });

    console.log('\n✅ SUPER_ADMIN user created successfully!');
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   Role: SUPER_ADMIN`);
    console.log(`   Employee Code: ${employeeCode}`);
    console.log(`\n🔐 You can now login with these credentials.`);
  } catch (error) {
    console.error('❌ Error creating SUPER_ADMIN:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get parameters from command line arguments
const email = process.argv[2];
const password = process.argv[3];
const firstName = process.argv[4] || 'Super';
const lastName = process.argv[5] || 'Admin';

if (!email || !password || email === '--help') {
  console.log(`
Usage: npx ts-node src/scripts/create-super-admin.ts <email> <password> [firstName] [lastName]

Examples:
  npx ts-node src/scripts/create-super-admin.ts admin@example.com Admin@123456
  npx ts-node src/scripts/create-super-admin.ts admin@example.com Admin@123456 John Doe

Note: Password must meet requirements:
  - At least 8 characters
  - At least one lowercase letter
  - At least one uppercase letter
  - At least one number
  - At least one special character
  `);
  process.exit(0);
}

createSuperAdmin(email, password, firstName, lastName);
