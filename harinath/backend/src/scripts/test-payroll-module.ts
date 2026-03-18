import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

interface TestResult {
  module: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  data?: any;
}

const results: TestResult[] = [];
let adminToken: string = '';
let organizationId: string = '';
let employeeId: string = '';
let salaryStructureId: string = '';
let payrollCycleId: string = '';
let payslipId: string = '';

// Helper function to make API calls
async function apiCall(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  try {
    const config: any = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (data) config.data = data;
    const response = await axios(config);
    return { status: response.status, data: response.data };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    throw error;
  }
}

function logResult(module: string, test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, data?: any) {
  results.push({ module, test, status, message, data });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} [${module}] ${test}: ${message}`);
  if (data && status === 'FAIL') {
    console.log(`   Error details:`, JSON.stringify(data, null, 2));
  }
}

async function loginAsAdmin(email: string, password: string): Promise<boolean> {
  console.log('\n🔐 Logging in as admin...\n');
  
  const response = await apiCall('POST', '/auth/login', { email, password });
  
  if (response.status === 200 && response.data?.data?.tokens?.accessToken) {
    adminToken = response.data.data.tokens.accessToken;
    organizationId = response.data.data.user?.employee?.organizationId || '';
    employeeId = response.data.data.user?.employee?.id || '';
    logResult('AUTH', 'Admin Login', 'PASS', `Logged in as ${email}`);
    return true;
  } else {
    logResult('AUTH', 'Admin Login', 'FAIL', `Failed to login: ${JSON.stringify(response.data)}`);
    return false;
  }
}

async function testSalaryStructures() {
  console.log('\n📊 Testing Salary Structures...\n');

  // Create Salary Structure
  const createData = {
    organizationId,
    name: 'Standard Salary Structure',
    description: 'Standard salary structure for employees',
    components: [
      {
        name: 'Basic Salary',
        type: 'EARNING',
        calculationType: 'FIXED',
        value: 50000,
        isTaxable: true,
        isStatutory: false,
      },
      {
        name: 'HRA',
        type: 'EARNING',
        calculationType: 'PERCENTAGE',
        value: 40,
        isTaxable: true,
        isStatutory: false,
      },
      {
        name: 'Provident Fund',
        type: 'DEDUCTION',
        calculationType: 'PERCENTAGE',
        value: 12,
        isTaxable: false,
        isStatutory: true,
      },
    ],
    isActive: true,
  };

  const createResponse = await apiCall('POST', '/payroll/salary-structures', createData, adminToken);
  if (createResponse.status === 201 && createResponse.data?.data?.id) {
    salaryStructureId = createResponse.data.data.id;
    logResult('SALARY_STRUCTURE', 'Create', 'PASS', 'Salary structure created successfully');
  } else {
    logResult('SALARY_STRUCTURE', 'Create', 'FAIL', `Failed to create: ${JSON.stringify(createResponse.data)}`);
    return;
  }

  // Get All Salary Structures
  const getAllResponse = await apiCall('GET', `/payroll/salary-structures?organizationId=${organizationId}`, undefined, adminToken);
  if (getAllResponse.status === 200 && Array.isArray(getAllResponse.data?.data)) {
    logResult('SALARY_STRUCTURE', 'Get All', 'PASS', `Found ${getAllResponse.data.data.length} salary structures`);
  } else {
    logResult('SALARY_STRUCTURE', 'Get All', 'FAIL', `Failed to get all: ${JSON.stringify(getAllResponse.data)}`);
  }

  // Get Salary Structure by ID
  const getByIdResponse = await apiCall('GET', `/payroll/salary-structures/${salaryStructureId}`, undefined, adminToken);
  if (getByIdResponse.status === 200 && getByIdResponse.data?.data?.id) {
    logResult('SALARY_STRUCTURE', 'Get By ID', 'PASS', 'Salary structure retrieved successfully');
  } else {
    logResult('SALARY_STRUCTURE', 'Get By ID', 'FAIL', `Failed to get by ID: ${JSON.stringify(getByIdResponse.data)}`);
  }
}

async function testPayrollCycles() {
  console.log('\n📅 Testing Payroll Cycles...\n');

  // Create Payroll Cycle
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const paymentDate = new Date(today.getFullYear(), today.getMonth() + 1, 5);

  const createData = {
    organizationId,
    name: `Payroll ${firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    periodStart: firstDay.toISOString().split('T')[0],
    periodEnd: lastDay.toISOString().split('T')[0],
    paymentDate: paymentDate.toISOString().split('T')[0],
    notes: 'Monthly payroll cycle',
  };

  const createResponse = await apiCall('POST', '/payroll/payroll-cycles', createData, adminToken);
  if (createResponse.status === 201 && createResponse.data?.data?.id) {
    payrollCycleId = createResponse.data.data.id;
    logResult('PAYROLL_CYCLE', 'Create', 'PASS', 'Payroll cycle created successfully');
  } else {
    logResult('PAYROLL_CYCLE', 'Create', 'FAIL', `Failed to create: ${JSON.stringify(createResponse.data)}`);
    return;
  }

  // Get All Payroll Cycles
  const getAllResponse = await apiCall('GET', `/payroll/payroll-cycles?organizationId=${organizationId}`, undefined, adminToken);
  if (getAllResponse.status === 200 && Array.isArray(getAllResponse.data?.data)) {
    logResult('PAYROLL_CYCLE', 'Get All', 'PASS', `Found ${getAllResponse.data.data.length} payroll cycles`);
  } else {
    logResult('PAYROLL_CYCLE', 'Get All', 'FAIL', `Failed to get all: ${JSON.stringify(getAllResponse.data)}`);
  }

  // Get Payroll Cycle by ID
  const getByIdResponse = await apiCall('GET', `/payroll/payroll-cycles/${payrollCycleId}`, undefined, adminToken);
  if (getByIdResponse.status === 200 && getByIdResponse.data?.data?.id) {
    logResult('PAYROLL_CYCLE', 'Get By ID', 'PASS', 'Payroll cycle retrieved successfully');
  } else {
    logResult('PAYROLL_CYCLE', 'Get By ID', 'FAIL', `Failed to get by ID: ${JSON.stringify(getByIdResponse.data)}`);
  }
}

