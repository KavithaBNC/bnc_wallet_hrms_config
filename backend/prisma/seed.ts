import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('🗑️  Clearing existing test data...');
  await prisma.employee.deleteMany({ where: { email: { contains: '@test.hrms.com' } } });
  await prisma.user.deleteMany({ where: { email: { contains: '@test.hrms.com' } } });

  // Remove existing test org and its data so we can recreate (avoids unique code conflict)
  const existingTestOrgs = await prisma.organization.findMany({ where: { name: 'Test Corp Inc' } });
  for (const org of existingTestOrgs) {
    await prisma.employee.deleteMany({ where: { organizationId: org.id } });
    await prisma.jobPosition.deleteMany({ where: { organizationId: org.id } });
    await prisma.department.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
  if (existingTestOrgs.length > 0) {
    console.log('🗑️  Removed existing Test Corp Inc organization and its departments/positions');
  }

  // Hash password for all test users
  const password = 'Test@123';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('📝 Test user credentials: email varies, password: Test@123');

  // 1. Create SUPER_ADMIN user
  console.log('👤 Creating SUPER_ADMIN user...');
  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@test.hrms.com',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`✅ SUPER_ADMIN created: ${superAdmin.email}`);

  // 2. Create Test Organization
  console.log('🏢 Creating test organization...');
  const organization = await prisma.organization.create({
    data: {
      name: 'Test Corp Inc',
      legalName: 'Test Corp Inc',
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        postalCode: '12345',
      },
      website: 'https://testcorp.com',
      timezone: 'UTC',
      currency: 'USD',
      settings: {
        dateFormat: 'YYYY-MM-DD',
        contact: { email: 'info@testcorp.com', phone: '+1234567890' },
      },
    },
  });
  console.log(`✅ Organization created: ${organization.name}`);

  // 3. Create Departments
  console.log('🏬 Creating test departments...');
  const hrDepartment = await prisma.department.create({
    data: {
      organizationId: organization.id,
      name: 'Human Resources',
      code: 'HR',
      description: 'HR Department',
      isActive: true,
    },
  });

  const itDepartment = await prisma.department.create({
    data: {
      organizationId: organization.id,
      name: 'Information Technology',
      code: 'IT',
      description: 'IT Department',
      isActive: true,
    },
  });

  const salesDepartment = await prisma.department.create({
    data: {
      organizationId: organization.id,
      name: 'Sales',
      code: 'SALES',
      description: 'Sales Department',
      isActive: true,
    },
  });
  console.log(`✅ Departments created: HR, IT, Sales`);

  // 3b. Create one Sub-Department (for dropdown/reference; requires sub_departments table)
  try {
    const subDept = await prisma.subDepartment.upsert({
      where: {
        organizationId_name: { organizationId: organization.id, name: 'HR Operations' },
      },
      create: {
        organizationId: organization.id,
        name: 'HR Operations',
        isActive: true,
      },
      update: {},
    });
    console.log(`✅ Sub-department created/ensured: ${subDept.name}`);
  } catch (e: any) {
    if (e.message?.includes('sub_departments') || e.message?.includes('does not exist')) {
      console.log('⏭️  Sub-department skipped (run migration first: npm run migrate:sub-department)');
    } else {
      throw e;
    }
  }

  // 4. Create Positions
  console.log('💼 Creating test positions...');
  const hrManagerPosition = await prisma.jobPosition.create({
    data: {
      organizationId: organization.id,
      departmentId: hrDepartment.id,
      title: 'HR Manager',
      code: 'HRMGR',
      description: 'Human Resources Manager',
      level: 'MANAGER',
      employmentType: 'FULL_TIME',
      isActive: true,
    },
  });

  const itManagerPosition = await prisma.jobPosition.create({
    data: {
      organizationId: organization.id,
      departmentId: itDepartment.id,
      title: 'IT Manager',
      code: 'ITMGR',
      description: 'Information Technology Manager',
      level: 'MANAGER',
      employmentType: 'FULL_TIME',
      isActive: true,
    },
  });

  const developerPosition = await prisma.jobPosition.create({
    data: {
      organizationId: organization.id,
      departmentId: itDepartment.id,
      title: 'Software Developer',
      code: 'SWDEV',
      description: 'Software Developer',
      level: 'SENIOR',
      employmentType: 'FULL_TIME',
      isActive: true,
    },
  });

  const salesRepPosition = await prisma.jobPosition.create({
    data: {
      organizationId: organization.id,
      departmentId: salesDepartment.id,
      title: 'Sales Representative',
      code: 'SALESREP',
      description: 'Sales Representative',
      level: 'ENTRY',
      employmentType: 'FULL_TIME',
      isActive: true,
    },
  });
  console.log(`✅ Positions created: HR Manager, IT Manager, Developer, Sales Rep`);

  // 5. Create ORG_ADMIN user with employee profile
  console.log('👤 Creating ORG_ADMIN user...');
  const orgAdminUser = await prisma.user.create({
    data: {
      email: 'orgadmin@test.hrms.com',
      passwordHash,
      role: UserRole.ORG_ADMIN,
      isActive: true,
      isEmailVerified: true,
    },
  });

  const orgAdminEmployee = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      userId: orgAdminUser.id,
      employeeCode: 'EMP001',
      firstName: 'Org',
      lastName: 'Admin',
      email: 'orgadmin@test.hrms.com',
      phone: '+1234567801',
      dateOfJoining: new Date('2024-01-01'),
      departmentId: hrDepartment.id,
      positionId: hrManagerPosition.id,
      employeeStatus: 'ACTIVE',
      gender: 'MALE',
    },
  });
  console.log(`✅ ORG_ADMIN created: ${orgAdminUser.email} (Employee: ${orgAdminEmployee.employeeCode})`);

  // 6. Create HR_MANAGER user with employee profile
  console.log('👤 Creating HR_MANAGER user...');
  const hrManagerUser = await prisma.user.create({
    data: {
      email: 'hrmanager@test.hrms.com',
      passwordHash,
      role: UserRole.HR_MANAGER,
      isActive: true,
      isEmailVerified: true,
    },
  });

  const hrManagerEmployee = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      userId: hrManagerUser.id,
      employeeCode: 'EMP002',
      firstName: 'HR',
      lastName: 'Manager',
      email: 'hrmanager@test.hrms.com',
      phone: '+1234567802',
      dateOfJoining: new Date('2024-01-15'),
      departmentId: hrDepartment.id,
      positionId: hrManagerPosition.id,
      employeeStatus: 'ACTIVE',
      gender: 'FEMALE',
    },
  });
  console.log(`✅ HR_MANAGER created: ${hrManagerUser.email} (Employee: ${hrManagerEmployee.employeeCode})`);

  // 7. Create MANAGER user with employee profile
  console.log('👤 Creating MANAGER user...');
  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@test.hrms.com',
      passwordHash,
      role: UserRole.MANAGER,
      isActive: true,
      isEmailVerified: true,
    },
  });

  const managerEmployee = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      userId: managerUser.id,
      employeeCode: 'EMP003',
      firstName: 'IT',
      lastName: 'Manager',
      email: 'manager@test.hrms.com',
      phone: '+1234567803',
      dateOfJoining: new Date('2024-02-01'),
      departmentId: itDepartment.id,
      positionId: itManagerPosition.id,
      employeeStatus: 'ACTIVE',
      gender: 'MALE',
    },
  });
  console.log(`✅ MANAGER created: ${managerUser.email} (Employee: ${managerEmployee.employeeCode})`);

  // 8. Create EMPLOYEE user with employee profile (reports to IT Manager)
  console.log('👤 Creating EMPLOYEE user...');
  const employeeUser = await prisma.user.create({
    data: {
      email: 'employee@test.hrms.com',
      passwordHash,
      role: UserRole.EMPLOYEE,
      isActive: true,
      isEmailVerified: true,
    },
  });

  const employee = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      userId: employeeUser.id,
      employeeCode: 'EMP004',
      firstName: 'John',
      lastName: 'Developer',
      email: 'employee@test.hrms.com',
      phone: '+1234567804',
      dateOfJoining: new Date('2024-03-01'),
      dateOfBirth: new Date('1995-05-15'),
      gender: 'MALE',
      maritalStatus: 'SINGLE',
      departmentId: itDepartment.id,
      positionId: developerPosition.id,
      reportingManagerId: managerEmployee.id,
      employeeStatus: 'ACTIVE',
      address: {
        street: '456 Developer Lane',
        city: 'Code City',
        state: 'Tech State',
        country: 'USA',
        postalCode: '54321',
      },
      emergencyContacts: [
        {
          name: 'Jane Developer',
          relationship: 'Spouse',
          phone: '+1234567899',
          email: 'jane@example.com',
        },
      ],
    },
  });
  console.log(`✅ EMPLOYEE created: ${employeeUser.email} (Employee: ${employee.employeeCode})`);

  // 9. Create additional test employee (with user account - Employee requires userId)
  console.log('👤 Creating additional test employee...');
  const sarahUser = await prisma.user.create({
    data: {
      email: 'sarah.sales@test.hrms.com',
      passwordHash,
      role: UserRole.EMPLOYEE,
      organizationId: organization.id,
      isActive: true,
      isEmailVerified: true,
    },
  });
  const testEmployee = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      userId: sarahUser.id,
      employeeCode: 'EMP005',
      firstName: 'Sarah',
      lastName: 'Sales',
      email: 'sarah.sales@test.hrms.com',
      phone: '+1234567805',
      dateOfJoining: new Date('2024-04-01'),
      dateOfBirth: new Date('1992-08-20'),
      gender: 'FEMALE',
      maritalStatus: 'MARRIED',
      departmentId: salesDepartment.id,
      positionId: salesRepPosition.id,
      employeeStatus: 'ACTIVE',
      address: {
        street: '789 Sales Avenue',
        city: 'Commerce City',
        state: 'Business State',
        country: 'USA',
        postalCode: '67890',
      },
    },
  });
  console.log(`✅ Test employee created: ${testEmployee.email} (${testEmployee.employeeCode})`);

  console.log('\n🎉 Seeding completed successfully!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 TEST USER CREDENTIALS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Password for ALL users: Test@123\n');
  console.log('1️⃣  SUPER_ADMIN');
  console.log('   Email: superadmin@test.hrms.com');
  console.log('   Role: SUPER_ADMIN');
  console.log('   Access: Full system access\n');

  console.log('2️⃣  ORG_ADMIN');
  console.log('   Email: orgadmin@test.hrms.com');
  console.log('   Role: ORG_ADMIN');
  console.log('   Employee Code: EMP001');
  console.log('   Department: Human Resources');
  console.log('   Access: Organization admin, can create/update/delete employees\n');

  console.log('3️⃣  HR_MANAGER');
  console.log('   Email: hrmanager@test.hrms.com');
  console.log('   Role: HR_MANAGER');
  console.log('   Employee Code: EMP002');
  console.log('   Department: Human Resources');
  console.log('   Access: Can create/update employees, view statistics\n');

  console.log('4️⃣  MANAGER');
  console.log('   Email: manager@test.hrms.com');
  console.log('   Role: MANAGER');
  console.log('   Employee Code: EMP003');
  console.log('   Department: Information Technology');
  console.log('   Access: Can view employees, view hierarchy\n');

  console.log('5️⃣  EMPLOYEE');
  console.log('   Email: employee@test.hrms.com');
  console.log('   Role: EMPLOYEE');
  console.log('   Employee Code: EMP004');
  console.log('   Department: Information Technology');
  console.log('   Reports To: IT Manager (EMP003)');
  console.log('   Access: Can view employees only\n');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🏢 TEST DATA CREATED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Organization: ${organization.name} (${organization.id})`);
  console.log('Departments: HR, IT, Sales');
  console.log('Positions: HR Manager, IT Manager, Developer, Sales Rep');
  console.log('Employees: 5 total (4 with user accounts, 1 without)\n');

  console.log('🚀 You can now test role-based access control!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
