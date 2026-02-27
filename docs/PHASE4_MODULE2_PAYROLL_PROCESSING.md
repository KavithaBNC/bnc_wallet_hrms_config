# Phase 4 - Module 2: Payroll Processing

## Implementation Summary

This module implements comprehensive payroll processing with a calculation engine that handles attendance integration, leave integration, overtime, pro-rata calculations, and India tax regime support.

## Features Implemented

### 1. Payroll Calculation Engine

**File:** `backend/src/utils/payroll-calculation-engine.ts`

A comprehensive calculation engine that handles:

#### Core Calculations:
- **Gross Salary** = Sum of all earnings (Basic + HRA + Transport + Allowances + Overtime)
- **Deductions** = PF + ESI + Tax + Professional Tax + Other deductions
- **Net Salary** = Gross Salary - Total Deductions
- **LOP (Loss of Pay)** = (Monthly salary / Working days) × Absent days
- **Overtime** = (Basic salary / Working days / 8) × Overtime hours × 1.5

#### Attendance Integration:
- Present days calculation
- Absent days (LOP deduction)
- Half days (0.5 day calculation)
- Holiday days (paid)
- Weekend days (excluded from working days)
- Overtime hours tracking

#### Leave Integration:
- Paid leave days (counted as paid)
- Unpaid leave days (LOP deduction)
- Leave type-based calculation
- Overlapping leave period handling

#### Pro-rata Calculations:
- Mid-month joining (proration from joining date)
- Mid-month leaving (proration until leaving date)
- Effective working days calculation
- Proration factor application

#### Tax Calculation (India):
- **New Tax Regime (FY 2023-24):**
  - ₹0 - ₹3,00,000: 0%
  - ₹3,00,001 - ₹7,00,000: 5%
  - ₹7,00,001 - ₹10,00,000: 10%
  - ₹10,00,001 - ₹12,00,000: 15%
  - ₹12,00,001 - ₹15,00,000: 20%
  - Above ₹15,00,000: 30%
  - 4% Cess on total tax

- **Old Tax Regime (FY 2023-24):**
  - ₹0 - ₹2,50,000: 0%
  - ₹2,50,001 - ₹5,00,000: 5%
  - ₹5,00,001 - ₹10,00,000: 20%
  - Above ₹10,00,000: 30%
  - 4% Cess on total tax

#### Statutory Deductions:
- **PF (Provident Fund):** 12% of Basic Salary
- **ESI (Employee State Insurance):** 0.75% of Gross (if gross < ₹21,000)
- **Professional Tax:** ₹200 per month (varies by state)

### 2. Enhanced Payroll Processing Service

**File:** `backend/src/services/payroll.service.ts`

#### New Methods:

1. **`getAttendanceData()`** - Fetches and processes attendance records
   - Calculates present, absent, half days
   - Tracks holidays and weekends
   - Calculates overtime hours
   - Determines total working days

2. **`getLeaveData()`** - Fetches and processes leave requests
   - Gets approved leaves for the period
   - Separates paid vs unpaid leaves
   - Calculates overlapping days with payroll period
   - Returns leave details breakdown

3. **Enhanced `processPayrollCycle()`** - Uses calculation engine
   - Integrates attendance data
   - Integrates leave data
   - Uses calculation engine for all calculations
   - Supports tax regime selection
   - Handles pro-rata for mid-month joining/leaving

### 3. Calculation Flow

```
1. Fetch Employee Salary
   ↓
2. Get Salary Structure Components
   ↓
3. Fetch Attendance Data (present, absent, half days, overtime)
   ↓
4. Fetch Leave Data (paid, unpaid leaves)
   ↓
5. Calculate Pro-rata Factor (if mid-month joining/leaving)
   ↓
6. Calculate Paid Days (attendance + paid leaves)
   ↓
7. Calculate LOP (absent days + unpaid leaves)
   ↓
8. Calculate Overtime Amount
   ↓
9. Calculate Earnings (from components + overtime)
   ↓
10. Calculate Gross Salary (sum of earnings - LOP)
    ↓
11. Calculate Deductions (from components)
    ↓
12. Calculate Tax (based on regime)
    ↓
13. Calculate Statutory Deductions (PF, ESI, PT)
    ↓
14. Calculate Net Salary (Gross - All Deductions)
    ↓
15. Create Payslip
```

