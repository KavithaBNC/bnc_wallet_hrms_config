# Phase 4 - Module 3: Payroll Run Management

## Implementation Summary

This module implements comprehensive payroll run management with status tracking, lock mechanism, month/year tracking, and rollback capability.

## Features Implemented

### 1. Enhanced Payroll Status

**Status Flow:**
```
DRAFT → PROCESSING → PROCESSED → FINALIZED → PAID
                              ↓
                          CANCELLED
```

**Status Descriptions:**
- **DRAFT**: Initial state, can be edited/deleted
- **PROCESSING**: Payroll is being processed (generating payslips)
- **PROCESSED**: Payroll processing complete, payslips generated
- **FINALIZED**: Payroll finalized and locked (cannot be modified)
- **PAID**: Payment completed, all payslips marked as paid
- **CANCELLED**: Payroll cycle cancelled

### 2. Month/Year Tracking

**Fields Added:**
- `payrollMonth` (1-12): Month of the payroll period
- `payrollYear` (e.g., 2026): Year of the payroll period

**Features:**
- Automatically calculated from `periodStart` date
- Unique constraint: One payroll cycle per organization per month/year
- Enables easy filtering and reporting by month/year
- Prevents duplicate payroll cycles for the same period

### 3. Lock Mechanism

**Fields Added:**
- `isLocked` (boolean): Lock flag to prevent modifications
- `finalizedBy` (UUID): User who finalized the payroll
- `finalizedAt` (DateTime): Timestamp when finalized
- `paidBy` (UUID): User who marked as paid
- `paidAt` (DateTime): Timestamp when marked as paid

**Lock Behavior:**
- Automatically set to `true` when status changes to `FINALIZED`
- Prevents all modifications (update, delete)
- Can only be unlocked via rollback operation
- Locked cycles cannot be edited or deleted

### 4. Rollback Capability

**Functionality:**
- Rollback from `FINALIZED` to `PROCESSED` status
- Unlocks the payroll cycle
- Clears finalizedBy and finalizedAt
- Allows modifications again
- Cannot rollback if already `PAID`

## Database Schema Changes

### Updated PayrollCycle Model

```prisma
model PayrollCycle {
  id              String        @id
  organizationId  String
  name            String
  periodStart     DateTime
  periodEnd       DateTime
  paymentDate     DateTime
  payrollMonth    Int           // 1-12
  payrollYear     Int           // e.g., 2026
  status          PayrollStatus @default(DRAFT)
  isLocked        Boolean       @default(false)
  totalEmployees  Int?
  totalGross      Decimal?
  totalDeductions Decimal?
  totalNet        Decimal?
  approvedBy      String?
  approvedAt      DateTime?
  processedBy     String?
  processedAt     DateTime?
  finalizedBy     String?
  finalizedAt     DateTime?
  paidBy          String?
  paidAt          DateTime?
  notes           String?
  createdAt       DateTime
  updatedAt       DateTime
}

enum PayrollStatus {
  DRAFT
  PROCESSING
  PROCESSED
  FINALIZED
  PAID
  CANCELLED
}
```

### Constraints

- **Unique Constraint:** `@@unique([organizationId, payrollMonth, payrollYear])`
- **Index:** `@@index([organizationId, payrollYear, payrollMonth])`

## API Endpoints

### Finalize Payroll Cycle

```
POST /api/v1/payroll/payroll-cycles/:id/finalize
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER

Response:
{
  "success": true,
  "data": { ...payrollCycle },
  "message": "Payroll cycle finalized and locked successfully"
}
```

**Behavior:**
- Changes status from `PROCESSED` to `FINALIZED`
- Sets `isLocked = true`
- Records `finalizedBy` and `finalizedAt`
- Prevents further modifications

### Rollback Payroll Cycle

```
POST /api/v1/payroll/payroll-cycles/:id/rollback
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER

Response:
{
  "success": true,
  "data": { ...payrollCycle },
  "message": "Payroll cycle rolled back successfully"
}
```

**Behavior:**
- Changes status from `FINALIZED` to `PROCESSED`
- Sets `isLocked = false`
- Clears `finalizedBy` and `finalizedAt`
- Allows modifications again