async function testPayslips() {
  console.log('\n💰 Testing Payslips...\n');

  // Get All Payslips
  const getAllResponse = await apiCall('GET', `/payroll/payslips?organizationId=${organizationId}`, undefined, adminToken);
  if (getAllResponse.status === 200 && Array.isArray(getAllResponse.data?.data)) {
    logResult('PAYSLIP', 'Get All', 'PASS', `Found ${getAllResponse.data.data.length} payslips`);
    if (getAllResponse.data.data.length > 0) {
      payslipId = getAllResponse.data.data[0].id;
    }
  } else {
    logResult('PAYSLIP', 'Get All', 'FAIL', `Failed to get all: ${JSON.stringify(getAllResponse.data)}`);
  }

  // Get Payslips by Employee ID (if we have an employee)
  if (employeeId) {
    const getByEmployeeResponse = await apiCall('GET', `/payroll/payslips/employee/${employeeId}`, undefined, adminToken);
    if (getByEmployeeResponse.status === 200 && Array.isArray(getByEmployeeResponse.data?.data)) {
      logResult('PAYSLIP', 'Get By Employee', 'PASS', `Found ${getByEmployeeResponse.data.data.length} payslips for employee`);
    } else {
      logResult('PAYSLIP', 'Get By Employee', 'FAIL', `Failed to get by employee: ${JSON.stringify(getByEmployeeResponse.data)}`);
    }
  }

  // Get Payslip by ID (if we have one)
  if (payslipId) {
    const getByIdResponse = await apiCall('GET', `/payroll/payslips/${payslipId}`, undefined, adminToken);
    if (getByIdResponse.status === 200 && getByIdResponse.data?.data?.id) {
      logResult('PAYSLIP', 'Get By ID', 'PASS', 'Payslip retrieved successfully');
    } else {
      logResult('PAYSLIP', 'Get By ID', 'FAIL', `Failed to get by ID: ${JSON.stringify(getByIdResponse.data)}`);
    }
  } else {
    logResult('PAYSLIP', 'Get By ID', 'SKIP', 'No payslips available to test');
  }
}

async function testPayrollProcessing() {
  console.log('\n⚙️ Testing Payroll Processing...\n');

  if (!payrollCycleId) {
    logResult('PAYROLL_PROCESSING', 'Process Cycle', 'SKIP', 'No payroll cycle available to process');
    return;
  }

  // Process Payroll Cycle
  const processResponse = await apiCall('POST', `/payroll/payroll-cycles/${payrollCycleId}/process`, { recalculate: false }, adminToken);
  if (processResponse.status === 200) {
    logResult('PAYROLL_PROCESSING', 'Process Cycle', 'PASS', `Payroll processed: ${processResponse.data?.payslipsCount || 0} payslips generated`);
  } else {
    logResult('PAYROLL_PROCESSING', 'Process Cycle', 'FAIL', `Failed to process: ${JSON.stringify(processResponse.data)}`);
  }
}

async function runTests() {
  console.log('🧪 PAYROLL MODULE TEST SUITE');
  console.log('='.repeat(50));

  // Get credentials from command line arguments
  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3] || 'Admin@123';

  // Login
  const loggedIn = await loginAsAdmin(email, password);
  if (!loggedIn) {
    console.log('\n❌ Cannot proceed without authentication');
    return;
  }

  if (!organizationId) {
    console.log('\n⚠️  Warning: No organization ID found. Some tests may fail.');
  }

  // Run tests
  await testSalaryStructures();
  await testPayrollCycles();
  await testPayslips();
  await testPayrollProcessing();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`Success Rate: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`  - [${r.module}] ${r.test}: ${r.message}`);
      });
  }

  console.log('\n' + '='.repeat(50));
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