## API Endpoints

### Process Payroll Cycle (Enhanced)

```
POST /api/v1/payroll/payroll-cycles/:id/process
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER

Body:
{
  "employeeIds": ["uuid1", "uuid2"], // Optional: if empty, process all
  "recalculate": false,
  "taxRegime": "NEW" // or "OLD"
}

Response:
{
  "success": true,
  "message": "Payroll processed successfully for 25 employees",
  "payslipsCount": 25,
  "totalGross": 1250000,
  "totalDeductions": 250000,
  "totalNet": 1000000
}
```

## Calculation Examples

### Example 1: Standard Monthly Payroll

**Employee Details:**
- Basic Salary: ₹50,000
- HRA: 40% of Basic = ₹20,000
- Transport: ₹2,000
- Gross: ₹72,000
- Working Days: 22
- Present Days: 20
- Absent Days: 2
- Paid Leaves: 0
- Overtime: 5 hours

**Calculations:**
- Paid Days: 20 + 0 = 20
- LOP: (₹72,000 / 22) × 2 = ₹6,545.45
- Overtime: (₹50,000 / 22 / 8) × 5 × 1.5 = ₹2,130.68
- Gross: ₹72,000 - ₹6,545.45 + ₹2,130.68 = ₹67,585.23
- PF: ₹50,000 × 12% = ₹6,000
- Tax (New Regime): Calculated on taxable income
- Net: Gross - Deductions

### Example 2: Mid-Month Joining

**Employee Details:**
- Joining Date: 15th of month
- Period: 1st - 31st (22 working days)
- Effective Working Days: 12 (from 15th to 31st)
- Proration Factor: 12 / 22 = 0.545

**Calculations:**
- All components prorated by 0.545
- Basic: ₹50,000 × 0.545 = ₹27,250
- Gross: ₹72,000 × 0.545 = ₹39,240
- Deductions also prorated

### Example 3: With Leaves

**Employee Details:**
- Working Days: 22
- Present Days: 18
- Absent Days: 1
- Paid Leave: 2 days (Sick Leave)
- Unpaid Leave: 1 day (Leave Without Pay)

**Calculations:**
- Paid Days: 18 + 2 = 20
- Unpaid Days: 1 + 1 = 2
- LOP: (₹72,000 / 22) × 2 = ₹6,545.45
- Gross: ₹72,000 - ₹6,545.45 = ₹65,454.55

## Payslip Structure

Each payslip includes:

```json
{
  "id": "uuid",
  "employeeId": "uuid",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "paymentDate": "2026-02-05",
  "basicSalary": 50000,
  "earnings": [
    { "component": "Basic Salary", "amount": 50000, "isTaxable": true },
    { "component": "HRA", "amount": 20000, "isTaxable": true },
    { "component": "Transport", "amount": 2000, "isTaxable": true },
    { "component": "Overtime", "amount": 2130.68, "isTaxable": true }
  ],
  "deductions": [
    { "component": "Provident Fund", "amount": 6000, "type": "STATUTORY" },
    { "component": "ESI", "amount": 540, "type": "STATUTORY" },
    { "component": "Professional Tax", "amount": 200, "type": "STATUTORY" }
  ],
  "grossSalary": 67585.23,
  "totalDeductions": 15000,
  "netSalary": 52585.23,
  "attendanceDays": 20,
  "paidDays": 20,
  "unpaidDays": 2,
  "overtimeHours": 5,
  "taxDetails": {
    "taxableIncome": 72000,
    "incomeTax": 2100,
    "regime": "NEW",
    "breakdown": [...]
  },
  "statutoryDeductions": {
    "pf": 6000,
    "esi": 540,
    "professionalTax": 200,
    "total": 6740,
    "breakdown": [...]
  }
}
```

