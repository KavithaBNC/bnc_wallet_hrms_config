# Phase 4 Testing Guide - Module by Module

This guide provides step-by-step instructions to test Phase 4 modules one by one, including frontend verification and seed data setup.

## Prerequisites

1. **Database Migration**: Ensure all Phase 4 migrations are applied
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma generate
   ```

2. **Backend Server**: Start the backend server
   ```bash
   cd backend
   npm run dev
   ```

3. **Frontend Server**: Start the frontend server
   ```bash
   cd frontend
   npm run dev
   ```

## Step 1: Seed Payroll Data

Before testing, seed the database with payroll test data:

```bash
cd backend
ts-node src/scripts/seed-payroll-data.ts
```

This will create:
- 2 Salary Structures (Standard and Executive)
- 2 Salary Templates (Junior and Senior)
- Bank accounts for employees
- Employee salary assignments

## Step 2: Run Automated Tests

Run the comprehensive test suite:

```bash
cd backend
ts-node src/scripts/test-phase4-modules.ts
```

This will test all modules automatically and provide a summary.

## Step 3: Manual Testing - Module by Module

### MODULE 1: Salary Structure Management

#### Backend API Testing

1. **Get Predefined Components**
   ```bash
   GET /api/v1/payroll/salary-components
   Authorization: Bearer <admin_token>
   ```
   - Should return earnings and deductions components

2. **Create Salary Structure**
   ```bash
   POST /api/v1/payroll/salary-structures
   Authorization: Bearer <admin_token>
   Body: {
     "organizationId": "...",
     "name": "Test Structure",
     "components": [...]
   }
   ```

3. **Get All Salary Structures**
   ```bash
   GET /api/v1/payroll/salary-structures?organizationId=...
   ```

4. **Get Salary Structure by ID**
   ```bash
   GET /api/v1/payroll/salary-structures/:id
   ```

#### Frontend Testing

1. Navigate to: `http://localhost:3000/salary-structures`
2. Login as ORG_ADMIN or HR_MANAGER
3. Verify:
   - ✅ Salary structures list displays
   - ✅ "Create Salary Structure" button visible
   - ✅ Can create new structure with components
   - ✅ Predefined components dropdown works
   - ✅ Can delete structures

### MODULE 1 (Part 2): Salary Templates & Employee Salary

#### Backend API Testing

1. **Create Salary Template**
   ```bash
   POST /api/v1/payroll/salary-templates
   Body: {
     "organizationId": "...",
     "salaryStructureId": "...",
     "name": "L1 Template",
     "grade": "L1",
     "level": "Entry",
     "ctc": 600000,
     ...
   }
   ```

2. **Get All Salary Templates**
   ```bash
   GET /api/v1/payroll/salary-templates?organizationId=...
   ```

3. **Create Employee Salary**
   ```bash
   POST /api/v1/payroll/employee-salaries
   Body: {
     "employeeId": "...",
     "salaryStructureId": "...",
     "effectiveDate": "2026-01-01",
     ...
   }
   ```

#### Frontend Testing

1. Navigate to: `http://localhost:3000/payroll`
2. Verify:
   - ✅ Can view employee salaries
   - ✅ Can assign salary to employees
   - ✅ Salary templates available for selection

### MODULE 2: Payroll Processing

#### Backend API Testing

1. **Create Payroll Cycle**
   ```bash
   POST /api/v1/payroll/payroll-cycles
   Body: {
     "organizationId": "...",
     "name": "January 2026 Payroll",
     "periodStart": "2026-01-01",
     "periodEnd": "2026-01-31",
     "paymentDate": "2026-02-05"
   }
   ```

2. **Process Payroll Cycle**
   ```bash
   POST /api/v1/payroll/payroll-cycles/:id/process
   Body: {
     "taxRegime": "NEW"
   }
   ```
   - Should generate payslips for all employees
   - Status should change: DRAFT → PROCESSING → PROCESSED

3. **Get Payroll Cycle Details**
   ```bash
   GET /api/v1/payroll/payroll-cycles/:id
   ```
   - Should show total employees, gross, deductions, net

#### Frontend Testing

1. Navigate to: `http://localhost:3000/payroll`
2. Verify:
   - ✅ Can create new payroll cycle
   - ✅ Payroll cycles list displays
   - ✅ Can process payroll cycle
   - ✅ Processing shows progress/status
   - ✅ Payslips generated after processing

### MODULE 3: Payroll Run Management

#### Backend API Testing

1. **Finalize Payroll Cycle**
   ```bash
   POST /api/v1/payroll/payroll-cycles/:id/finalize
   ```
   - Status: PROCESSED → FINALIZED
   - isLocked should become true

2. **Rollback Payroll Cycle**
   ```bash
   POST /api/v1/payroll/payroll-cycles/:id/rollback
   ```
   - Status: FINALIZED → PROCESSED
   - isLocked should become false

