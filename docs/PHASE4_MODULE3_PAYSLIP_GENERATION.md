# Phase 4 - Module 3: Payslip Generation

## Implementation Summary

This module implements comprehensive payslip generation with detailed earnings/deductions breakdown, YTD (Year-to-Date) totals, and bank details for salary credit.

## Features Implemented

### 1. Payslip Creation

**Automatic Generation:**
- Payslips are automatically generated for each employee during payroll processing
- Includes all salary components, attendance data, and calculations
- Status: `GENERATED` after creation

**Comprehensive Data:**
- Employee information
- Payroll period details
- Salary structure components
- Attendance and leave data
- Tax and statutory deductions
- Bank account details

### 2. Earnings Breakdown

**Structured Format:**
```json
{
  "earningsBreakdown": [
    {
      "component": "Basic",
      "amount": 50000,
      "isTaxable": true,
      "description": "Basic Salary"
    },
    {
      "component": "HRA",
      "amount": 20000,
      "isTaxable": false,
      "description": "House Rent Allowance"
    },
    {
      "component": "Transport",
      "amount": 5000,
      "isTaxable": true,
      "description": "Transport Allowance"
    }
  ]
}
```

**Components Included:**
- Basic Salary
- HRA (House Rent Allowance)
- Transport Allowance
- Special Allowance
- Bonus
- Overtime
- Other earnings

### 3. Deductions Breakdown

**Structured Format:**
```json
{
  "deductionsBreakdown": [
    {
      "component": "PF",
      "amount": 1800,
      "type": "STATUTORY",
      "isStatutory": true,
      "description": "Provident Fund"
    },
    {
      "component": "ESI",
      "amount": 375,
      "type": "STATUTORY",
      "isStatutory": true,
      "description": "Employee State Insurance"
    },
    {
      "component": "Income Tax",
      "amount": 5000,
      "type": "TAX",
      "isStatutory": false,
      "description": "Income Tax (TDS)"
    }
  ]
}
```

**Deduction Types:**
- **STATUTORY:** PF, ESI, Professional Tax, etc.
- **TAX:** Income Tax/TDS
- **OTHER:** Loans, advances, other deductions

### 4. YTD (Year-to-Date) Totals

**Fields Added:**
- `ytdGrossSalary`: Total gross salary from Jan 1 to current period
- `ytdDeductions`: Total deductions from Jan 1 to current period
- `ytdNetSalary`: Total net salary from Jan 1 to current period
- `ytdTaxPaid`: Total tax paid from Jan 1 to current period

**Calculation:**
- Automatically calculated during payslip generation
- Sums all payslips from January 1st of the year to current period
- Only includes payslips with status: `GENERATED`, `SENT`, or `PAID`
- Stored in database for quick retrieval

**Example:**
```json
{
  "ytdTotals": {
    "ytdGrossSalary": 600000,
    "ytdDeductions": 72000,
    "ytdNetSalary": 528000,
    "ytdTaxPaid": 60000
  }
}
```

### 5. Bank Details for Salary Credit

**Bank Information Included:**
- Bank Name
- Account Number
- Routing Number (if applicable)
- Account Type (CHECKING/SAVINGS)
- Primary Account Flag

**Source:**
- Retrieved from `EmployeeBankAccount` linked to `EmployeeSalary`
- Only primary account is shown by default
- Secure handling of sensitive information

## Database Schema Changes

### Updated Payslip Model

```prisma
model Payslip {
  // ... existing fields ...
  
  // YTD Totals (Year-to-Date)
  ytdGrossSalary      Decimal? @map("ytd_gross_salary") @db.Decimal(15, 2)
  ytdDeductions       Decimal? @map("ytd_deductions") @db.Decimal(15, 2)
  ytdNetSalary        Decimal? @map("ytd_net_salary") @db.Decimal(15, 2)
  ytdTaxPaid          Decimal? @map("ytd_tax_paid") @db.Decimal(15, 2)
  
  // ... rest of fields ...
}
```

## API Endpoints

### Get Comprehensive Payslip

```
GET /api/v1/payroll/payslips/:id/comprehensive
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER, MANAGER, EMPLOYEE

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "employee": { ... },
    "payrollCycle": { ... },
    "periodStart": "2026-01-01",
    "periodEnd": "2026-01-31",
    "paymentDate": "2026-02-05",
    "basicSalary": 50000,
    "grossSalary": 75000,
    "totalDeductions": 15000,
    "netSalary": 60000,
    "earningsBreakdown": [
      {
        "component": "Basic",
        "amount": 50000,
        "isTaxable": true,
        "description": "Basic Salary"
      },
      ...
    ],
    "deductionsBreakdown": [
      {
        "component": "PF",
        "amount": 1800,
        "type": "STATUTORY",
        "isStatutory": true,
        "description": "Provident Fund"
      },
      ...
    ],
    "ytdTotals": {
      "ytdGrossSalary": 600000,
      "ytdDeductions": 72000,
      "ytdNetSalary": 528000,
      "ytdTaxPaid": 60000
    },
    "bankDetails": {
      "bankName": "HDFC Bank",
      "accountNumber": "1234567890",
      "routingNumber": "HDFC0001234",
      "accountType": "CHECKING",
      "isPrimary": true
    },
    "attendanceDays": 22,
    "paidDays": 22,
    "unpaidDays": 0,
    "overtimeHours": 8,
    "taxDetails": { ... },
    "statutoryDeductions": { ... },
    "status": "GENERATED"
  }
}
```

