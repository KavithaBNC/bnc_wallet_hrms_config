# How Employee Views Payslip & Working Days Calculation

## 👤 Where Employee Mani Can See Payslip

### **Location: Payroll Page**

**URL:** `http://localhost:3000/payroll`  
**Access:** Login as EMPLOYEE (Mani)

### **Steps for Mani:**

1. **Login as Mani:**
   - Email: (Mani's email)
   - Password: `password123` (or his password)

2. **Navigate to Payroll Page:**
   - Click "Payroll" from Dashboard
   - Or go directly to: `http://localhost:3000/payroll`

3. **View Payslips:**
   - The page automatically shows "Payslips" view (not Payroll Cycles)
   - Mani will see **ONLY his own payslips**
   - Cannot see other employees' payslips

4. **View Details:**
   - Click on any payslip in the list
   - See complete breakdown:
     - Earnings (Basic, HRA, Transport, etc.)
     - Deductions (PF, ESI, Tax, etc.)
     - Gross Salary
     - Net Salary
     - Working Days
     - Paid Days
     - Unpaid Days

---

## 📊 What Employee Sees

### **Payslips Table:**
- Period (e.g., Dec 1-31, 2025)
- Payment Date
- Gross Salary
- Net Salary
- Status
- View button

### **Payslip Details:**
- Employee Information
- Period Information
- Earnings Breakdown
- Deductions Breakdown
- Attendance Summary:
  - Working Days: 23 (total working days in month)
  - Paid Days: 23 (days for which salary is paid)
  - Unpaid Days: 0 (absent days without leave)
- YTD Totals (Year-to-Date)
- Bank Details

---

## 💰 How Salary is Calculated Based on Working Days

### **The System Already Does This!** ✅

The payroll calculation engine automatically calculates salary based on working days. Here's how:

### **Step 1: Calculate Total Working Days**
- System counts working days in the month (excluding weekends)
- Example: December 2025 = 23 working days (excluding Saturdays & Sundays)

### **Step 2: Get Attendance Data**
- System checks attendance records for the period
- Counts:
  - **Present Days:** Days employee was present
  - **Absent Days:** Days employee was absent
  - **Half Days:** Days employee worked half day
  - **Holiday Days:** Company holidays
  - **Weekend Days:** Saturdays & Sundays

### **Step 3: Calculate Paid Days**
```
Paid Days = Present Days + (Half Days × 0.5) + Paid Leave Days + Holiday Days
```

**Example:**
- Total Working Days: 23
- Present Days: 20
- Half Days: 2 (counts as 1 day)
- Paid Leave: 2 days
- Holidays: 0
- **Paid Days = 20 + 1 + 2 = 23 days** ✅

### **Step 4: Calculate LOP (Loss of Pay)**
```
LOP = (Gross Salary / Total Working Days) × (Absent Days + Unpaid Leave Days)
```

**Example:**
- Gross Salary: ₹75,000
- Total Working Days: 23
- Absent Days: 2
- Unpaid Leave: 0
- **LOP = (75,000 / 23) × 2 = ₹6,521.74**

### **Step 5: Calculate Final Salary**
```
Adjusted Gross = Gross Salary - LOP
Net Salary = Adjusted Gross - Deductions
```

**Example:**
- Gross Salary: ₹75,000
- LOP: ₹6,521.74 (for 2 absent days)
- Adjusted Gross: ₹68,478.26
- Deductions: ₹7,312.50 (PF + ESI)
- **Net Salary: ₹61,165.76**

---

## 📅 Working Days Calculation Formula

### **How System Calculates Working Days:**

1. **Count all days in period** (e.g., Dec 1-31 = 31 days)

2. **Exclude weekends:**
   - Saturdays (day 6)
   - Sundays (day 0)
   - Example: December 2025 has 8 weekends = 16 days excluded

3. **Result:**
   - Total Days: 31
   - Weekends: 16
   - **Working Days: 15** (if no holidays)
   - **Working Days: 23** (if holidays are counted as working days)

**Note:** The system uses `calculateWorkingDays()` function which:
- Excludes weekends automatically
- Can include/exclude holidays based on configuration
- Handles month boundaries correctly

---

## 🎯 Real Example: Mani's December Salary

### **Scenario:**
- **Mani's Gross Salary:** ₹75,000/month
- **Total Working Days in December:** 23 days
- **Mani's Attendance:**
  - Present: 23 days ✅
  - Absent: 0 days
  - Half Days: 0
  - Paid Leave: 0

### **Calculation:**

1. **Paid Days = 23** (all present)

2. **LOP = 0** (no absent days)

3. **Gross Salary = ₹75,000** (full amount, no deduction)

4. **Deductions:**
   - PF (12% of Basic): ₹6,000
   - ESI (1.75% of Gross): ₹1,312.50
   - **Total Deductions: ₹7,312.50**

5. **Net Salary = ₹75,000 - ₹7,312.50 = ₹67,687.50**

---

## 📊 What If Mani Has Absent Days?

### **Scenario:**
- **Total Working Days:** 23
- **Present Days:** 21
- **Absent Days:** 2

### **Calculation:**

1. **Daily Salary = ₹75,000 / 23 = ₹3,260.87 per day**

2. **LOP for 2 days = ₹3,260.87 × 2 = ₹6,521.74**

3. **Adjusted Gross = ₹75,000 - ₹6,521.74 = ₹68,478.26**

4. **Deductions (based on adjusted gross):**
   - PF: ₹6,000 (still 12% of basic)
   - ESI: ₹1,198.37 (1.75% of ₹68,478.26)
   - **Total: ₹7,198.37**

5. **Net Salary = ₹68,478.26 - ₹7,198.37 = ₹61,279.89**

---

## ✅ Verification: Is Working Days Calculation Active?

### **Yes! The system already calculates based on working days:**

1. ✅ **`calculateWorkingDays()`** - Counts working days (excludes weekends)
2. ✅ **`calculatePaidDays()`** - Calculates paid days from attendance
3. ✅ **`calculateLOP()`** - Calculates loss of pay for absent days
4. ✅ **Attendance Integration** - Fetches attendance records for the period
5. ✅ **Leave Integration** - Considers paid vs unpaid leaves

### **When Processing Payroll:**

The system automatically:
1. Gets attendance data for each employee
2. Calculates working days for the period
3. Calculates paid days (present + paid leaves)
4. Calculates LOP for absent/unpaid days
5. Adjusts gross salary accordingly
6. Applies deductions
7. Calculates net salary

---

## 🔍 How to Verify Working Days Calculation

### **Check Payslip Details:**

1. **Process Payroll** for December 2025
2. **View Payslip** (as admin or employee)
3. **Check these fields:**
   - **Attendance Days:** Should show paid days
   - **Paid Days:** Days for which salary is paid
   - **Unpaid Days:** Absent days without leave
   - **Gross Salary:** Should be adjusted if LOP applied

### **Example Payslip Shows:**

```
Period: December 1-31, 2025
Total Working Days: 23
Paid Days: 23
Unpaid Days: 0
Attendance Days: 23

Gross Salary: ₹75,000
LOP: ₹0
Adjusted Gross: ₹75,000
Deductions: ₹7,312.50
Net Salary: ₹67,687.50
```

---

## 📝 Summary

### **For Employee Mani to View Payslip:**

1. Login as Mani (EMPLOYEE role)
2. Go to: `http://localhost:3000/payroll`
3. Page automatically shows "Payslips" tab
4. Click on any payslip to view details
5. See complete breakdown with working days

### **Working Days Calculation:**

✅ **Already Implemented!**

- System calculates working days automatically
- Excludes weekends
- Considers attendance (present/absent)
- Calculates LOP for absent days
- Adjusts salary based on paid days
- All calculations are automatic when processing payroll

**You don't need to do anything extra - it's already working!** 🎉

---

## 💡 Key Points

1. **Working Days = Total days minus weekends** (and holidays if configured)
2. **Paid Days = Present + Half Days + Paid Leaves + Holidays**
3. **LOP = (Gross / Working Days) × Absent Days**
4. **Final Salary = Gross - LOP - Deductions**
5. **All calculations are automatic** when you process payroll

---

**The system is already calculating salary based on working days!** Just process payroll and it will automatically consider attendance and calculate LOP if needed.
