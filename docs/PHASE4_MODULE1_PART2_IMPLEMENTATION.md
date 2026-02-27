# Phase 4 - Module 1 (Part 2): Salary Templates & Employee Salary Assignment

## Implementation Summary

This document covers the implementation of:
1. **Salary Templates** - Predefined salary packages by grade/level
2. **Employee Salary Assignment** - Enhanced with CTC breakdown and revision history

## Database Schema Changes

### New Model: SalaryTemplate

```prisma
model SalaryTemplate {
  id                String           @id
  organizationId    String
  salaryStructureId String
  name              String
  grade             String?          // e.g., "L1", "L2", "Senior", "Junior"
  level             String?          // e.g., "Entry", "Mid", "Senior", "Executive"
  description       String?
  ctc               Decimal           // Cost to Company
  basicSalary       Decimal
  grossSalary       Decimal
  netSalary         Decimal
  components        Json              // Actual component values
  currency          String
  paymentFrequency  PaymentFrequency
  isActive          Boolean
  createdAt         DateTime
  updatedAt         DateTime
}
```

### Enhanced Model: EmployeeSalary

Added fields:
- `salaryTemplateId` - Reference to salary template (optional)
- `endDate` - For revision history tracking
- `ctc` - Cost to Company
- `ctcBreakdown` - Detailed CTC breakdown (JSON)
- `revisionReason` - Reason for salary revision
- `createdBy` - User who created the salary record

## Backend Implementation

### Files Created:

1. **`backend/src/services/salary-template.service.ts`**
   - CRUD operations for salary templates
   - Get templates by grade and level
   - Validation and business logic

2. **`backend/src/controllers/salary-template.controller.ts`**
   - HTTP request handlers for salary templates
   - Endpoints for CRUD operations

### Files Modified:

1. **`backend/prisma/schema.prisma`**
   - Added `SalaryTemplate` model
   - Enhanced `EmployeeSalary` model with new fields
   - Added relations

2. **`backend/src/utils/payroll.validation.ts`**
   - Added validation schemas for salary templates
   - Enhanced employee salary validation with CTC and revision fields

3. **`backend/src/routes/payroll.routes.ts`**
   - Added routes for salary template operations

4. **`backend/src/services/employee-salary.service.ts`**
   - Added `createSalaryEnhanced()` method
   - Added `getSalaryHistory()` method
   - Support for salary template assignment
   - CTC calculation and breakdown
   - Revision history tracking

## API Endpoints

### Salary Templates

#### Create Salary Template
```
POST /api/v1/payroll/salary-templates
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER

Body:
{
  "organizationId": "uuid",
  "salaryStructureId": "uuid",
  "name": "L1 Entry Level",
  "grade": "L1",
  "level": "Entry",
  "description": "Entry level salary package",
  "ctc": 600000,
  "basicSalary": 300000,
  "grossSalary": 500000,
  "netSalary": 450000,
  "components": {...},
  "currency": "USD",
  "paymentFrequency": "MONTHLY",
  "isActive": true
}
```

#### Get All Salary Templates
```
GET /api/v1/payroll/salary-templates?organizationId=uuid&grade=L1&level=Entry
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER, MANAGER
```

#### Get Templates by Grade and Level
```
GET /api/v1/payroll/salary-templates/grade-level?organizationId=uuid&grade=L1&level=Entry
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER, MANAGER
```

#### Get Salary Template by ID
```
GET /api/v1/payroll/salary-templates/:id
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER, MANAGER
```

#### Update Salary Template
```
PUT /api/v1/payroll/salary-templates/:id
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER
```

#### Delete Salary Template
```
DELETE /api/v1/payroll/salary-templates/:id
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER
```

### Enhanced Employee Salary Assignment

#### Create Employee Salary (Enhanced)
```
POST /api/v1/payroll/employee-salaries/enhanced
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER

Body:
{
  "employeeId": "uuid",
  "salaryTemplateId": "uuid",  // Optional: Use template for quick assignment
  "salaryStructureId": "uuid", // Optional: Use structure directly
  "effectiveDate": "2026-01-01",
  "basicSalary": 300000,
  "grossSalary": 500000,
  "netSalary": 450000,
  "ctc": 600000,
  "ctcBreakdown": {
    "grossSalary": 500000,
    "employerPF": 60000,
    "employerESI": 17500,
    "gratuity": 28800,
    "otherBenefits": 13700,
    "totalCTC": 600000
  },
  "revisionReason": "Annual increment",
  "components": {...},
  "currency": "USD",
  "paymentFrequency": "MONTHLY",
  "bankAccountId": "uuid",
  "isActive": true
}
```

#### Get Salary Revision History
```
GET /api/v1/payroll/employee-salaries/history/:employeeId
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER, MANAGER, EMPLOYEE
```

## Features

### Salary Templates

1. **Grade/Level Based**: Templates organized by grade (L1, L2, etc.) and level (Entry, Mid, Senior, Executive)
2. **Reusable**: Quick assignment to multiple employees
3. **Component Combinations**: Pre-configured component values
4. **CTC Included**: Cost to Company calculation included

### Employee Salary Assignment

1. **Template Support**: Can assign salary using templates or structures directly
2. **CTC Breakdown**: Detailed breakdown of Cost to Company including:
   - Gross Salary
   - Employer PF Contribution
   - Employer ESI Contribution
   - Gratuity
   - Other Benefits
   - Total CTC
3. **Revision History**: 
   - Track all salary changes
   - Effective date and end date tracking
   - Revision reason
4. **Automatic History**: When a new salary is assigned, previous active salary is automatically ended

## Next Steps

1. **Run Database Migration**:
   ```bash
   cd backend
   npx prisma migrate dev --name add_salary_templates_and_enhanced_employee_salary
   npx prisma generate
   ```

2. **Frontend Implementation** (Pending):
   - Salary Templates Management Page
   - Employee Salary Assignment Page with Template Selection
   - Salary Revision History View
   - CTC Breakdown Display

3. **Testing**:
   - Create salary templates for different grades/levels
   - Assign salaries using templates
   - Test revision history tracking
   - Verify CTC calculations

## Notes

- Salary templates are linked to salary structures
- When using a template, all component values are copied from the template
- CTC breakdown is automatically calculated if not provided
- Revision history maintains a complete audit trail of salary changes
- Only one active salary per employee at a time
