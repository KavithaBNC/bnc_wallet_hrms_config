import axios from 'axios';
import { prisma } from '../utils/prisma';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

// Test results storage
const testResults: Array<{
  module: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
}> = [];

// Helper function to log results
function logResult(module: string, test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} [${module}] ${test}: ${message}`);
  testResults.push({ module, test, status, message });
}

// Helper function to make API calls
async function apiCall(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  token?: string
) {
  try {
    const config: any = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    return {
      status: error.response?.status || 500,
      data: error.response?.data || { message: error.message },
    };
  }
}

// Get authentication token
async function getAuthToken(email: string, password: string): Promise<string | null> {
  try {
    const response = await apiCall('POST', '/auth/login', { email, password });
    if (response.status === 200 && response.data?.data?.token) {
      return response.data.data.token;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Variables to store IDs for testing
let organizationId: string;
let adminToken: string;
let employeeToken: string;
let salaryStructureId: string;
let salaryTemplateId: string;
let employeeId: string;
let payrollCycleId: string;
let payslipId: string;

async function main() {
  console.log('🧪 Testing Phase 4 Modules - Comprehensive Test Suite\n');
  console.log('=' .repeat(60));

  try {
    // ============================================================================
    // Setup: Get Organization and Authentication
    // ============================================================================
    console.log('\n📋 Setup: Getting Organization and Authentication...\n');

    // Get organization
    const organization = await prisma.organization.findFirst();
    if (!organization) {
      console.log('❌ No organization found. Please create an organization first.');
      return;
    }
    organizationId = organization.id;
    console.log(`✅ Using organization: ${organization.name} (${organizationId})\n`);

    // Get admin user (ORG_ADMIN or HR_MANAGER)
    const adminUser = await prisma.user.findFirst({
      where: {
        role: { in: ['ORG_ADMIN', 'HR_MANAGER'] },
        employee: {
          organizationId: organizationId,
        },
      },
      include: { employee: true },
    });

    if (!adminUser) {
      console.log('❌ No admin user found. Please create an admin user first.');
      return;
    }

    // Get employee user
    const employeeUser = await prisma.user.findFirst({
      where: {
        role: 'EMPLOYEE',
        employee: {
          organizationId: organizationId,
        },
      },
      include: { employee: true },
    });

    if (!employeeUser) {
      console.log('❌ No employee user found. Please create an employee user first.');
      return;
    }

    employeeId = employeeUser.employee!.id;

    // Login as admin (using default password)
    adminToken = await getAuthToken(adminUser.email, 'password123') || '';
    if (!adminToken) {
      console.log('❌ Failed to login as admin. Using default password: password123');
      return;
    }
    console.log('✅ Admin authentication successful\n');

    // Login as employee
    employeeToken = await getAuthToken(employeeUser.email, 'password123') || '';
    if (!employeeToken) {
      console.log('⚠️  Failed to login as employee. Some employee tests will be skipped.\n');
    } else {
      console.log('✅ Employee authentication successful\n');
    }

    // ============================================================================
    // MODULE 1: Salary Structure Management
    // ============================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 MODULE 1: SALARY STRUCTURE MANAGEMENT');
    console.log('='.repeat(60) + '\n');

    // Test 1.1: Get Predefined Components
    console.log('Test 1.1: Get Predefined Components');
    const predefinedResponse = await apiCall(
      'GET',
      '/payroll/salary-components',
      undefined,
      adminToken
    );
    if (predefinedResponse.status === 200 && predefinedResponse.data?.data) {
      logResult(
        'MODULE_1',
        'Get Predefined Components',
        'PASS',
        `Found ${predefinedResponse.data.data.earnings?.length || 0} earnings and ${predefinedResponse.data.data.deductions?.length || 0} deductions`
      );
    } else {
      logResult('MODULE_1', 'Get Predefined Components', 'FAIL', JSON.stringify(predefinedResponse.data));
    }

    // Test 1.2: Create Salary Structure
    console.log('\nTest 1.2: Create Salary Structure');
    const createStructureData = {
      organizationId,
      name: 'Test Salary Structure',
      description: 'Test structure for Phase 4 testing',
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
    };

    const createStructureResponse = await apiCall(
      'POST',
      '/payroll/salary-structures',
      createStructureData,
      adminToken
    );
    if (createStructureResponse.status === 201 && createStructureResponse.data?.data?.id) {
      salaryStructureId = createStructureResponse.data.data.id;
      logResult('MODULE_1', 'Create Salary Structure', 'PASS', `Created with ID: ${salaryStructureId}`);
    } else {
      logResult('MODULE_1', 'Create Salary Structure', 'FAIL', JSON.stringify(createStructureResponse.data));
    }

    // Test 1.3: Get All Salary Structures
    console.log('\nTest 1.3: Get All Salary Structures');
    const getAllStructuresResponse = await apiCall(
      'GET',
      `/payroll/salary-structures?organizationId=${organizationId}`,
      undefined,
      adminToken
    );
    if (getAllStructuresResponse.status === 200 && Array.isArray(getAllStructuresResponse.data?.data)) {
      logResult(
        'MODULE_1',
        'Get All Salary Structures',
        'PASS',
        `Found ${getAllStructuresResponse.data.data.length} structures`
      );
    } else {
      logResult('MODULE_1', 'Get All Salary Structures', 'FAIL', JSON.stringify(getAllStructuresResponse.data));
    }

    // Test 1.4: Get Salary Structure by ID
    console.log('\nTest 1.4: Get Salary Structure by ID');
    if (salaryStructureId) {
      const getByIdResponse = await apiCall(
        'GET',
        `/payroll/salary-structures/${salaryStructureId}`,
        undefined,
        adminToken
      );
      if (getByIdResponse.status === 200 && getByIdResponse.data?.data?.id) {
        logResult('MODULE_1', 'Get Salary Structure by ID', 'PASS', 'Retrieved successfully');
      } else {
        logResult('MODULE_1', 'Get Salary Structure by ID', 'FAIL', JSON.stringify(getByIdResponse.data));
      }
    } else {
      logResult('MODULE_1', 'Get Salary Structure by ID', 'SKIP', 'No structure ID available');
    }

    // ============================================================================
    // MODULE 1 (Part 2): Salary Templates & Employee Salary Assignment
    // ============================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📋 MODULE 1 (Part 2): SALARY TEMPLATES & EMPLOYEE SALARY');
    console.log('='.repeat(60) + '\n');

    // Test 1.5: Create Salary Template
    console.log('Test 1.5: Create Salary Template');
    if (salaryStructureId) {
      const createTemplateData = {
        organizationId,
        salaryStructureId,
        name: 'Test Template L1',
        grade: 'L1',
        level: 'Entry',
        description: 'Test template for entry level',
        ctc: 600000,
        basicSalary: 50000,
        grossSalary: 75000,
        netSalary: 65000,
        components: {
          basic: 50000,
          hra: 20000,
          pf: 6000,
        },
        currency: 'INR',
        paymentFrequency: 'MONTHLY',
        isActive: true,
      };

      const createTemplateResponse = await apiCall(
        'POST',
        '/payroll/salary-templates',
        createTemplateData,
        adminToken
      );
      if (createTemplateResponse.status === 201 && createTemplateResponse.data?.data?.id) {
        salaryTemplateId = createTemplateResponse.data.data.id;
        logResult('MODULE_1_P2', 'Create Salary Template', 'PASS', `Created with ID: ${salaryTemplateId}`);
      } else {
        logResult('MODULE_1_P2', 'Create Salary Template', 'FAIL', JSON.stringify(createTemplateResponse.data));
      }
    } else {
      logResult('MODULE_1_P2', 'Create Salary Template', 'SKIP', 'No structure ID available');
    }

    // Test 1.6: Get All Salary Templates
    console.log('\nTest 1.6: Get All Salary Templates');
    const getAllTemplatesResponse = await apiCall(
      'GET',
      `/payroll/salary-templates?organizationId=${organizationId}`,
      undefined,
      adminToken
    );
    if (getAllTemplatesResponse.status === 200 && Array.isArray(getAllTemplatesResponse.data?.data)) {
      logResult(
        'MODULE_1_P2',
        'Get All Salary Templates',
        'PASS',
        `Found ${getAllTemplatesResponse.data.data.length} templates`
      );
    } else {
      logResult('MODULE_1_P2', 'Get All Salary Templates', 'FAIL', JSON.stringify(getAllTemplatesResponse.data));
    }

    // Test 1.7: Create Employee Salary
    console.log('\nTest 1.7: Create Employee Salary');
    if (employeeId && salaryStructureId) {
      const createSalaryData = {
        employeeId,
        salaryStructureId,
        effectiveDate: '2026-01-01',
        basicSalary: 50000,
        grossSalary: 75000,
        netSalary: 65000,
        components: {
          basic: 50000,
          hra: 20000,
          pf: 6000,
        },
        currency: 'INR',
        paymentFrequency: 'MONTHLY',
        isActive: true,
      };

      const createSalaryResponse = await apiCall(
        'POST',
        '/payroll/employee-salaries',
        createSalaryData,
        adminToken
      );
      if (createSalaryResponse.status === 201 && createSalaryResponse.data?.data?.id) {
        logResult('MODULE_1_P2', 'Create Employee Salary', 'PASS', 'Created successfully');
      } else {
        logResult('MODULE_1_P2', 'Create Employee Salary', 'FAIL', JSON.stringify(createSalaryResponse.data));
      }
    } else {
      logResult('MODULE_1_P2', 'Create Employee Salary', 'SKIP', 'Missing employee or structure ID');
    }

    // ============================================================================
    // MODULE 2: Payroll Processing
    // ============================================================================
    console.log('\n' + '='.repeat(60));
    console.log('💰 MODULE 2: PAYROLL PROCESSING');
    console.log('='.repeat(60) + '\n');

    // Test 2.1: Create Payroll Cycle
    console.log('Test 2.1: Create Payroll Cycle');
    const createCycleData = {
      organizationId,
      name: 'January 2026 Payroll',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      paymentDate: '2026-02-05',
      notes: 'Test payroll cycle for Phase 4',
    };

    const createCycleResponse = await apiCall(
      'POST',
      '/payroll/payroll-cycles',
      createCycleData,
      adminToken
    );
    if (createCycleResponse.status === 201 && createCycleResponse.data?.data?.id) {
      payrollCycleId = createCycleResponse.data.data.id;
      logResult('MODULE_2', 'Create Payroll Cycle', 'PASS', `Created with ID: ${payrollCycleId}`);
    } else {
      logResult('MODULE_2', 'Create Payroll Cycle', 'FAIL', JSON.stringify(createCycleResponse.data));
    }

    // Test 2.2: Get All Payroll Cycles
    console.log('\nTest 2.2: Get All Payroll Cycles');
    const getAllCyclesResponse = await apiCall(
      'GET',
      `/payroll/payroll-cycles?organizationId=${organizationId}`,
      undefined,
      adminToken
    );
    if (getAllCyclesResponse.status === 200 && getAllCyclesResponse.data?.data) {
      logResult(
        'MODULE_2',
        'Get All Payroll Cycles',
        'PASS',
        `Found ${getAllCyclesResponse.data.data.length || 0} cycles`
      );
    } else {
      logResult('MODULE_2', 'Get All Payroll Cycles', 'FAIL', JSON.stringify(getAllCyclesResponse.data));
    }

    // Test 2.3: Process Payroll Cycle
    console.log('\nTest 2.3: Process Payroll Cycle');
    if (payrollCycleId) {
      const processData = {
        taxRegime: 'NEW',
      };

      const processResponse = await apiCall(
        'POST',
        `/payroll/payroll-cycles/${payrollCycleId}/process`,
        processData,
        adminToken
      );
      if (processResponse.status === 200 && processResponse.data?.success) {
        logResult('MODULE_2', 'Process Payroll Cycle', 'PASS', 'Payroll processed successfully');
      } else {
        logResult('MODULE_2', 'Process Payroll Cycle', 'FAIL', JSON.stringify(processResponse.data));
      }
    } else {
      logResult('MODULE_2', 'Process Payroll Cycle', 'SKIP', 'No cycle ID available');
    }

    // ============================================================================
    // MODULE 3: Payroll Run Management
    // ============================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🔒 MODULE 3: PAYROLL RUN MANAGEMENT');
    console.log('='.repeat(60) + '\n');

    // Test 3.1: Finalize Payroll Cycle
    console.log('Test 3.1: Finalize Payroll Cycle');
    if (payrollCycleId) {
      const finalizeResponse = await apiCall(
        'POST',
        `/payroll/payroll-cycles/${payrollCycleId}/finalize`,
        {},
        adminToken
      );
      if (finalizeResponse.status === 200 && finalizeResponse.data?.success) {
        logResult('MODULE_3', 'Finalize Payroll Cycle', 'PASS', 'Payroll finalized successfully');
      } else {
        logResult('MODULE_3', 'Finalize Payroll Cycle', 'FAIL', JSON.stringify(finalizeResponse.data));
      }
    } else {
      logResult('MODULE_3', 'Finalize Payroll Cycle', 'SKIP', 'No cycle ID available');
    }

    // Test 3.2: Rollback Payroll Cycle
    console.log('\nTest 3.2: Rollback Payroll Cycle');
    if (payrollCycleId) {
      const rollbackResponse = await apiCall(
        'POST',
        `/payroll/payroll-cycles/${payrollCycleId}/rollback`,
        {},
        adminToken
      );
      if (rollbackResponse.status === 200 && rollbackResponse.data?.success) {
        logResult('MODULE_3', 'Rollback Payroll Cycle', 'PASS', 'Payroll rolled back successfully');
      } else {
        logResult('MODULE_3', 'Rollback Payroll Cycle', 'FAIL', JSON.stringify(rollbackResponse.data));
      }
    } else {
      logResult('MODULE_3', 'Rollback Payroll Cycle', 'SKIP', 'No cycle ID available');
    }

    // Test 3.3: Query by Month/Year
    console.log('\nTest 3.3: Query Payroll Cycles by Month/Year');
    const queryByMonthResponse = await apiCall(
      'GET',
      `/payroll/payroll-cycles?organizationId=${organizationId}&payrollMonth=1&payrollYear=2026`,
      undefined,
      adminToken
    );
    if (queryByMonthResponse.status === 200) {
      logResult('MODULE_3', 'Query by Month/Year', 'PASS', 'Query successful');
    } else {
      logResult('MODULE_3', 'Query by Month/Year', 'FAIL', JSON.stringify(queryByMonthResponse.data));
    }

    // ============================================================================
    // MODULE 3: Payslip Generation
    // ============================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📄 MODULE 3: PAYSLIP GENERATION');
    console.log('='.repeat(60) + '\n');

    // Test 3.4: Get All Payslips
    console.log('Test 3.4: Get All Payslips');
    const getAllPayslipsResponse = await apiCall(
      'GET',
      `/payroll/payslips?organizationId=${organizationId}`,
      undefined,
      adminToken
    );
    if (getAllPayslipsResponse.status === 200 && getAllPayslipsResponse.data?.data) {
      const payslips = getAllPayslipsResponse.data.data;
      if (payslips.length > 0) {
        payslipId = payslips[0].id;
      }
      logResult('MODULE_3', 'Get All Payslips', 'PASS', `Found ${payslips.length || 0} payslips`);
    } else {
      logResult('MODULE_3', 'Get All Payslips', 'FAIL', JSON.stringify(getAllPayslipsResponse.data));
    }

    // Test 3.5: Get Comprehensive Payslip
    console.log('\nTest 3.5: Get Comprehensive Payslip');
    if (payslipId) {
      const comprehensiveResponse = await apiCall(
        'GET',
        `/payroll/payslips/${payslipId}/comprehensive`,
        undefined,
        adminToken
      );
      if (comprehensiveResponse.status === 200 && comprehensiveResponse.data?.data) {
        const data = comprehensiveResponse.data.data;
        const hasBreakdown = data.earningsBreakdown && data.deductionsBreakdown;
        const hasYTD = data.ytdTotals;
        const hasBank = data.bankDetails !== undefined;
        logResult(
          'MODULE_3',
          'Get Comprehensive Payslip',
          'PASS',
          `Has breakdown: ${hasBreakdown}, YTD: ${hasYTD}, Bank: ${hasBank}`
        );
      } else {
        logResult('MODULE_3', 'Get Comprehensive Payslip', 'FAIL', JSON.stringify(comprehensiveResponse.data));
      }
    } else {
      logResult('MODULE_3', 'Get Comprehensive Payslip', 'SKIP', 'No payslip ID available');
    }

    // Test 3.6: Employee Self-Service - Get Own Payslips
    console.log('\nTest 3.6: Employee Self-Service - Get Own Payslips');
    if (employeeToken && employeeId) {
      const employeePayslipsResponse = await apiCall(
        'GET',
        `/payroll/payslips/employee/${employeeId}`,
        undefined,
        employeeToken
      );
      if (employeePayslipsResponse.status === 200) {
        logResult('MODULE_3', 'Employee Get Own Payslips', 'PASS', 'Employee can view own payslips');
      } else {
        logResult('MODULE_3', 'Employee Get Own Payslips', 'FAIL', JSON.stringify(employeePayslipsResponse.data));
      }
    } else {
      logResult('MODULE_3', 'Employee Get Own Payslips', 'SKIP', 'No employee token available');
    }

    // Test 3.7: Download Payslip PDF (Placeholder)
    console.log('\nTest 3.7: Download Payslip PDF');
    if (payslipId) {
      const pdfResponse = await apiCall(
        'GET',
        `/payroll/payslips/${payslipId}/download`,
        undefined,
        adminToken
      );
      if (pdfResponse.status === 200) {
        logResult('MODULE_3', 'Download Payslip PDF', 'PASS', 'PDF endpoint accessible (placeholder mode)');
      } else {
        logResult('MODULE_3', 'Download Payslip PDF', 'FAIL', JSON.stringify(pdfResponse.data));
      }
    } else {
      logResult('MODULE_3', 'Download Payslip PDF', 'SKIP', 'No payslip ID available');
    }

    // ============================================================================
    // Summary
    // ============================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60) + '\n');

    const passed = testResults.filter((r) => r.status === 'PASS').length;
    const failed = testResults.filter((r) => r.status === 'FAIL').length;
    const skipped = testResults.filter((r) => r.status === 'SKIP').length;
    const total = testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => {
          console.log(`   - [${r.module}] ${r.test}: ${r.message}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Phase 4 Module Testing Complete!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