### Mark as Paid (Updated)

```
POST /api/v1/payroll/payroll-cycles/:id/mark-paid
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER

Response:
{
  "success": true,
  "data": { ...payrollCycle },
  "message": "Payroll cycle marked as paid successfully"
}
```

**Behavior:**
- Can only be called if status is `FINALIZED`
- Changes status to `PAID`
- Records `paidBy` and `paidAt`
- Updates all payslips to `PAID` status

### Query by Month/Year

```
GET /api/v1/payroll/payroll-cycles?organizationId=uuid&payrollMonth=1&payrollYear=2026
Authorization: Bearer <token>
Roles: ORG_ADMIN, HR_MANAGER, MANAGER
```

## Status Transition Rules

### Allowed Transitions:

1. **DRAFT → PROCESSING**
   - When processing starts
   - Automatic during `processPayrollCycle()`

2. **PROCESSING → PROCESSED**
   - When processing completes
   - Automatic after payslips are generated

3. **PROCESSED → FINALIZED**
   - Manual action via `finalizePayrollCycle()`
   - Locks the cycle

4. **FINALIZED → PROCESSED**
   - Manual rollback via `rollbackPayrollCycle()`
   - Unlocks the cycle

5. **FINALIZED → PAID**
   - Manual action via `markAsPaid()`
   - Final state

6. **Any → CANCELLED**
   - Can cancel at any stage (except PAID)
   - Requires special handling

### Blocked Operations:

- **Update:** Blocked if `isLocked = true` or status is `FINALIZED`/`PAID`
- **Delete:** Blocked if `isLocked = true` or status is not `DRAFT`
- **Finalize:** Only allowed if status is `PROCESSED`
- **Rollback:** Only allowed if status is `FINALIZED` (not `PAID`)
- **Mark Paid:** Only allowed if status is `FINALIZED`

## Usage Examples

### Example 1: Complete Payroll Run Flow

```javascript
// 1. Create payroll cycle
POST /api/v1/payroll/payroll-cycles
{
  "organizationId": "uuid",
  "name": "January 2026 Payroll",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "paymentDate": "2026-02-05"
}
// Status: DRAFT, payrollMonth: 1, payrollYear: 2026

// 2. Process payroll
POST /api/v1/payroll/payroll-cycles/:id/process
{
  "taxRegime": "NEW"
}
// Status: PROCESSING → PROCESSED

// 3. Review and finalize
POST /api/v1/payroll/payroll-cycles/:id/finalize
// Status: FINALIZED, isLocked: true

// 4. Mark as paid (after payment)
POST /api/v1/payroll/payroll-cycles/:id/mark-paid
// Status: PAID
```

### Example 2: Rollback Scenario

```javascript
// Payroll is finalized but needs correction
POST /api/v1/payroll/payroll-cycles/:id/rollback
// Status: PROCESSED, isLocked: false

// Make corrections
PUT /api/v1/payroll/payroll-cycles/:id
{
  "notes": "Corrected employee count"
}

// Re-process if needed
POST /api/v1/payroll/payroll-cycles/:id/process

// Finalize again
POST /api/v1/payroll/payroll-cycles/:id/finalize
```

### Example 3: Query by Month/Year

```javascript
// Get all payroll cycles for January 2026
GET /api/v1/payroll/payroll-cycles?organizationId=uuid&payrollMonth=1&payrollYear=2026

// Get all payroll cycles for 2026
GET /api/v1/payroll/payroll-cycles?organizationId=uuid&payrollYear=2026
```

## Files Modified

### Schema:
- **`backend/prisma/schema.prisma`**
  - Updated `PayrollStatus` enum (added PROCESSED, FINALIZED)
  - Added `payrollMonth`, `payrollYear` fields
  - Added `isLocked`, `finalizedBy`, `finalizedAt`, `paidBy`, `paidAt` fields
  - Added unique constraint and index

