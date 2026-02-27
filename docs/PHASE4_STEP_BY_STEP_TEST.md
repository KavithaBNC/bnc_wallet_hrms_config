# Phase 4 Step-by-Step Testing Guide

## ✅ Step 1: Create Salary Structure (DONE)

You've already created a salary structure. Great!

**Verify:**
- ✅ Salary structure appears in the list
- ✅ Components are configured correctly

---

## 📋 Step 2: Seed Data (If Not Done)

Before proceeding, ensure you have test data:

```bash
cd backend
npm run seed:payroll
```

This creates:
- 2 Salary Structures (Standard, Executive)
- 2 Salary Templates (Junior L1, Senior L3)
- Bank accounts for employees
- Employee salary assignments

---

## 🎯 Step 3: Assign Salary to Employees

### Option A: Via API (Recommended for Testing)

1. **Get Employee IDs:**
   - Go to `/employees` page
   - Note down employee IDs you want to assign salary to

2. **Get Your Salary Structure ID:**
   - From `/salary-structures` page
   - Note the ID of the structure you created

3. **Create Employee Salary via API:**
   ```bash
   # Using Postman or Thunder Client
   POST http://localhost:5000/api/v1/payroll/employee-salaries
   Authorization: Bearer <your_token>
   Content-Type: application/json
   
   {
     "employeeId": "<employee_id>",
     "salaryStructureId": "<your_structure_id>",
     "effectiveDate": "2026-01-01",
     "basicSalary": 50000,
     "grossSalary": 75000,
     "netSalary": 65000,
     "components": {
       "basic": 50000,
       "hra": 20000,
       "pf": 6000
     },
     "currency": "INR",
     "paymentFrequency": "MONTHLY",
     "isActive": true
   }
   ```

### Option B: Check if Seed Data Created Salaries

After running seed script, check if employees already have salaries assigned.

---

## 💰 Step 4: Create Payroll Cycle

1. **Navigate to Payroll Page:**
   - Go to: `http://localhost:3000/payroll`
   - Or click "Payroll" module from Dashboard

2. **Create New Cycle:**
   - Click "Create Payroll Cycle" button
   - Fill in:
     - **Name**: "January 2026 Payroll"
     - **Period Start**: `2026-01-01`
     - **Period End**: `2026-01-31`
     - **Payment Date**: `2026-02-05`
     - **Notes**: (optional)
   - Click "Create"

3. **Verify:**
   - ✅ Cycle appears in list
   - ✅ Status is "DRAFT"

---

## ⚙️ Step 5: Process Payroll

1. **Find the Cycle:**
   - In the payroll cycles list, find the cycle you just created

2. **Process:**
   - Click "Process" button
   - Confirm the action
   - Wait for processing to complete

3. **Verify:**
   - ✅ Status changes to "PROCESSED"
   - ✅ Total employees, gross, deductions, net are shown
   - ✅ Payslips are generated

---

## 📄 Step 6: View Payslips

1. **Switch to Payslips View:**
   - In Payroll page, click "Payslips" tab/button
   - Or switch view mode to "Payslips"

2. **View Payslip Details:**
   - Click on a payslip
   - Verify:
     - ✅ Employee information
     - ✅ Earnings breakdown
     - ✅ Deductions breakdown
     - ✅ Gross, Net salary
     - ✅ YTD totals (if available)
     - ✅ Bank details (if available)

---

## 🔒 Step 7: Test Payroll Run Management

1. **Finalize Payroll:**
   - Find the processed payroll cycle
   - Click "Finalize" button (if available in UI)
   - Or use API:
     ```bash
     POST http://localhost:5000/api/v1/payroll/payroll-cycles/:id/finalize
     ```
   - Verify status changes to "FINALIZED"

2. **Test Lock Mechanism:**
   - Try to edit the finalized cycle (should fail)
   - Try to delete the finalized cycle (should fail)

3. **Rollback (Optional):**
   - Click "Rollback" button (if available)
   - Or use API:
     ```bash
     POST http://localhost:5000/api/v1/payroll/payroll-cycles/:id/rollback
     ```
   - Verify status returns to "PROCESSED"