### Get Payslip by ID (Enhanced)

```
GET /api/v1/payroll/payslips/:id
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER, MANAGER, EMPLOYEE

Response:
{
  "success": true,
  "data": {
    ...payslip with YTD totals and bank details
  }
}
```

## Payslip Generation Flow

### During Payroll Processing

1. **For Each Employee:**
   - Fetch employee salary structure
   - Calculate attendance and leave data
   - Run payroll calculation engine
   - Calculate YTD totals (sum of previous payslips + current)
   - Create payslip with all data

2. **YTD Calculation:**
   ```typescript
   // Get all payslips from Jan 1 to current period
   const yearStart = new Date(periodEnd.getFullYear(), 0, 1);
   const previousPayslips = await prisma.payslip.findMany({
     where: {
       employeeId: employee.id,
       periodEnd: { lte: periodEnd, gte: yearStart },
       status: { in: ['GENERATED', 'SENT', 'PAID'] }
     }
   });
   
   // Sum totals
   let ytdGross = 0;
   let ytdDeductions = 0;
   let ytdNet = 0;
   let ytdTax = 0;
   
   // Add current period
   ytdGross += calculation.grossSalary;
   ytdDeductions += calculation.totalDeductions;
   ytdNet += calculation.netSalary;
   ytdTax += taxAmount;
   ```

3. **Store YTD:**
   - YTD totals are stored in payslip record
   - Enables quick retrieval without recalculation
   - Automatically updated during generation

### On Payslip Retrieval

1. **If YTD Not Stored:**
   - Calculate YTD on-the-fly
   - Update payslip record (async, background)
   - Return calculated values

2. **Bank Details:**
   - Fetch from `EmployeeSalary.bankAccount`
   - Include in response
   - Secure sensitive data

3. **Format Breakdowns:**
   - Parse JSON earnings/deductions
   - Format for easy display
   - Include descriptions and flags

## Files Modified

### Schema:
- **`backend/prisma/schema.prisma`**
  - Added YTD fields to Payslip model

### Services:
- **`backend/src/services/payslip.service.ts`**
  - Added `calculateYTD()` method
  - Enhanced `getById()` to include YTD and bank details
  - Auto-calculates YTD if not stored

- **`backend/src/services/payroll.service.ts`**
  - Enhanced payslip creation to calculate and store YTD
  - Includes YTD in payslip data

### Controllers:
- **`backend/src/controllers/payslip.controller.ts`**
  - Added `getComprehensive()` method
  - Formats earnings/deductions breakdown
  - Includes bank details

### Routes:
- **`backend/src/routes/payroll.routes.ts`**
  - Added `GET /payslips/:id/comprehensive` route

## Payslip Structure

### Complete Payslip Data

```typescript
{
  // Basic Information
  id: string;
  employeeId: string;
  payrollCycleId: string;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  
  // Employee Details
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    email: string;
    department: { id: string; name: string };
    position: { id: string; title: string };
  };
  
  // Salary Components
  basicSalary: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  
  // Earnings Breakdown
  earningsBreakdown: Array<{
    component: string;
    amount: number;
    isTaxable: boolean;
    description: string;
  }>;
  
  // Deductions Breakdown
  deductionsBreakdown: Array<{
    component: string;
    amount: number;
    type: string;
    isStatutory: boolean;
    description: string;
  }>;
  
  // YTD Totals
  ytdTotals: {
    ytdGrossSalary: number;
    ytdDeductions: number;
    ytdNetSalary: number;
    ytdTaxPaid: number;
  };
  
  // Bank Details
  bankDetails: {
    bankName: string;
    accountNumber: string;
    routingNumber?: string;
    accountType: 'CHECKING' | 'SAVINGS';
    isPrimary: boolean;
  } | null;
  
  // Attendance
  attendanceDays: number;
  paidDays: number;
  unpaidDays: number;
  overtimeHours: number;
  
  // Tax & Statutory
  taxDetails: any;
  statutoryDeductions: any;
  
  // Status
  status: 'DRAFT' | 'GENERATED' | 'SENT' | 'PAID' | 'HOLD';
  paymentMethod: 'BANK_TRANSFER' | 'CHECK' | 'CASH';
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
}
```