### Services:
- **`backend/src/services/payroll.service.ts`**
  - Updated `create()` to calculate and set month/year
  - Updated `getAll()` to filter by month/year
  - Updated `update()` to check lock status
  - Updated `processPayrollCycle()` to set status to PROCESSED
  - Added `finalizePayrollCycle()` method
  - Added `rollbackPayrollCycle()` method
  - Updated `markAsPaid()` to require FINALIZED status
  - Updated `delete()` to check lock status

### Controllers:
- **`backend/src/controllers/payroll.controller.ts`**
  - Added `finalizePayrollCycle()` method
  - Added `rollbackPayrollCycle()` method
  - Updated `markAsPaid()` to pass userId

### Routes:
- **`backend/src/routes/payroll.routes.ts`**
  - Added `POST /payroll-cycles/:id/finalize` route
  - Added `POST /payroll-cycles/:id/rollback` route

### Validation:
- **`backend/src/utils/payroll.validation.ts`**
  - Updated `updatePayrollCycleSchema` with new statuses
  - Updated `queryPayrollCyclesSchema` with month/year filters

## Migration Required

**Important:** Before using these features, run the database migration:

```bash
cd backend
npx prisma migrate dev --name add_payroll_run_management
npx prisma generate
```

This will:
- Add new fields to `payroll_cycles` table
- Update `PayrollStatus` enum
- Create unique constraint and index
- Generate TypeScript types

## Security & Access Control

### Role Permissions:

- **ORG_ADMIN, HR_MANAGER:**
  - Create, update, delete payroll cycles
  - Process payroll
  - Finalize payroll
  - Rollback payroll
  - Mark as paid

- **MANAGER:**
  - View payroll cycles
  - View payslips

- **EMPLOYEE:**
  - View own payslips only

### Lock Enforcement:

- Locked cycles cannot be:
  - Updated
  - Deleted
  - Reprocessed (without rollback first)

## Audit Trail

The system tracks:
- **Who processed:** `processedBy`, `processedAt`
- **Who finalized:** `finalizedBy`, `finalizedAt`
- **Who paid:** `paidBy`, `paidAt`
- **When created:** `createdAt`
- **When updated:** `updatedAt`

## Best Practices

1. **Always Finalize Before Payment:**
   - Finalize payroll after review
   - Prevents accidental modifications
   - Ensures data integrity

2. **Use Rollback Sparingly:**
   - Only rollback if corrections are needed
   - Re-process after rollback if data changed
   - Document reason for rollback

3. **Month/Year Tracking:**
   - System automatically sets month/year
   - Use for reporting and reconciliation
   - Prevents duplicate cycles

4. **Status Management:**
   - Follow the status flow strictly
   - Don't skip statuses
   - Use FINALIZED as checkpoint before payment

## Testing Scenarios

1. **Create and Process:**
   - Create payroll cycle
   - Verify month/year set correctly
   - Process payroll
   - Verify status: PROCESSED

2. **Finalize and Lock:**
   - Finalize payroll cycle
   - Verify isLocked = true
   - Try to update (should fail)
   - Try to delete (should fail)

3. **Rollback:**
   - Rollback finalized cycle
   - Verify isLocked = false
   - Verify can update again
   - Re-process if needed

4. **Mark as Paid:**
   - Finalize first
   - Mark as paid
   - Verify status: PAID
   - Verify all payslips marked as paid

5. **Month/Year Filtering:**
   - Create cycles for different months
   - Query by month/year
   - Verify correct filtering

6. **Duplicate Prevention:**
   - Try to create duplicate month/year
   - Verify error thrown
   - Verify unique constraint works

## Next Steps

1. **Run Database Migration:**
   ```bash
   cd backend
   npx prisma migrate dev --name add_payroll_run_management
   npx prisma generate
   ```

2. **Frontend Implementation:**
   - Add finalize button in PayrollPage
   - Add rollback button (with confirmation)
   - Show lock status indicator
   - Display month/year in cycle list
   - Add month/year filters

3. **Reporting:**
   - Monthly payroll reports
   - Yearly payroll summary
   - Status-wise cycle reports
   - Audit trail reports

## Notes

- Lock mechanism provides data integrity
- Month/year tracking enables easy reporting
- Rollback allows corrections before payment
- Status flow ensures proper workflow
- All operations are audited with user tracking