4. **Mark as Paid:**
   - After finalizing, mark as paid:
     ```bash
     POST http://localhost:5000/api/v1/payroll/payroll-cycles/:id/mark-paid
     ```
   - Verify status changes to "PAID"

---

## 👤 Step 8: Test Employee Self-Service

1. **Logout:**
   - Logout from ORG_ADMIN account

2. **Login as Employee:**
   - Login with EMPLOYEE role credentials
   - Password: `password123`

3. **Access Payslips:**
   - Navigate to: `http://localhost:3000/payroll`
   - Verify:
     - ✅ Only own payslips visible
     - ✅ Can view own payslip details
     - ✅ Can download own payslip (placeholder)

4. **Test Access Control:**
   - Try to access another employee's payslip (should fail)
   - Try to access payroll cycles (should not see them or see limited view)

---

## 🧪 Step 9: Run Automated Tests

After manual testing, run automated tests:

```bash
cd backend
npm run test:phase4
```

This will test all modules automatically and provide a summary.

---

## 📊 Complete Testing Checklist

### Module 1: Salary Structure ✅
- [x] Create salary structure (DONE)
- [ ] View salary structures list
- [ ] Edit salary structure
- [ ] Delete salary structure
- [ ] Verify predefined components work

### Module 1 (Part 2): Salary Templates & Employee Salary
- [ ] Check if salary templates exist (from seed)
- [ ] Assign salary to employee
- [ ] View employee salary
- [ ] Verify bank account linked

### Module 2: Payroll Processing
- [ ] Create payroll cycle
- [ ] Process payroll cycle
- [ ] Verify payslips generated
- [ ] Check calculations (gross, deductions, net)
- [ ] Verify attendance/leave integration

### Module 3: Payroll Run Management
- [ ] Finalize payroll cycle
- [ ] Verify lock mechanism
- [ ] Rollback payroll cycle
- [ ] Mark as paid
- [ ] Query by month/year

### Module 3: Payslip Generation
- [ ] View payslips list
- [ ] View comprehensive payslip
- [ ] Verify earnings breakdown
- [ ] Verify deductions breakdown
- [ ] Verify YTD totals
- [ ] Verify bank details
- [ ] Test PDF download (placeholder)

### Employee Self-Service
- [ ] Employee can login
- [ ] Employee sees own payslips only
- [ ] Employee can view own payslip
- [ ] Employee cannot access others' payslips
- [ ] Access control enforced

---

## 🚀 Quick Test Commands

### Check Seed Data
```bash
cd backend
npm run seed:payroll
```

### Run Automated Tests
```bash
cd backend
npm run test:phase4
```

### Check Backend Logs
- Watch backend console for errors
- Check for API response codes

### Check Frontend Console
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab for API calls

---

## 🎯 Next Steps After Creating Salary Structure

1. **Assign Salary to Employees** (Step 3)
2. **Create Payroll Cycle** (Step 4)
3. **Process Payroll** (Step 5)
4. **View Payslips** (Step 6)
5. **Test Finalize/Rollback** (Step 7)
6. **Test Employee Access** (Step 8)

---

## 💡 Tips

- **Use Browser DevTools**: Check Network tab to see API calls
- **Check Backend Logs**: Watch for errors during processing
- **Start with Seed Data**: Makes testing easier
- **Test One Module at a Time**: Don't rush through all modules
- **Verify Calculations**: Check if gross, deductions, net are correct

---

## ❓ Common Questions

**Q: How do I assign salary to an employee?**
A: Use the API endpoint or check if seed data already assigned salaries.

**Q: Why can't I process payroll?**
A: Ensure employees have salary assignments and the cycle is in DRAFT status.

**Q: Where do I see payslips?**
A: In Payroll page, switch to "Payslips" view mode.

**Q: How do I test employee self-service?**
A: Logout, login as EMPLOYEE, navigate to `/payroll`, verify only own payslips visible.

---

## ✅ Success Indicators

You've successfully tested Phase 4 when:
- ✅ Salary structures created and managed
- ✅ Employees have salaries assigned
- ✅ Payroll cycles created and processed
- ✅ Payslips generated with correct calculations
- ✅ Finalize/rollback works
- ✅ Employee can access own payslips only
- ✅ All automated tests pass