3. **Query by Month/Year**
   ```bash
   GET /api/v1/payroll/payroll-cycles?payrollMonth=1&payrollYear=2026
   ```

4. **Mark as Paid**
   ```bash
   POST /api/v1/payroll/payroll-cycles/:id/mark-paid
   ```
   - Status: FINALIZED → PAID

#### Frontend Testing

1. Navigate to: `http://localhost:3000/payroll`
2. Verify:
   - ✅ Can finalize payroll cycle
   - ✅ Finalized cycles show lock indicator
   - ✅ Can rollback finalized cycles
   - ✅ Month/Year filters work
   - ✅ Status transitions visible

### MODULE 3: Payslip Generation

#### Backend API Testing

1. **Get All Payslips**
   ```bash
   GET /api/v1/payroll/payslips?organizationId=...
   ```

2. **Get Comprehensive Payslip**
   ```bash
   GET /api/v1/payroll/payslips/:id/comprehensive
   ```
   - Should include:
     - Earnings breakdown
     - Deductions breakdown
     - YTD totals
     - Bank details

3. **Employee Self-Service - Get Own Payslips**
   ```bash
   GET /api/v1/payroll/payslips/employee/:employeeId
   Authorization: Bearer <employee_token>
   ```

4. **Download Payslip PDF**
   ```bash
   GET /api/v1/payroll/payslips/:id/download
   ```
   - Returns placeholder URL (PDF generation skipped)

#### Frontend Testing

1. **Admin/HR View**:
   - Navigate to: `http://localhost:3000/payroll`
   - Switch to "Payslips" view
   - Verify:
     - ✅ All payslips visible
     - ✅ Can view comprehensive payslip details
     - ✅ Earnings/deductions breakdown displays
     - ✅ YTD totals shown
     - ✅ Bank details visible

2. **Employee Self-Service**:
   - Login as EMPLOYEE
   - Navigate to: `http://localhost:3000/payroll`
   - Verify:
     - ✅ Only own payslips visible
     - ✅ Can view own payslip details
     - ✅ Can download own payslip (placeholder)
     - ✅ Cannot access other employees' payslips

## Test Scenarios

### Scenario 1: Complete Payroll Flow

1. Create salary structure
2. Create salary template
3. Assign salary to employees
4. Create payroll cycle
5. Process payroll
6. Review payslips
7. Finalize payroll
8. Mark as paid

### Scenario 2: Rollback Flow

1. Process payroll
2. Finalize payroll
3. Rollback payroll
4. Make corrections
5. Re-process
6. Finalize again

### Scenario 3: Employee Self-Service

1. Login as employee
2. View own payslips
3. Download payslip
4. Verify access control (cannot see others)

### Scenario 4: Month/Year Tracking

1. Create cycles for different months
2. Query by month/year
3. Verify unique constraint (one per month/year)

## Expected Results

### Module 1: Salary Structure Management
- ✅ Can create structures with multiple components
- ✅ Predefined components available
- ✅ Frontend displays structures correctly

### Module 1 (Part 2): Salary Templates & Employee Salary
- ✅ Can create templates linked to structures
- ✅ Can assign salaries to employees
- ✅ CTC breakdown calculated

### Module 2: Payroll Processing
- ✅ Payroll cycles created successfully
- ✅ Processing generates payslips
- ✅ Calculations correct (gross, deductions, net)
- ✅ Attendance and leave integrated

### Module 3: Payroll Run Management
- ✅ Status transitions work correctly
- ✅ Lock mechanism prevents modifications
- ✅ Rollback works as expected
- ✅ Month/Year tracking functional

### Module 3: Payslip Generation
- ✅ Payslips generated with all details
- ✅ Comprehensive endpoint returns breakdowns
- ✅ YTD totals calculated correctly
- ✅ Bank details included
- ✅ Employee self-service access controlled

## Troubleshooting

### Issue: "No organization found"
**Solution**: Create an organization first or update seed script to use existing organization

### Issue: "No employees found"
**Solution**: Create employees first or run employee seed script

### Issue: "Authentication failed"
**Solution**: Ensure users exist with default password "password123"

### Issue: "PDF generation error"
**Solution**: PDF generation is skipped (placeholder mode). This is expected.

### Issue: "Frontend not loading"
**Solution**: 
- Check if frontend server is running
- Verify API base URL in frontend config
- Check browser console for errors

## Next Steps

After successful testing:

1. **Review Test Results**: Check automated test output
2. **Fix Issues**: Address any failed tests
3. **Frontend Enhancements**: Add missing UI features if needed
4. **Documentation**: Update user guides with findings
5. **Production Readiness**: Review security and performance

## Notes

- PDF generation is currently in placeholder mode
- All tests use test data (seed script)
- Employee self-service access is enforced via middleware
- Month/Year tracking prevents duplicate cycles