## Usage Examples

### Example 1: Get Comprehensive Payslip

```javascript
// Get payslip with all details
const response = await fetch('/api/v1/payroll/payslips/:id/comprehensive', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data } = await response.json();

// Access earnings breakdown
data.earningsBreakdown.forEach(earning => {
  console.log(`${earning.component}: ${earning.amount} (Taxable: ${earning.isTaxable})`);
});

// Access deductions breakdown
data.deductionsBreakdown.forEach(deduction => {
  console.log(`${deduction.component}: ${deduction.amount} (Type: ${deduction.type})`);
});

// Access YTD totals
console.log(`YTD Gross: ${data.ytdTotals.ytdGrossSalary}`);
console.log(`YTD Net: ${data.ytdTotals.ytdNetSalary}`);

// Access bank details
if (data.bankDetails) {
  console.log(`Bank: ${data.bankDetails.bankName}`);
  console.log(`Account: ${data.bankDetails.accountNumber}`);
}
```

### Example 2: Display Payslip Summary

```javascript
const payslip = data;

// Summary
console.log(`Employee: ${payslip.employee.firstName} ${payslip.employee.lastName}`);
console.log(`Period: ${payslip.periodStart} to ${payslip.periodEnd}`);
console.log(`Payment Date: ${payslip.paymentDate}`);

// Earnings
const totalEarnings = payslip.earningsBreakdown.reduce((sum, e) => sum + e.amount, 0);
console.log(`Total Earnings: ${totalEarnings}`);

// Deductions
const totalDeductions = payslip.deductionsBreakdown.reduce((sum, d) => sum + d.amount, 0);
console.log(`Total Deductions: ${totalDeductions}`);

// Net
console.log(`Net Salary: ${payslip.netSalary}`);

// YTD
console.log(`YTD Gross: ${payslip.ytdTotals.ytdGrossSalary}`);
console.log(`YTD Net: ${payslip.ytdTotals.ytdNetSalary}`);
```

## Migration Required

**Important:** Before using these features, run the database migration:

```bash
cd backend
npx prisma migrate dev --name add_payslip_ytd_totals
npx prisma generate
```

This will:
- Add YTD fields to `payslips` table
- Generate TypeScript types

## Security & Access Control

### Role Permissions:

- **ORG_ADMIN, HR_MANAGER:**
  - View all payslips
  - Get comprehensive payslip details
  - Update payslip status

- **MANAGER:**
  - View payslips for team members
  - Get comprehensive payslip details

- **EMPLOYEE:**
  - View own payslips only
  - Get comprehensive payslip details for own payslips

### Data Security:

- Bank account numbers should be masked in frontend
- Sensitive financial data requires proper authorization
- YTD calculations respect data isolation by organization

## Best Practices

1. **YTD Calculation:**
   - Calculated during payslip generation for performance
   - Stored in database to avoid recalculation
   - Auto-calculated on retrieval if missing

2. **Bank Details:**
   - Always fetch from linked EmployeeSalary
   - Show primary account by default
   - Mask sensitive information in UI

3. **Breakdown Formatting:**
   - Always format earnings/deductions for display
   - Include descriptions for clarity
   - Flag taxable/statutory components

4. **Error Handling:**
   - Handle missing bank accounts gracefully
   - Calculate YTD if not stored
   - Validate payslip exists before operations

## Testing Scenarios

1. **Payslip Generation:**
   - Create payroll cycle
   - Process payroll
   - Verify payslips created with YTD

2. **YTD Calculation:**
   - Generate payslip for January
   - Generate payslip for February
   - Verify February YTD includes January totals

3. **Bank Details:**
   - Create employee with bank account
   - Generate payslip
   - Verify bank details included

4. **Breakdown Display:**
   - Get comprehensive payslip
   - Verify earnings breakdown formatted
   - Verify deductions breakdown formatted

5. **Access Control:**
   - Employee views own payslip (should work)
   - Employee views other's payslip (should fail)
   - HR views all payslips (should work)

## Next Steps

1. **Run Database Migration:**
   ```bash
   cd backend
   npx prisma migrate dev --name add_payslip_ytd_totals
   npx prisma generate
   ```

2. **Frontend Implementation:**
   - Payslip display page with breakdown
   - YTD totals display
   - Bank details section
   - PDF generation integration

3. **PDF Generation:**
   - Integrate PDF library (pdfkit/puppeteer)
   - Format payslip as PDF
   - Include all breakdowns and YTD

4. **Email Integration:**
   - Send payslip PDF via email
   - Include breakdown in email body
   - Secure email delivery

## Notes

- YTD totals are calculated from January 1st of the year
- Only includes payslips with status: GENERATED, SENT, or PAID
- Bank details are optional (employee may not have bank account)
- Breakdowns are formatted for easy display in UI
- All calculations respect organization data isolation
