# Phase 4: Next Steps After Creating Salary Structure

## ✅ You've Completed: Salary Structure Created

Great! Now follow these steps to test the complete payroll flow.

---

## 🎯 Step 1: Seed Test Data (Recommended)

First, seed the database with test data to make testing easier:

```bash
cd backend
npm run seed:payroll
```

**This creates:**
- ✅ 2 Salary Structures (Standard, Executive)
- ✅ 2 Salary Templates (Junior L1, Senior L3)
- ✅ Bank accounts for 3 employees
- ✅ Employee salaries assigned to 3 employees

**After seeding, you can skip to Step 3!**

---

## 💰 Step 2: Assign Salary to Employees (If Not Using Seed)

### Option A: Use Seed Data (Easiest)
Run the seed script - it automatically assigns salaries to employees.

### Option B: Assign Manually via API

1. **Get Employee ID:**
   - Go to: `http://localhost:3000/employees`
   - Click on an employee
   - Note the employee ID from the URL or details

2. **Get Your Salary Structure ID:**
   - Go to: `http://localhost:3000/salary-structures`
   - Note the ID of the structure you created

3. **Assign Salary (Using Postman/Thunder Client):**
   ```http
   POST http://localhost:5000/api/v1/payroll/employee-salaries
   Authorization: Bearer <your_token>
   Content-Type: application/json
   
   {
     "employeeId": "<employee_id_from_step_1>",
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

---

## 📅 Step 3: Create Payroll Cycle

1. **Navigate to Payroll Page:**
   - Go to: `http://localhost:3000/payroll`
   - Or click "Payroll" from Dashboard

2. **Create Payroll Cycle:**
   - Click **"+ Create Payroll Cycle"** button
   - Fill in the form:
     ```
     Name: January 2026 Payroll
     Period Start: 2026-01-01
     Period End: 2026-01-31
     Payment Date: 2026-02-05
     Notes: (optional)
     ```
   - Click **"Create"**

3. **Verify:**
   - ✅ Cycle appears in the list
   - ✅ Status shows "DRAFT"
   - ✅ Period dates are correct

---

## ⚙️ Step 4: Process Payroll

1. **Find Your Cycle:**
   - In the payroll cycles table, find "January 2026 Payroll"

2. **Process:**
   - Click **"Process"** button on that cycle
   - Confirm when asked
   - Wait for processing (may take a few seconds)

3. **Verify Results:**
   - ✅ Status changes to "PROCESSED"
   - ✅ Shows "Total Employees" count
   - ✅ Shows "Total Gross", "Total Deductions", "Total Net"
   - ✅ Payslips are generated

**Expected Output:**
- If you have 3 employees with salaries, you should see:
  - Total Employees: 3
  - Total Gross: (sum of all gross salaries)
  - Total Net: (sum of all net salaries)

---

## 📄 Step 5: View Payslips

1. **Switch to Payslips View:**
   - In Payroll page, click **"💰 Payslips"** tab/button
   - Or switch view mode to "Payslips"

2. **View Payslip:**
   - Click on any payslip in the list
   - You should see:
     - ✅ Employee information
     - ✅ Period dates
     - ✅ Earnings breakdown
     - ✅ Deductions breakdown
     - ✅ Gross salary
     - ✅ Net salary
     - ✅ YTD totals (if calculated)

---

## 🔒 Step 6: Test Finalize & Rollback

### Test Finalize (via API for now):

1. **Get Payroll Cycle ID:**
   - From the cycles list, note the cycle ID

2. **Finalize:**
   ```http
   POST http://localhost:5000/api/v1/payroll/payroll-cycles/<cycle_id>/finalize
   Authorization: Bearer <your_token>
   ```

3. **Verify:**
   - ✅ Status changes to "FINALIZED"
   - ✅ Cycle is locked (cannot edit/delete)

### Test Rollback:

```http
POST http://localhost:5000/api/v1/payroll/payroll-cycles/<cycle_id>/rollback
Authorization: Bearer <your_token>
```

- ✅ Status returns to "PROCESSED"
- ✅ Can edit again

---

## 👤 Step 7: Test Employee Self-Service

1. **Logout:**
   - Click logout from ORG_ADMIN account

2. **Login as Employee:**
   - Email: (any employee email)
   - Password: `password123`

3. **Access Payslips:**
   - Navigate to: `http://localhost:3000/payroll`
   - Verify:
     - ✅ Only your own payslips visible
     - ✅ Can click to view details
     - ✅ Cannot see other employees' payslips

---

## 🧪 Step 8: Run Automated Tests

After manual testing, verify everything with automated tests:

```bash
cd backend
npm run test:phase4
```

This will test all modules and show pass/fail results.

---

## 📋 Quick Checklist

After creating salary structure, test:

- [ ] **Step 1**: Seed data (or assign salaries manually)
- [ ] **Step 2**: Create payroll cycle
- [ ] **Step 3**: Process payroll
- [ ] **Step 4**: View payslips
- [ ] **Step 5**: Test finalize/rollback
- [ ] **Step 6**: Test employee self-service
- [ ] **Step 7**: Run automated tests

---

## 🚀 Quick Commands

```bash
# 1. Seed data
cd backend
npm run seed:payroll

# 2. Run automated tests
cd backend
npm run test:phase4

# 3. Start frontend (if not running)
cd frontend
npm run dev
```

---

## 💡 What to Test Next

### Immediate Next Steps:
1. ✅ **Create Payroll Cycle** - Test the form works
2. ✅ **Process Payroll** - Verify payslips are generated
3. ✅ **View Payslips** - Check all details display correctly

### Advanced Testing:
4. ✅ **Finalize/Rollback** - Test status transitions
5. ✅ **Employee Access** - Verify self-service works
6. ✅ **Calculations** - Verify gross, deductions, net are correct

---

## ❓ Troubleshooting

### "No employees with salary" when processing
**Solution:** Run seed script or assign salary to at least one employee first.

### "Processing failed"
**Solution:** 
- Check backend console for errors
- Ensure employees have active salary assignments
- Verify attendance/leave data exists for the period

### "Payslips not showing"
**Solution:**
- Ensure payroll was processed successfully
- Check status is "PROCESSED"
- Refresh the page

---

## ✅ Success Indicators

You're on the right track when:
- ✅ Payroll cycle created successfully
- ✅ Processing completes without errors
- ✅ Payslips appear in the list
- ✅ Payslip details show all information
- ✅ Calculations are correct

---

## 🎯 Recommended Testing Order

1. **Seed Data** → Creates everything automatically
2. **Create Cycle** → Test the form
3. **Process** → See payslips generated
4. **View Payslips** → Verify details
5. **Test Employee** → Verify access control
6. **Run Tests** → Automated verification

---

**Next Action:** Run `npm run seed:payroll` then create and process a payroll cycle!