## Configuration

### Tax Regime Selection

Tax regime can be set:
1. **Per Payroll Cycle:** Via `taxRegime` parameter in process request
2. **Organization Default:** Via organization settings
3. **Default:** NEW regime if not specified

### Statutory Deduction Rates

Currently using default rates:
- PF: 12% of Basic
- ESI: 0.75% of Gross (if < ₹21,000)
- Professional Tax: ₹200/month

**Note:** These should be configurable via TaxConfiguration and StatutoryCompliance models in future enhancements.

## Integration Points

### Attendance Module
- Fetches attendance records for payroll period
- Calculates present/absent/half days
- Tracks overtime hours
- Excludes weekends and holidays

### Leave Module
- Fetches approved leave requests
- Distinguishes paid vs unpaid leaves
- Calculates overlapping days with payroll period
- Handles multiple leave types

### Salary Structure Module
- Uses salary structure components for calculations
- Applies component calculation types (FIXED, PERCENTAGE, FORMULA)
- Respects taxable/non-taxable flags
- Handles statutory/non-statutory deductions

## Testing

### Test Scenarios

1. **Standard Monthly Payroll:**
   - Employee with full attendance
   - No leaves
   - No overtime
   - Verify gross = sum of earnings
   - Verify net = gross - deductions

2. **With Absent Days:**
   - Employee with 2 absent days
   - Verify LOP calculation
   - Verify reduced gross salary

3. **With Paid Leaves:**
   - Employee with 3 days paid leave
   - Verify paid days include leave days
   - Verify no LOP for paid leaves

4. **With Unpaid Leaves:**
   - Employee with 2 days unpaid leave
   - Verify LOP includes unpaid leave days
   - Verify reduced gross salary

5. **With Overtime:**
   - Employee with 10 hours overtime
   - Verify overtime amount (1.5x hourly rate)
   - Verify overtime added to earnings

6. **Mid-Month Joining:**
   - Employee joining on 15th
   - Verify proration factor
   - Verify all amounts prorated

7. **Mid-Month Leaving:**
   - Employee leaving on 20th
   - Verify proration until leaving date
   - Verify correct calculations

8. **Tax Calculation:**
   - Test NEW regime with different income levels
   - Test OLD regime with different income levels
   - Verify tax breakdown
   - Verify cess calculation

## Files Created/Modified

### Created:
1. **`backend/src/utils/payroll-calculation-engine.ts`** (600+ lines)
   - Complete calculation engine
   - All calculation formulas
   - Tax regime implementations
   - Statutory deduction calculations

### Modified:
1. **`backend/src/services/payroll.service.ts`**
   - Added `getAttendanceData()` method
   - Added `getLeaveData()` method
   - Enhanced `processPayrollCycle()` to use calculation engine
   - Integrated attendance and leave data

2. **`backend/src/utils/payroll.validation.ts`**
   - Added `taxRegime` to `processPayrollCycleSchema`

## Next Steps

1. **Configuration Management:**
   - Make statutory rates configurable
   - Add organization-level tax settings
   - Support multiple countries/regions

2. **Holiday Integration:**
   - Fetch holidays from Holiday module
   - Exclude holidays from working days
   - Handle regional holidays

3. **Shift Integration:**
   - Consider shift timings for overtime
   - Handle night shift allowances
   - Calculate based on shift schedules

4. **Advanced Features:**
   - Bonus calculations
   - Arrears handling
   - Advance salary deductions
   - Loan EMI deductions

5. **Reporting:**
   - Payroll summary reports
   - Tax reports
   - Statutory compliance reports
   - Cost center-wise reports

## Notes

- All calculations are done in the calculation engine for consistency
- LOP is calculated before other deductions
- Overtime is added to taxable income
- Tax is calculated on taxable income (after LOP)
- Statutory deductions are calculated separately and added to total deductions
- Pro-rata calculations apply to all components uniformly
- Paid days include present days + paid leave days + holidays
- Unpaid days include absent days + unpaid leave days
