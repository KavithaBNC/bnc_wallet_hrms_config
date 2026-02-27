# Why Employee Mani Sees No Payslip - Troubleshooting Guide

## 🔍 Why No Payslip Appears

If Mani (logged in as employee) sees no payslips, it means one of these conditions is missing:

### **Prerequisites for Payslips:**

1. ✅ **Employee has salary assigned**
2. ✅ **Payroll cycle created** for the period
3. ✅ **Payroll cycle processed** (status = PROCESSED)
4. ✅ **Payslips generated** during processing

---

## ✅ Step-by-Step: Generate Payslips for Mani

### **Step 1: Verify Mani Has Salary Assigned**

**Check:**
- Go to `/employee-salaries` (as ORG_ADMIN/HR_MANAGER)
- Look for Mani in the list
- If not found, assign salary to Mani

**If Mani doesn't have salary:**
1. Go to `/employee-salaries`
2. Click "+ Assign Salary"
3. Select "Mani"
4. Enter salary details
5. Click "Assign Salary"

---

### **Step 2: Create Payroll Cycle for December**

**As ORG_ADMIN/HR_MANAGER:**

1. Go to `/payroll`
2. Click "+ Create Payroll Cycle"
3. Fill in:
   - **Name:** "December 2025 Payroll"
   - **Period Start:** `2025-12-01`
   - **Period End:** `2025-12-31`
   - **Payment Date:** `2026-01-05`
4. Click "Create"

**Verify:**
- Cycle appears in list
- Status shows "DRAFT"

---

### **Step 3: Process Payroll**

**As ORG_ADMIN/HR_MANAGER:**

1. Find "December 2025 Payroll" in the list
2. Click "⚙️ Process" button
3. Wait for processing to complete
4. Verify:
   - Status changes to "PROCESSED"
   - Shows "Total Employees" count
   - Payslips are generated

**Important:** Processing will only generate payslips for employees who:
- Have active salary assignment
- Have attendance records (or it will use default working days)

---

### **Step 4: Verify Payslips Generated**

**As ORG_ADMIN/HR_MANAGER:**

1. Go to `/payroll`
2. Switch to "Payslips" tab
3. Check if Mani's payslip appears
4. If yes, Mani can now see it
5. If no, check the issues below

---

## 🔧 Common Issues & Solutions

### **Issue 1: No Salary Assigned**

**Symptom:** Payslips not generated for Mani

**Solution:**
1. Login as ORG_ADMIN
2. Go to `/employee-salaries`
3. Assign salary to Mani
4. Re-process payroll cycle

---

### **Issue 2: Payroll Not Processed**

**Symptom:** Payroll cycle exists but status is "DRAFT"

**Solution:**
1. Login as ORG_ADMIN
2. Go to `/payroll`
3. Click "⚙️ Process" on the cycle
4. Wait for completion

---

### **Issue 3: Wrong Period**

**Symptom:** Payslip exists but for different month

**Solution:**
1. Check payroll cycle period dates
2. Ensure it matches the month you want
3. Create new cycle for correct period if needed

---

### **Issue 4: Employee Not in Organization**

**Symptom:** Mani not found during processing

**Solution:**
1. Verify Mani's `organizationId` matches your organization
2. Check if Mani is active employee
3. Verify employee status is "ACTIVE"

---

## 🎯 Quick Checklist

Before Mani can see payslips, ensure:

- [ ] **Mani has salary assigned** → Check `/employee-salaries`
- [ ] **Payroll cycle created** → Check `/payroll` (Payroll Cycles tab)
- [ ] **Payroll cycle processed** → Status should be "PROCESSED"
- [ ] **Payslips generated** → Check `/payroll` (Payslips tab) as admin
- [ ] **Mani logged in as EMPLOYEE** → Not as admin
- [ ] **Correct period** → Payslip period matches what Mani expects

---

## 📋 Complete Setup Flow

### **As ORG_ADMIN/HR_MANAGER:**

1. **Assign Salary to Mani:**
   ```
   /employee-salaries → + Assign Salary → Select Mani → Enter Salary → Assign
   ```

2. **Mark Attendance (Optional but Recommended):**
   ```bash
   npm run mark:december
   ```

3. **Create Payroll Cycle:**
   ```
   /payroll → + Create Payroll Cycle → December 2025 → Create
   ```

4. **Process Payroll:**
   ```
   /payroll → Click "Process" on December cycle → Wait for completion
   ```

5. **Verify Payslips:**
   ```
   /payroll → Switch to "Payslips" tab → Check Mani's payslip exists
   ```

### **As Mani (EMPLOYEE):**

1. **Login as Mani**
2. **Go to `/payroll`**
3. **See payslips** (should appear automatically)

---

## 🔍 How to Check What's Missing

### **Check 1: Does Mani have salary?**

**As ORG_ADMIN:**
- Go to `/employee-salaries`
- Search for "Mani"
- If not found → Assign salary

### **Check 2: Is payroll cycle created?**

**As ORG_ADMIN:**
- Go to `/payroll`
- Check "Payroll Cycles" tab
- If no cycle for December → Create one

### **Check 3: Is payroll processed?**

**As ORG_ADMIN:**
- Go to `/payroll`
- Check cycle status
- If "DRAFT" → Click "Process"
- If "PROCESSED" → Payslips should exist

### **Check 4: Are payslips generated?**

**As ORG_ADMIN:**
- Go to `/payroll`
- Switch to "Payslips" tab
- Search for Mani
- If not found → Re-process payroll

---

## 💡 Quick Fix Commands

If you want to quickly set everything up:

```bash
# 1. Assign salary to Mani and Saravanan
cd backend
npm run assign:salary

# 2. Mark them present for December
npm run mark:december

# 3. Then in frontend:
# - Login as ORG_ADMIN
# - Go to /payroll
# - Create December 2025 cycle
# - Process it
# - Mani can now see payslip
```

---

## ❓ FAQ

**Q: Mani logged in but sees no payslips. Why?**  
A: Either:
- No payroll cycle created yet
- Payroll cycle not processed
- Mani doesn't have salary assigned
- Payslips generated for different period

**Q: How do I know if payslips were generated?**  
A: Login as ORG_ADMIN, go to `/payroll`, switch to "Payslips" tab. If you see payslips there, employees can see them too.

**Q: Do I need to process payroll for each employee separately?**  
A: No! Processing one payroll cycle generates payslips for ALL employees with salary assignments.

**Q: Can Mani see payslips before payroll is processed?**  
A: No. Payslips are only created when you click "Process" on a payroll cycle.

---

## 🎯 Most Likely Issue

**99% chance the issue is:** Payroll cycle hasn't been processed yet.

**Solution:**
1. Login as ORG_ADMIN
2. Go to `/payroll`
3. Create December 2025 cycle (if not exists)
4. Click "⚙️ Process" button
5. Wait for completion
6. Mani can now see payslip!

---

**The payslip will only appear AFTER you process the payroll cycle!** 🎯
