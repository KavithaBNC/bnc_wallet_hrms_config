import { prisma } from '../utils/prisma';

async function main() {
  console.log('🌱 Seeding Payroll Data...\n');

  try {
    // Get or create organization
    let organization = await prisma.organization.findFirst({
      where: { name: { contains: 'Test', mode: 'insensitive' } },
    });

    if (!organization) {
      // Get first organization
      organization = await prisma.organization.findFirst();
      if (!organization) {
        console.log('❌ No organization found. Please create an organization first.');
        return;
      }
    }

    console.log(`✅ Using organization: ${organization.name} (${organization.id})\n`);

    // Get employees
    const employees = await prisma.employee.findMany({
      where: { organizationId: organization.id },
      take: 5,
    });

    if (employees.length === 0) {
      console.log('❌ No employees found. Please create employees first.');
      return;
    }

    console.log(`✅ Found ${employees.length} employees\n`);

    // ============================================================================
    // MODULE 1: Salary Structure Management
    // ============================================================================
    console.log('📊 Creating Salary Structures...\n');

    // Create Standard Salary Structure
    const standardStructure = await prisma.salaryStructure.upsert({
      where: {
        id: '00000000-0000-0000-0000-000000000001',
      },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        organizationId: organization.id,
        name: 'Standard Salary Structure',
        description: 'Standard salary structure with Basic, HRA, and statutory deductions',
        components: [
          {
            name: 'Basic Salary',
            code: 'BASIC',
            type: 'EARNING',
            calculationType: 'FIXED',
            value: 50000,
            isTaxable: true,
            isStatutory: false,
            description: 'Basic Salary Component',
          },
          {
            name: 'HRA',
            code: 'HRA',
            type: 'EARNING',
            calculationType: 'PERCENTAGE',
            value: 40,
            baseComponent: 'BASIC',
            isTaxable: true,
            isStatutory: false,
            description: 'House Rent Allowance',
          },
          {
            name: 'Transport Allowance',
            code: 'TRANSPORT',
            type: 'EARNING',
            calculationType: 'FIXED',
            value: 5000,
            isTaxable: true,
            isStatutory: false,
            description: 'Transport Allowance',
          },
          {
            name: 'Provident Fund',
            code: 'PF',
            type: 'DEDUCTION',
            calculationType: 'PERCENTAGE',
            value: 12,
            baseComponent: 'BASIC',
            isTaxable: false,
            isStatutory: true,
            description: 'Employee Provident Fund',
          },
          {
            name: 'ESI',
            code: 'ESI',
            type: 'DEDUCTION',
            calculationType: 'PERCENTAGE',
            value: 1.75,
            baseComponent: 'GROSS',
            isTaxable: false,
            isStatutory: true,
            description: 'Employee State Insurance',
          },
        ],
        isActive: true,
      },
    });

    console.log(`✅ Created Salary Structure: ${standardStructure.name}`);

    // Create Executive Salary Structure
    const executiveStructure = await prisma.salaryStructure.upsert({
      where: {
        id: '00000000-0000-0000-0000-000000000002',
      },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        organizationId: organization.id,
        name: 'Executive Salary Structure',
        description: 'Executive level salary structure with higher components',
        components: [
          {
            name: 'Basic Salary',
            code: 'BASIC',
            type: 'EARNING',
            calculationType: 'FIXED',
            value: 100000,
            isTaxable: true,
            isStatutory: false,
            description: 'Basic Salary Component',
          },
          {
            name: 'HRA',
            code: 'HRA',
            type: 'EARNING',
            calculationType: 'PERCENTAGE',
            value: 50,
            baseComponent: 'BASIC',
            isTaxable: true,
            isStatutory: false,
            description: 'House Rent Allowance',
          },
          {
            name: 'Special Allowance',
            code: 'SPECIAL',
            type: 'EARNING',
            calculationType: 'FIXED',
            value: 30000,
            isTaxable: true,
            isStatutory: false,
            description: 'Special Allowance',
          },
          {
            name: 'Provident Fund',
            code: 'PF',
            type: 'DEDUCTION',
            calculationType: 'PERCENTAGE',
            value: 12,
            baseComponent: 'BASIC',
            isTaxable: false,
            isStatutory: true,
            description: 'Employee Provident Fund',
          },
        ],
        isActive: true,
      },
    });

    console.log(`✅ Created Salary Structure: ${executiveStructure.name}\n`);

    // ============================================================================
    // MODULE 1 (Part 2): Salary Templates
    // ============================================================================
    console.log('📋 Creating Salary Templates...\n');

    // Create Junior Level Template
    const juniorTemplate = await prisma.salaryTemplate.upsert({
      where: {
        id: '00000000-0000-0000-0000-000000000011',
      },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000011',
        organizationId: organization.id,
        salaryStructureId: standardStructure.id,
        name: 'Junior Level Template',
        grade: 'L1',
        level: 'Entry',
        description: 'Template for entry-level employees',
        ctc: 600000,
        basicSalary: 50000,
        grossSalary: 75000,
        netSalary: 65000,
        components: {
          basic: 50000,
          hra: 20000,
          transport: 5000,
          pf: 6000,
          esi: 1312.5,
        },
        currency: 'INR',
        paymentFrequency: 'MONTHLY',
        isActive: true,
      },
    });

    console.log(`✅ Created Salary Template: ${juniorTemplate.name}`);

    // Create Senior Level Template
    const seniorTemplate = await prisma.salaryTemplate.upsert({
      where: {
        id: '00000000-0000-0000-0000-000000000012',
      },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000012',
        organizationId: organization.id,
        salaryStructureId: executiveStructure.id,
        name: 'Senior Level Template',
        grade: 'L3',
        level: 'Senior',
        description: 'Template for senior-level employees',
        ctc: 1800000,
        basicSalary: 100000,
        grossSalary: 180000,
        netSalary: 156000,
        components: {
          basic: 100000,
          hra: 50000,
          special: 30000,
          pf: 12000,
        },
        currency: 'INR',
        paymentFrequency: 'MONTHLY',
        isActive: true,
      },
    });

    console.log(`✅ Created Salary Template: ${seniorTemplate.name}\n`);

    // ============================================================================
    // Employee Bank Accounts
    // ============================================================================
    console.log('🏦 Creating Employee Bank Accounts...\n');

    for (let i = 0; i < Math.min(employees.length, 3); i++) {
      const employee = employees[i];
      
      // Check if bank account already exists
      const existingAccount = await prisma.employeeBankAccount.findFirst({
        where: { employeeId: employee.id, isPrimary: true },
      });

      if (!existingAccount) {
        await prisma.employeeBankAccount.create({
          data: {
            employeeId: employee.id,
            bankName: `HDFC Bank ${i + 1}`,
            accountNumber: `123456789${i}`,
            routingNumber: `HDFC000${i + 1}`,
            accountType: 'CHECKING',
            isPrimary: true,
            isActive: true,
          },
        });

        console.log(`✅ Created bank account for ${employee.firstName} ${employee.lastName}`);
      }
    }

    console.log('');

    // ============================================================================
    // Employee Salary Assignments
    // ============================================================================
    console.log('💰 Assigning Salaries to Employees...\n');

    for (let i = 0; i < Math.min(employees.length, 3); i++) {
      const employee = employees[i];
      
      // Check if salary already exists
      const existingSalary = await prisma.employeeSalary.findFirst({
        where: { employeeId: employee.id, isActive: true },
      });

      if (!existingSalary) {
        const bankAccount = await prisma.employeeBankAccount.findFirst({
          where: { employeeId: employee.id, isPrimary: true },
        });

        // Use junior template for first 2, senior for third
        const template = i < 2 ? juniorTemplate : seniorTemplate;
        const structure = i < 2 ? standardStructure : executiveStructure;

        await prisma.employeeSalary.create({
          data: {
            employeeId: employee.id,
            salaryStructureId: structure.id,
            salaryTemplateId: template.id,
            effectiveDate: new Date('2026-01-01'),
            basicSalary: template.basicSalary,
            grossSalary: template.grossSalary,
            netSalary: template.netSalary,
            ctc: template.ctc,
            components: template.components as any,
            currency: 'INR',
            paymentFrequency: 'MONTHLY',
            bankAccountId: bankAccount?.id,
            isActive: true,
          },
        });

        console.log(`✅ Assigned salary to ${employee.firstName} ${employee.lastName} (${template.name})`);
      }
    }

    console.log('\n✅ Payroll seed data created successfully!\n');

    // Summary
    console.log('📊 Summary:');
    console.log(`   - Salary Structures: 2`);
    console.log(`   - Salary Templates: 2`);
    console.log(`   - Bank Accounts: ${Math.min(employees.length, 3)}`);
    console.log(`   - Employee Salaries: ${Math.min(employees.length, 3)}\n`);

  } catch (error) {
    console.error('❌ Error seeding payroll data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
