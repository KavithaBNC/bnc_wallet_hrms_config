# Phase 4 - Module 1: Salary Structure Management

## Implementation Summary

This module implements comprehensive salary structure management with predefined earnings and deduction components, supporting multiple calculation types and tax/statutory configurations.

## Features Implemented

### 1. Predefined Salary Components

#### Earnings Components:
- **Basic Salary** (BASIC) - Mandatory, Taxable, Fixed
- **House Rent Allowance (HRA)** - Taxable, Percentage-based (default 40% of Basic)
- **Transport Allowance** - Taxable, Fixed
- **Special Allowance** - Taxable, Fixed
- **Bonus** - Taxable, Fixed
- **Medical Allowance** - Non-taxable, Fixed
- **Food Allowance** - Non-taxable, Fixed
- **Overtime** - Taxable, Formula-based

#### Deduction Components:
- **Provident Fund (PF)** - Statutory, Percentage-based (default 12% of Basic+DA)
- **Employee State Insurance (ESI)** - Statutory, Percentage-based (default 0.75% of Gross)
- **Professional Tax** - Statutory, Fixed (varies by state)
- **Income Tax / TDS** - Statutory, Formula-based
- **Labour Welfare Fund (LWF)** - Statutory, Fixed
- **Loan Deduction** - Non-statutory, Fixed
- **Other Deduction** - Non-statutory, Fixed

### 2. Component Calculation Types

1. **FIXED**: Fixed amount (e.g., Transport Allowance: ₹2000)
2. **PERCENTAGE**: Percentage of a base component (e.g., HRA: 40% of Basic Salary)
3. **FORMULA**: Calculated using a formula (e.g., Overtime: `overtimeHours * hourlyRate * 1.5`)

### 3. Component Properties

- **Taxable vs Non-taxable**: Determines if earnings are subject to income tax
- **Statutory vs Non-statutory**: Identifies government-mandated deductions
- **Base Component**: For percentage calculations, specifies which component to calculate from
- **Formula**: For formula-based calculations, defines the calculation logic

## Backend Implementation

### Files Created/Modified:

1. **`backend/src/utils/salary-components.ts`** (NEW)
   - Predefined component constants
   - Helper functions for component calculations
   - Validation utilities
   - Gross salary, deductions, and net salary calculators

2. **`backend/src/utils/payroll.validation.ts`** (ENHANCED)
   - Enhanced `salaryComponentSchema` with:
     - `code` field for component identification
     - `baseComponent` for percentage calculations
     - `description` field
     - Improved validation rules

3. **`backend/src/services/salary-structure.service.ts`** (ENHANCED)
   - Uses component validation helpers
   - Ensures BASIC earning component exists
   - Better error messages

4. **`backend/src/controllers/salary-structure.controller.ts`** (ENHANCED)
   - New endpoint: `GET /api/v1/payroll/salary-components`
   - Returns predefined earnings and deductions

5. **`backend/src/routes/payroll.routes.ts`** (ENHANCED)
   - Added route for predefined components endpoint

## Frontend Implementation

### Files Created/Modified:

1. **`frontend/src/pages/SalaryStructurePage.tsx`** (NEW)
   - Complete UI for managing salary structures
   - Predefined component selection
   - Component configuration (calculation type, value, tax/statutory flags)
   - Create, view, and delete salary structures

2. **`frontend/src/services/payroll.service.ts`** (ENHANCED)
   - Added `PredefinedComponent` interface
   - Enhanced `SalaryComponent` interface with new fields
   - Added `getPredefinedComponents()` method

3. **`frontend/src/App.tsx`** (ENHANCED)
   - Added route: `/salary-structures`

## API Endpoints

### Get Predefined Components
```
GET /api/v1/payroll/salary-components
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER, MANAGER

Response:
{
  "success": true,
  "data": {
    "earnings": [...],
    "deductions": [...]
  }
}
```

### Create Salary Structure
```
POST /api/v1/payroll/salary-structures
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER

Body:
{
  "organizationId": "uuid",
  "name": "Standard Salary Structure",
  "description": "Standard structure for all employees",
  "components": [
    {
      "name": "Basic Salary",
      "code": "BASIC",
      "type": "EARNING",
      "calculationType": "FIXED",
      "value": 50000,
      "isTaxable": true,
      "isStatutory": false
    },
    {
      "name": "House Rent Allowance",
      "code": "HRA",
      "type": "EARNING",
      "calculationType": "PERCENTAGE",
      "value": 40,
      "baseComponent": "BASIC",
      "isTaxable": true,
      "isStatutory": false
    },
    {
      "name": "Provident Fund",
      "code": "PF",
      "type": "DEDUCTION",
      "calculationType": "PERCENTAGE",
      "value": 12,
      "baseComponent": "BASIC",
      "isTaxable": false,
      "isStatutory": true
    }
  ],
  "isActive": true
}
```

## Usage Guide

### Creating a Salary Structure

1. Navigate to `/salary-structures` (accessible to ORG_ADMIN and HR_MANAGER)
2. Click "+ Create Salary Structure"
3. Enter structure name and description
4. Add components:
   - Click on predefined earnings/deductions to add them
   - Configure each component:
     - Calculation type (Fixed/Percentage/Formula)
     - Value (amount or percentage)
     - Base component (for percentage calculations)
     - Taxable/Statutory flags
5. Ensure at least one BASIC earning component exists
6. Click "Create Structure"

### Component Configuration Examples

**Fixed Component:**
```json
{
  "name": "Transport Allowance",
  "code": "TRANSPORT",
  "type": "EARNING",
  "calculationType": "FIXED",
  "value": 2000,
  "isTaxable": true,
  "isStatutory": false
}
```

**Percentage Component:**
```json
{
  "name": "House Rent Allowance",
  "code": "HRA",
  "type": "EARNING",
  "calculationType": "PERCENTAGE",
  "value": 40,
  "baseComponent": "BASIC",
  "isTaxable": true,
  "isStatutory": false
}
```

**Formula Component:**
```json
{
  "name": "Overtime",
  "code": "OVERTIME",
  "type": "EARNING",
  "calculationType": "FORMULA",
  "value": 0,
  "formula": "overtimeHours * hourlyRate * 1.5",
  "isTaxable": true,
  "isStatutory": false
}
```

## Validation Rules

1. At least one component is required
2. At least one BASIC earning component must exist
3. Percentage values cannot exceed 100%
4. Formula is required for FORMULA calculation type
5. Base component is required for PERCENTAGE calculation type
6. Component codes must be unique within a structure

## Next Steps

This module provides the foundation for:
- **Module 2**: Employee Salary Assignment (assigning salary structures to employees)
- **Module 3**: Payroll Processing (using salary structures to calculate payslips)
- **Module 4**: Tax Configuration (configuring tax rules for taxable components)
- **Module 5**: Statutory Compliance (managing statutory deductions)

## Testing

1. **Backend Testing:**
   ```bash
   cd backend
   npm run build  # Should compile without errors
   ```

2. **Frontend Testing:**
   - Start the frontend server
   - Log in as ORG_ADMIN or HR_MANAGER
   - Navigate to `/salary-structures`
   - Create a new salary structure with various components
   - Verify validation works correctly

3. **API Testing:**
   ```bash
   # Get predefined components
   curl -X GET http://localhost:5000/api/v1/payroll/salary-components \
     -H "Authorization: Bearer <token>"
   ```

## Notes

- All predefined components have default values that can be customized
- Formula-based calculations require a formula parser (to be implemented in payroll processing)
- Statutory deductions may vary by country/region (currently supports common Indian deductions)
- Taxable components are used to calculate taxable income for tax computation
