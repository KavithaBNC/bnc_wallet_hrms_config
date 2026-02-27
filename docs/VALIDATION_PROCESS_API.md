# Validation Process – Backend API & Data Flow

## 1. Database: `attendance_validation_results`

Stores **per-employee-per-day** validation flags after each Process run.

### Table (Prisma / SQL)

```sql
CREATE TABLE "attendance_validation_results" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "employee_id" UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    "date" DATE NOT NULL,
    "is_completed" BOOLEAN NOT NULL,
    "is_approval_pending" BOOLEAN NOT NULL,
    "is_late" BOOLEAN NOT NULL,
    "is_early_going" BOOLEAN NOT NULL,
    "is_absent" BOOLEAN NOT NULL,
    "is_no_out_punch" BOOLEAN NOT NULL,
    "is_shift_change" BOOLEAN NOT NULL,
    "is_overtime" BOOLEAN NOT NULL,
    "is_shortfall" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    UNIQUE("organization_id", "employee_id", "date")
);
CREATE INDEX ON attendance_validation_results(organization_id, date);
```

### Aggregation (day-wise counts)

Counts are derived by summing these booleans per date:

- `completed_count` = SUM(is_completed)
- `approval_pending_count` = SUM(is_approval_pending)
- `late_count` = SUM(is_late)
- `early_going_count` = SUM(is_early_going)
- `absent_count` = SUM(is_absent)
- `no_out_punch_count` = SUM(is_no_out_punch)
- `shift_change_count` = SUM(is_shift_change)
- `overtime_count` = SUM(is_overtime)
- `shortfall_count` = SUM(is_shortfall)

---

## 2. API Routes

### POST `/api/v1/attendance/validation-process/run`

Runs the full validation process and returns aggregated day-wise data.

**Auth:** `SUPER_ADMIN`, `ORG_ADMIN`, `HR_MANAGER`

**Body (JSON):**

```json
{
  "organizationId": "uuid",
  "paygroupId": "uuid or null",
  "employeeId": "uuid or null",
  "fromDate": "2026-02-01",
  "toDate": "2026-02-28"
}
```

**Behavior:**

1. Resolve employee IDs (by `organizationId` + optional `paygroupId` / `employeeId`).
2. Load attendance records and PENDING regularizations for those employees in `[fromDate, toDate]`.
3. For each record, set: late, early going, absent, no out punch, shift change, overtime, shortfall, completed, approval pending.
4. Delete existing `attendance_validation_results` for (org, those employees, date range).
5. Insert new rows into `attendance_validation_results`.
6. Aggregate by date and return `{ daily }`.

**Sample response:**

```json
{
  "status": "success",
  "data": {
    "daily": {
      "2026-02-01": {
        "completed": 120,
        "approvalPending": 4,
        "late": 2,
        "earlyGoing": 3,
        "noOutPunch": 1,
        "shiftChange": 2,
        "absent": 1,
        "shortfall": 0,
        "overtime": 8
      },
      "2026-02-02": { ... }
    }
  }
}
```

---

### GET `/api/v1/attendance/validation-process/calendar-summary`

Returns **stored** aggregated day-wise counts (no re-run).

**Auth:** `SUPER_ADMIN`, `ORG_ADMIN`, `HR_MANAGER`

**Query:**

- `organizationId` (required)
- `fromDate`, `toDate` (required)
- `paygroupId`, `employeeId` (optional)

**Response shape:** Same as `data` in the POST response above (`{ daily: { [dateKey]: ValidationDaySummary } }`).

---

## 3. Service Layer (backend)

- **`attendanceService.runValidationProcess(params)`**  
  Fetches employees → attendance + regularizations → applies rules → delete old results for (org, employees, range) → `createMany` into `attendance_validation_results` → calls `getValidationProcessAggregatedFromStore` → returns `{ daily }`.

- **`attendanceService.getValidationProcessAggregatedFromStore(params)`**  
  Reads `attendance_validation_results` for (organizationId, employeeIds, from–to), aggregates by date, returns `Record<dateKey, ValidationDaySummary>`.

- **`attendanceService.getValidationProcessCalendarSummary(params)`**  
  Resolves employee IDs from filters, then `getValidationProcessAggregatedFromStore` (used by GET calendar-summary).

---

## 4. Validation Rules (per record)

- **Completed:** PRESENT, has check-in & check-out, no pending regularization, not late/early/deviation.
- **Approval Pending:** Exists a PENDING regularization for that employee+date.
- **Late / Early Going / No Out Punch / Absent / Shortfall / Overtime:** From `AttendanceRecord` (`isLate`, `isEarly`, missing checkOut, `status`, `isDeviation`, `otMinutes`/`overtimeHours`).
- **Shift Change:** Record’s `shiftId` ≠ employee’s default `shiftId`.

---

## 5. Frontend

- **Process button:** Calls `POST /attendance/validation-process/run` with current filters and date range; updates calendar state from `data.daily`.
- **Calendar:** Renders each day from `dailySummary[dateKey]` with counts; color coding:
  - Green tint: only completed.
  - Red tint: any anomaly, no completed.
  - Amber tint: both completed and anomalies.

Apply migration before using:

```bash
cd backend && npx prisma migrate deploy
```
