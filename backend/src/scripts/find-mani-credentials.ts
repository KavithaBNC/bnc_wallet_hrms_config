/**
 * Script to find Mani's login credentials
 */

import { prisma } from '../utils/prisma';

async function findManiCredentials() {
  try {
    console.log('🔍 Finding Mani employee and user credentials...\n');

    // Find employee by first name
    const employee = await prisma.employee.findFirst({
      where: {
        firstName: { contains: 'Mani', mode: 'insensitive' },
      },
      include: {
        user: {
          select: {
            email: true,
            role: true,
            isActive: true,
            isEmailVerified: true,
          },
        },
      },
    });

    if (!employee) {
      console.log('❌ No employee found with name "Mani"');
      console.log('\n💡 Available employees:');
      const allEmployees = await prisma.employee.findMany({
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeCode: true,
        },
      });
      allEmployees.forEach((emp) => {
        console.log(`   - ${emp.firstName} ${emp.lastName} (${emp.email || 'No email'}) - ${emp.employeeCode}`);
      });
      return;
    }

    console.log(`✅ Found Mani:`);
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Employee Code: ${employee.employeeCode}`);
    console.log(`   Email: ${employee.email || 'No email in employee record'}`);
    
    if (employee.user) {
      console.log(`\n👤 User Account:`);
      console.log(`   Email: ${employee.user.email}`);
      console.log(`   Role: ${employee.user.role}`);
      console.log(`   Active: ${employee.user.isActive}`);
      console.log(`   Email Verified: ${employee.user.isEmailVerified}`);
      console.log(`\n🔐 Login Credentials:`);
      console.log(`   Email: ${employee.user.email}`);
      console.log(`   Password: (Check with user or reset password)`);
    } else {
      console.log(`\n❌ No user account found for Mani`);
      console.log(`   Mani needs a user account to login`);
    }

    // Check if Mani has salary assigned
    const salary = await prisma.employeeSalary.findFirst({
      where: {
        employeeId: employee.id,
        isActive: true,
      },
    });

    console.log(`\n💰 Salary Status:`);
    if (salary) {
      console.log(`   ✅ Salary assigned: ₹${salary.grossSalary.toLocaleString()}/month`);
      console.log(`   Basic: ₹${salary.basicSalary.toLocaleString()}`);
      console.log(`   Net: ₹${salary.netSalary.toLocaleString()}`);
    } else {
      console.log(`   ❌ No active salary assigned`);
    }

    // Check if Mani has payslips
    const payslips = await prisma.payslip.findMany({
      where: {
        employeeId: employee.id,
      },
      include: {
        payrollCycle: {
          select: {
            name: true,
            payrollMonth: true,
            payrollYear: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    console.log(`\n📄 Payslips:`);
    if (payslips.length > 0) {
      console.log(`   ✅ Found ${payslips.length} payslip(s):`);
      payslips.forEach((p) => {
        console.log(`   - ${p.payrollCycle.name} (${p.payrollCycle.payrollMonth}/${p.payrollCycle.payrollYear}) - ₹${p.netSalary.toLocaleString()} - ${p.status}`);
      });
    } else {
      console.log(`   ❌ No payslips found`);
      console.log(`   💡 Need to create and process a payroll cycle first`);
    }

  } catch (error) {
    console.error('❌ Error finding Mani credentials:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

findManiCredentials()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
