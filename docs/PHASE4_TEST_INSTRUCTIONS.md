# Phase 4 Testing Instructions

## Quick Start

### Step 1: Seed Payroll Data

```bash
cd backend
npm run seed:payroll
```

**Expected Output:**
```
🌱 Seeding Payroll Data...

✅ Using organization: [Organization Name]
✅ Found X employees

📊 Creating Salary Structures...
✅ Created Salary Structure: Standard Salary Structure
✅ Created Salary Structure: Executive Salary Structure

📋 Creating Salary Templates...
✅ Created Salary Template: Junior Level Template
✅ Created Salary Template: Senior Level Template

🏦 Creating Employee Bank Accounts...
✅ Created bank account for [Employee Name]

💰 Assigning Salaries to Employees...
✅ Assigned salary to [Employee Name] (Junior Level Template)

✅ Payroll seed data created successfully!

📊 Summary:
   - Salary Structures: 2
   - Salary Templates: 2
   - Bank Accounts: 3
   - Employee Salaries: 3
```

### Step 2: Run Automated Tests

```bash
cd backend
npm run test:phase4
```

This will test all Phase 4 modules automatically.

### Step 3: Manual Frontend Testing

1. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Login as Admin:**
   - Email: (any ORG_ADMIN or HR_MANAGER user)
   - Password: `password123`

3. **Test Each Module:**

## Module-by-Module Testing

### ✅ MODULE 1: Salary Structure Management

**Frontend URL:** `http://localhost:3000/salary-structures`

**Test Steps:**
1. Navigate to Salary Structures page
2. Verify list displays existing structures
3. Click "Create Salary Structure"
4. Fill in:
   - Name: "Test Structure"
   - Description: "Test description"
5. Add components:
   - Click "Add Component"
   - Select "Basic Salary" from predefined
   - Set value: 50000
   - Mark as taxable
6. Add more components (HRA, PF, etc.)
7. Click "Create"
8. Verify structure appears in list
9. Test delete functionality

**Expected Results:**
- ✅ Structures list displays
- ✅ Create form works
- ✅ Components can be added/removed
- ✅ Structure saved successfully
- ✅ Delete works

### ✅ MODULE 1 (Part 2): Salary Templates & Employee Salary

**Frontend URL:** `http://localhost:3000/payroll`

**Test Steps:**
1. Navigate to Payroll page
2. Check if salary templates are visible (if UI exists)
3. Verify employee salary assignments
4. Test assigning salary to employee (if UI exists)

**Note:** Frontend UI for templates may need to be implemented.

### ✅ MODULE 2: Payroll Processing

**Frontend URL:** `http://localhost:3000/payroll`

**Test Steps:**
1. Navigate to Payroll page
2. Click "Create Payroll Cycle"
3. Fill in form:
   - Name: "January 2026 Payroll"
   - Period Start: 2026-01-01
   - Period End: 2026-01-31
   - Payment Date: 2026-02-05
4. Click "Create"
5. Verify cycle appears in list with status "DRAFT"
6. Click "Process" button on the cycle
7. Confirm processing
8. Wait for processing to complete
9. Verify status changes to "PROCESSED"
10. Switch to "Payslips" view
11. Verify payslips are generated

**Expected Results:**
- ✅ Cycle created successfully
- ✅ Processing works
- ✅ Status updates correctly
- ✅ Payslips generated
- ✅ Totals calculated

### ✅ MODULE 3: Payroll Run Management

**Frontend URL:** `http://localhost:3000/payroll`

**Test Steps:**
1. After processing, find the payroll cycle
2. Click "Finalize" button (if available)
3. Verify status changes to "FINALIZED"
4. Verify cycle is locked (cannot edit)
5. Click "Rollback" button (if available)
6. Verify status returns to "PROCESSED"
7. Test month/year filters (if available)

**Note:** Frontend buttons for finalize/rollback may need to be added to PayrollPage.

### ✅ MODULE 3: Payslip Generation

**Frontend URL:** `http://localhost:3000/payroll`

**Test Steps:**
1. Switch to "Payslips" view
2. Click on a payslip to view details
3. Verify:
   - Earnings breakdown displays
   - Deductions breakdown displays
   - YTD totals shown
   - Bank details visible (if available)
4. Click "Download" button
5. Verify download works (placeholder mode)

**Employee Self-Service:**
1. Logout
2. Login as EMPLOYEE
3. Navigate to `/payroll`
4. Verify only own payslips visible
5. Click on own payslip
6. Verify can view details
7. Try to access another employee's payslip (should fail)

**Expected Results:**
- ✅ Payslips list displays
- ✅ Comprehensive details show
- ✅ Breakdowns formatted correctly
- ✅ YTD totals accurate
- ✅ Employee can only see own payslips
- ✅ Access control enforced

## API Testing (Using Postman/Thunder Client)

### Module 1: Salary Structure

```http
# Get Predefined Components
GET http://localhost:5000/api/v1/payroll/salary-components
Authorization: Bearer <admin_token>

# Create Salary Structure
POST http://localhost:5000/api/v1/payroll/salary-structures
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "organizationId": "...",
  "name": "Test Structure",
  "components": [...]
}
```

### Module 2: Payroll Processing

```http
# Create Payroll Cycle
POST http://localhost:5000/api/v1/payroll/payroll-cycles
Authorization: Bearer <admin_token>

# Process Payroll
POST http://localhost:5000/api/v1/payroll/payroll-cycles/:id/process
Authorization: Bearer <admin_token>
Body: { "taxRegime": "NEW" }
```

### Module 3: Run Management

```http
# Finalize
POST http://localhost:5000/api/v1/payroll/payroll-cycles/:id/finalize

# Rollback
POST http://localhost:5000/api/v1/payroll/payroll-cycles/:id/rollback
```

### Module 3: Payslip

```http
# Get Comprehensive Payslip
GET http://localhost:5000/api/v1/payroll/payslips/:id/comprehensive

# Download PDF
GET http://localhost:5000/api/v1/payroll/payslips/:id/download
```

## Verification Checklist

### Backend
- [ ] All API endpoints respond correctly
- [ ] Status transitions work
- [ ] Calculations are accurate
- [ ] Access control enforced
- [ ] YTD totals calculated correctly

### Frontend
- [ ] Pages load without errors
- [ ] Data displays correctly
- [ ] Forms work properly
- [ ] Buttons functional
- [ ] Employee self-service works
- [ ] Access control visible

### Integration
- [ ] Payroll processing generates payslips
- [ ] Payslips include all required data
- [ ] Status updates reflect in UI
- [ ] Employee can access own payslips only

## Troubleshooting

### Seed Script Issues
- **"No organization found"**: Create organization first or ensure one exists
- **"No employees found"**: Create employees first
- **"Prisma errors"**: Run `npx prisma generate` and `npx prisma migrate dev`

### API Issues
- **401 Unauthorized**: Check token is valid
- **403 Forbidden**: Verify user role has permissions
- **404 Not Found**: Check IDs are correct

### Frontend Issues
- **Blank page**: Check browser console for errors
- **API errors**: Verify backend is running and API base URL is correct
- **No data**: Verify seed script ran successfully

## Success Criteria

✅ All seed data created successfully
✅ Automated tests pass
✅ Frontend pages load correctly
✅ All CRUD operations work
✅ Employee self-service functional
✅ Access control enforced
✅ Calculations accurate
✅ Status transitions work

## Next Steps

After successful testing:
1. Fix any issues found
2. Add missing frontend features (finalize/rollback buttons)
3. Enhance UI/UX
4. Implement actual PDF generation
5. Performance optimization
6. Documentation updates
