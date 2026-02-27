# Phase 4 Quick Test Guide

## Quick Start Testing

### 1. Seed Data First

```bash
cd backend
ts-node src/scripts/seed-payroll-data.ts
```

Expected output:
- ✅ 2 Salary Structures created
- ✅ 2 Salary Templates created
- ✅ Bank accounts for employees
- ✅ Employee salaries assigned

### 2. Run Automated Tests

```bash
cd backend
ts-node src/scripts/test-phase4-modules.ts
```

This will test all modules and provide a summary.

### 3. Frontend Testing Checklist

#### Module 1: Salary Structure Management
- [ ] Navigate to `/salary-structures`
- [ ] Login as ORG_ADMIN or HR_MANAGER
- [ ] Verify salary structures list displays
- [ ] Click "Create Salary Structure"
- [ ] Add components (Basic, HRA, PF, etc.)
- [ ] Save and verify it appears in list
- [ ] Test delete functionality

#### Module 1 (Part 2): Salary Templates & Employee Salary
- [ ] Navigate to `/payroll`
- [ ] Check if salary templates are visible
- [ ] Verify employee salary assignments
- [ ] Test assigning salary to employee

#### Module 2: Payroll Processing
- [ ] Navigate to `/payroll`
- [ ] Click "Create Payroll Cycle"
- [ ] Fill in period dates
- [ ] Create cycle
- [ ] Click "Process" on the cycle
- [ ] Verify status changes to PROCESSED
- [ ] Check that payslips are generated

#### Module 3: Payroll Run Management
- [ ] After processing, click "Finalize"
- [ ] Verify status changes to FINALIZED
- [ ] Verify cycle is locked (cannot edit)
- [ ] Click "Rollback" (if available)
- [ ] Verify status returns to PROCESSED
- [ ] Test month/year filters

#### Module 3: Payslip Generation
- [ ] Switch to "Payslips" view in PayrollPage
- [ ] Click on a payslip to view details
- [ ] Verify earnings breakdown displays
- [ ] Verify deductions breakdown displays
- [ ] Verify YTD totals shown
- [ ] Verify bank details (if available)
- [ ] Test download button (placeholder mode)

#### Employee Self-Service
- [ ] Logout and login as EMPLOYEE
- [ ] Navigate to `/payroll`
- [ ] Verify only own payslips visible
- [ ] Click on own payslip
- [ ] Verify can view details
- [ ] Verify cannot access other employees' payslips

## Common Issues & Solutions

### Issue: "No organization found" in seed script
**Fix**: The script will use the first organization found. Ensure at least one organization exists.

### Issue: "No employees found"
**Fix**: Create employees first or ensure employees exist in the organization.

### Issue: Frontend shows "No data"
**Fix**: 
1. Check if seed script ran successfully
2. Verify organizationId matches in frontend
3. Check browser console for API errors

### Issue: "Cannot process payroll"
**Fix**: 
1. Ensure employees have salary assignments
2. Check if payroll cycle is in DRAFT status
3. Verify attendance/leave data exists for the period

## Test Data Summary

After seeding, you should have:
- **Salary Structures**: 2 (Standard, Executive)
- **Salary Templates**: 2 (Junior L1, Senior L3)
- **Bank Accounts**: 3 (for first 3 employees)
- **Employee Salaries**: 3 (assigned to first 3 employees)

## API Endpoints to Test

### Module 1
- `GET /api/v1/payroll/salary-components` - Predefined components
- `POST /api/v1/payroll/salary-structures` - Create structure
- `GET /api/v1/payroll/salary-structures` - List structures

### Module 1 (Part 2)
- `POST /api/v1/payroll/salary-templates` - Create template
- `GET /api/v1/payroll/salary-templates` - List templates
- `POST /api/v1/payroll/employee-salaries` - Assign salary

### Module 2
- `POST /api/v1/payroll/payroll-cycles` - Create cycle
- `POST /api/v1/payroll/payroll-cycles/:id/process` - Process

### Module 3 (Run Management)
- `POST /api/v1/payroll/payroll-cycles/:id/finalize` - Finalize
- `POST /api/v1/payroll/payroll-cycles/:id/rollback` - Rollback
- `GET /api/v1/payroll/payroll-cycles?payrollMonth=1&payrollYear=2026` - Query

### Module 3 (Payslip)
- `GET /api/v1/payroll/payslips` - List payslips
- `GET /api/v1/payroll/payslips/:id/comprehensive` - Full details
- `GET /api/v1/payroll/payslips/:id/download` - Download PDF

## Success Criteria

✅ All modules tested successfully
✅ Frontend displays data correctly
✅ Employee self-service works
✅ Access control enforced
✅ Calculations are correct
✅ Status transitions work
✅ PDF endpoints accessible (placeholder mode)
