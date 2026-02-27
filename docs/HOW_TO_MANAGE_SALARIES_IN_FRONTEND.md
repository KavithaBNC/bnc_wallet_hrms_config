# How to Manage Salaries in Frontend (Without Seed Scripts)

## 📍 Where to Enter and See Salary Information

### ✅ Available in Frontend:

#### 1. **Salary Structures Page** (`/salary-structures`)
**Access:** Dashboard → Click "Salary Structures" module card  
**URL:** `http://localhost:3000/salary-structures`  
**Who can access:** ORG_ADMIN, HR_MANAGER

**What you can do:**
- ✅ View all salary structures
- ✅ Create new salary structures
- ✅ Add salary components (Basic, HRA, PF, ESI, etc.)
- ✅ Edit salary structures
- ✅ Delete salary structures

**Steps:**
1. Login as ORG_ADMIN or HR_MANAGER
2. Go to Dashboard
3. Click "Salary Structures" card
4. Click "+ Create Salary Structure"
5. Fill in:
   - Name: "Standard Salary Structure"
   - Description: (optional)
   - Add Components:
     - Basic Salary (EARNING, FIXED, ₹50,000)
     - HRA (EARNING, PERCENTAGE, 40% of Basic)
     - Transport (EARNING, FIXED, ₹5,000)
     - PF (DEDUCTION, PERCENTAGE, 12% of Basic)
     - ESI (DEDUCTION, PERCENTAGE, 1.75% of Gross)
6. Click "Create"

---

#### 2. **Payroll Page** (`/payroll`)
**Access:** Dashboard → Click "Payroll" module card  
**URL:** `http://localhost:3000/payroll`  
**Who can access:** All roles (with different permissions)

**What you can do:**
- ✅ View payroll cycles
- ✅ Create payroll cycles
- ✅ Process payroll
- ✅ View payslips
- ✅ Finalize/Rollback payroll
- ✅ Mark as paid

**Steps to Create Payroll Cycle:**
1. Go to `/payroll`
2. Click "+ Create Payroll Cycle"
3. Fill in:
   - Name: "December 2025 Payroll"
   - Period Start: `2025-12-01`
   - Period End: `2025-12-31`
   - Payment Date: `2026-01-05`
4. Click "Create"
5. Click "⚙️ Process" to generate payslips

---

### ✅ Available in Frontend:

#### 3. **Employee Salaries Page** (`/employee-salaries`)
**Access:** Dashboard → Click "Employee Salaries" module card  
**URL:** `http://localhost:3000/employee-salaries`  
**Who can access:** ORG_ADMIN, HR_MANAGER

**What you can do:**
- ✅ View all employee salary assignments
- ✅ Assign salary to employees
- ✅ View detailed salary information
- ✅ See salary components breakdown
- ✅ View effective dates and status

**Steps to Assign Salary:**
1. Go to `/employee-salaries`
2. Click "+ Assign Salary" button
3. Select employee from dropdown
4. (Optional) Select salary structure (auto-calculates components)
5. Enter:
   - Basic Salary
   - Gross Salary
   - Net Salary
   - Effective Date
   - Currency
   - Payment Frequency
   - Bank Account (if available)
6. Click "Assign Salary"

**Steps to View Salary:**
1. Go to `/employee-salaries`
2. Find employee in the table
3. Click "👁️ View" button
4. See complete salary details with breakdown

---

## 🔧 How to Assign Salary to Employees (Current Options)

### Option 1: Use API (Recommended for Now)

**Endpoint:** `POST /api/v1/payroll/employee-salaries`

**Example Request:**
```json
{
  "employeeId": "<employee_id>",
  "salaryStructureId": "<structure_id>",
  "effectiveDate": "2025-12-01",
  "basicSalary": 50000,
  "grossSalary": 75000,
  "netSalary": 67687.5,
  "components": {
    "basic": 50000,
    "hra": 20000,
    "transport": 5000,
    "pf": 6000,
    "esi": 1312.5
  },
  "currency": "INR",
  "paymentFrequency": "MONTHLY",
  "isActive": true
}
```

**Steps:**
1. Get Employee ID:
   - Go to `/employees`
   - Click on employee
   - Note the ID from URL or details

2. Get Salary Structure ID:
   - Go to `/salary-structures`
   - Note the structure ID

