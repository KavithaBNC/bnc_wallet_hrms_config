/**
 * Script to assign salaries specifically to Mani and Saravanan
 * This ensures they have salary assignments for payroll processing
 */

import { prisma } from '../utils/prisma';

async function assignSalaries() {
  try {
    console.log('🔍 Finding employees: Mani and Saravanan...\n');

    // Find employees by first name (case-insensitive)
    const employees = await prisma.employee.findMany({
      where: {
        OR: [
          { firstName: { contains: 'Saravanan', mode: 'insensitive' } },
          { firstName: { contains: 'Mani', mode: 'insensitive' } },
        ],
      },
      include: {
        organization: true,
      },
    });

    if (employees.length === 0) {
      console.log('❌ No employees found with names "Saravanan" or "Mani"');
      return;
    }

    console.log(`✅ Found ${employees.length} employee(s):`);
    employees.forEach((emp) => {
      console.log(`   - ${emp.firstName} ${emp.lastName} (${emp.employeeCode})`);
    });

    // Get or create salary structure
    let salaryStructure = await prisma.salaryStructure.findFirst({
      where: {
        organizationId: employees[0].organizationId,
        name: { contains: 'Standard', mode: 'insensitive' },
      },
    });

    if (!salaryStructure) {
      // Create Standard Salary Structure
      salaryStructure = await prisma.salaryStructure.create({
        data: {
          organizationId: employees[0].organizationId,
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
      console.log(`\n✅ Created Salary Structure: ${salaryStructure.name}`);
    } else {
      console.log(`\n✅ Using existing Salary Structure: ${salaryStructure.name}`);
    }

    // Calculate salary components
    const basicSalary = 50000;
    const hra = basicSalary * 0.4; // 40% of basic
    const transport = 5000;
    const grossSalary = basicSalary + hra + transport; // 75,000
    const pf = basicSalary * 0.12; // 12% of basic = 6,000
    const esi = grossSalary * 0.0175; // 1.75% of gross = 1,312.5
    const totalDeductions = pf + esi; // 7,312.5
    const netSalary = grossSalary - totalDeductions; // 67,687.5

    console.log(`\n💰 Salary Breakdown:`);
    console.log(`   Basic Salary: ₹${basicSalary.toLocaleString()}`);
    console.log(`   HRA (40%): ₹${hra.toLocaleString()}`);
    console.log(`   Transport: ₹${transport.toLocaleString()}`);
    console.log(`   Gross Salary: ₹${grossSalary.toLocaleString()}`);
    console.log(`   PF (12%): ₹${pf.toLocaleString()}`);
    console.log(`   ESI (1.75%): ₹${esi.toLocaleString()}`);
    console.log(`   Total Deductions: ₹${totalDeductions.toLocaleString()}`);
    console.log(`   Net Salary: ₹${netSalary.toLocaleString()}\n`);

    // Assign salary to each employee
    for (const employee of employees) {
      console.log(`\n👤 Processing: ${employee.firstName} ${employee.lastName}`);

      // Check if salary already exists
      const existingSalary = await prisma.employeeSalary.findFirst({
        where: {
          employeeId: employee.id,
          isActive: true,
        },
      });

      if (existingSalary) {
        console.log(`   ⏭️  Salary already assigned (₹${existingSalary.grossSalary.toLocaleString()}/month)`);
        continue;
      }

      // Get or create bank account
      let bankAccount = await prisma.employeeBankAccount.findFirst({
        where: {
          employeeId: employee.id,
          isPrimary: true,
        },
      });

      if (!bankAccount) {
        bankAccount = await prisma.employeeBankAccount.create({
          data: {
            employeeId: employee.id,
            bankName: 'HDFC Bank',
            accountNumber: `123456789${employee.employeeCode}`,
            routingNumber: 'HDFC0001234',
            accountType: 'CHECKING',
            isPrimary: true,
            isActive: true,
          },
        });
        console.log(`   ✅ Created bank account`);
      }

      // Create employee salary
      const employeeSalary = await prisma.employeeSalary.create({
        data: {
          employeeId: employee.id,
          salaryStructureId: salaryStructure.id,
          effectiveDate: new Date('2025-12-01'), // Effective from December 2025
          basicSalary: basicSalary,
          grossSalary: grossSalary,
          netSalary: netSalary,
          ctc: grossSalary * 12, // Annual CTC
          components: {
            basic: basicSalary,
            hra: hra,
            transport: transport,
            pf: pf,
            esi: esi,
          },
          currency: 'INR',
          paymentFrequency: 'MONTHLY',
          bankAccountId: bankAccount.id,
          isActive: true,
        },
      });

      console.log(`   ✅ Salary assigned successfully!`);
      console.log(`      - Gross: ₹${employeeSalary.grossSalary.toLocaleString()}/month`);
      console.log(`      - Net: ₹${employeeSalary.netSalary.toLocaleString()}/month`);
      console.log(`      - Effective from: ${new Date(employeeSalary.effectiveDate).toLocaleDateString()}`);
    }

    console.log(`\n✅ Salary assignment completed!\n`);
    console.log(`💡 You can now process payroll for December 2025!`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

assignSalaries()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
