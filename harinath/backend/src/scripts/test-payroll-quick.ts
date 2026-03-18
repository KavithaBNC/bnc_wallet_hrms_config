import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/v1';

async function testPayrollEndpoints() {
  console.log('🧪 Quick Payroll Module Test\n');
  console.log('='.repeat(50));

  // Test 1: Check if server is running
  console.log('\n1️⃣ Testing server connection...');
  try {
    const healthCheck = await axios.get(`${API_BASE.replace('/api/v1', '')}/health`);
    if (healthCheck.status === 200) {
      console.log('✅ Server is running');
    }
  } catch (error: any) {
    console.log('❌ Server is not running. Please start the server with: npm run dev');
    console.log('   Error:', error.message);
    return;
  }

  // Test 2: Check if payroll routes are registered
  console.log('\n2️⃣ Testing payroll routes registration...');
  try {
    // Try to access payroll endpoint (will fail auth but confirms route exists)
    const testRoute = await axios.get(`${API_BASE}/payroll/payroll-cycles`, {
      validateStatus: () => true, // Don't throw on 401
    });
    
    if (testRoute.status === 401) {
      console.log('✅ Payroll routes are registered (got 401 - authentication required, which is expected)');
    } else if (testRoute.status === 200) {
      console.log('✅ Payroll routes are registered and accessible');
    } else {
      console.log(`⚠️  Unexpected status: ${testRoute.status}`);
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Cannot connect to server. Is it running?');
    } else {
      console.log('⚠️  Route test error:', error.message);
    }
  }

  // Test 3: Verify TypeScript compilation
  console.log('\n3️⃣ Verifying TypeScript compilation...');
  try {
    // Import a controller to verify it compiles
    const { salaryStructureController } = await import('../controllers/salary-structure.controller');
    const { payrollController } = await import('../controllers/payroll.controller');
    const { payslipController } = await import('../controllers/payslip.controller');
    const { employeeSalaryController } = await import('../controllers/employee-salary.controller');
    
    if (salaryStructureController && payrollController && payslipController && employeeSalaryController) {
      console.log('✅ All controllers compile successfully');
    }
  } catch (error: any) {
    console.log('❌ TypeScript compilation error:', error.message);
  }

  // Test 4: Verify services
  console.log('\n4️⃣ Verifying services...');
  try {
    const { salaryStructureService } = await import('../services/salary-structure.service');
    const { payrollService } = await import('../services/payroll.service');
    const { payslipService } = await import('../services/payslip.service');
    const { employeeSalaryService } = await import('../services/employee-salary.service');
    
    if (salaryStructureService && payrollService && payslipService && employeeSalaryService) {
      console.log('✅ All services compile successfully');
    }
  } catch (error: any) {
    console.log('❌ Service import error:', error.message);
  }

  // Test 5: Verify validation schemas
  console.log('\n5️⃣ Verifying validation schemas...');
  try {
    const schemas = await import('../utils/payroll.validation');
    const requiredSchemas = [
      'createSalaryStructureSchema',
      'createPayrollCycleSchema',
      'queryPayslipsSchema',
      'createEmployeeSalarySchema',
    ];
    
    let allFound = true;
    for (const schemaName of requiredSchemas) {
      if (!(schemaName in schemas)) {
        console.log(`❌ Missing schema: ${schemaName}`);
        allFound = false;
      }
    }
    
    if (allFound) {
      console.log('✅ All validation schemas are available');
    }
  } catch (error: any) {
    console.log('❌ Schema import error:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Quick test complete!');
  console.log('\nTo run full integration tests:');
  console.log('  1. Start server: npm run dev');
  console.log('  2. Run: npm run test:payroll <email> <password>');
  console.log('='.repeat(50));
}

testPayrollEndpoints().catch(console.error);