3. Use Postman/Thunder Client:
   - POST to `http://localhost:5000/api/v1/payroll/employee-salaries`
   - Add Authorization header with your token
   - Send JSON body with employee salary data

---

### Option 2: Use Backend Script

```bash
cd backend
npm run assign:salary
```

This will automatically assign salaries to Mani and Saravanan.

---

## 📊 Where to View Salary Information

### 1. **View Salary Structures**
- **Page:** `/salary-structures`
- **Shows:** All salary structures with components
- **Access:** ORG_ADMIN, HR_MANAGER

### 2. **View Payslips**
- **Page:** `/payroll`
- **Tab:** Switch to "Payslips" view
- **Shows:** All payslips with earnings/deductions breakdown
- **Access:** 
  - ORG_ADMIN, HR_MANAGER: See all payslips
  - EMPLOYEE: See only own payslips

### 3. **View Payroll Cycles**
- **Page:** `/payroll`
- **Tab:** "Payroll Cycles" (default)
- **Shows:** All payroll cycles with status, totals
- **Access:** ORG_ADMIN, HR_MANAGER, MANAGER

---

## 🎯 Complete Workflow (Frontend)

### Step 1: Create Salary Structure
1. Login as ORG_ADMIN
2. Go to `/salary-structures`
3. Create salary structure with components

### Step 2: Assign Salary to Employee
1. Go to `/employee-salaries`
2. Click "+ Assign Salary"
3. Select employee and fill in salary details
4. (Optional) Select salary structure for auto-calculation
5. Click "Assign Salary"

### Step 3: Create Payroll Cycle
1. Go to `/payroll`
2. Create payroll cycle for the month
3. Set period dates

### Step 4: Process Payroll
1. Click "⚙️ Process" on the cycle
2. System generates payslips automatically
3. View payslips in "Payslips" tab

### Step 5: Finalize & Pay
1. Click "🔒 Finalize" to lock payroll
2. Click "✅ Mark Paid" when salary is disbursed

---

## 📝 Quick Reference

| Action | Page/Route | Access Level |
|--------|-----------|--------------|
| Create Salary Structure | `/salary-structures` | ORG_ADMIN, HR_MANAGER |
| View Salary Structures | `/salary-structures` | ORG_ADMIN, HR_MANAGER |
| Assign Salary to Employee | `/employee-salaries` | ORG_ADMIN, HR_MANAGER |
| View Employee Salary | `/employee-salaries` | ORG_ADMIN, HR_MANAGER |
| Create Payroll Cycle | `/payroll` | ORG_ADMIN, HR_MANAGER |
| Process Payroll | `/payroll` | ORG_ADMIN, HR_MANAGER |
| View Payslips | `/payroll` (Payslips tab) | All (filtered by role) |
| Finalize Payroll | `/payroll` | ORG_ADMIN, HR_MANAGER |

---

## 💡 Future Enhancements Needed

1. **Employee Salary Management Page** (`/employee-salaries`)
   - Assign salary to employees
   - View employee salary details
   - Update employee salaries
   - View salary revision history

2. **Salary Templates Page** (`/salary-templates`)
   - Create reusable salary templates
   - Assign templates to employees

3. **Employee Salary View in Employee Details**
   - Add salary tab in employee profile
   - Show current salary, history, CTC

---

## 🚀 Quick Start Guide

**To assign salary to Mani and Saravanan:**

1. **Create Salary Structure** (if not exists):
   - Go to `/salary-structures`
   - Create "Standard Salary Structure"

2. **Assign Salary** (Use API or script):
   ```bash
   npm run assign:salary
   ```

3. **Mark Attendance** (for December):
   ```bash
   npm run mark:december
   ```

4. **Process Payroll**:
   - Go to `/payroll`
   - Create cycle for December 2025
   - Process it

---

## ❓ FAQ

**Q: Where can I see employee salary in frontend?**  
A: Currently, you can only see it in payslips after processing payroll. There's no dedicated employee salary view page yet.

**Q: How do I assign salary to a new employee?**  
A: Use the API endpoint or wait for the UI implementation. The backend API is ready, but frontend UI is pending.

**Q: Can I edit employee salary in frontend?**  
A: Not yet. Use API for now, or UI will be added in future.

**Q: Where do I see salary structure details?**  
A: Go to `/salary-structures` page - you can see all components and details there.

---

**Note:** Employee Salary Assignment UI is now available! Go to `/employee-salaries` to assign and view employee salaries.
