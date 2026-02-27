# Monthly Attendance Summary – Design & Implementation

This document describes the **Monthly Attendance Summary** module: database schema, backend logic, rule-application flow, validation/locking, and payroll integration.

---

## 1. Overview

The Monthly Attendance Summary:

- **Collects** daily data from the attendance calendar (`AttendanceRecord` + approved `LeaveRequest`).
- **Applies** the same rules as payroll (present/half/holiday/approved leave → paid; absent/unpaid leave → LOP).
- **Respects** approval workflows (only **APPROVED** leave requests are counted).
- **Stores** a roll-up per employee per month with Present, Absent, Leave, LOP, OT, Paid Days, and leave-type breakdown.
- **Supports** DRAFT → FINALIZED → LOCKED lifecycle and **month-level locking** so closed months cannot be edited.
- **Integrates** with payroll: when a month is finalized/locked and the payroll period is that calendar month, payroll uses the summary instead of recalculating from raw records.

---

## 2. Database Schema

### 2.1 Tables

**`monthly_attendance_summaries`**

| Column                | Type     | Description                                      |
|-----------------------|----------|--------------------------------------------------|
| id                    | UUID     | PK                                               |
| organization_id        | UUID     | FK → organizations                               |
| employee_id            | UUID     | FK → employees                                   |
| year                   | INTEGER  | e.g. 2026                                        |
| month                  | INTEGER  | 1–12                                             |
| present_days           | INTEGER  | Count of PRESENT                                 |
| absent_days            | INTEGER  | Count of ABSENT                                  |
| leave_days             | DECIMAL  | Total leave days (paid + unpaid)                  |
| lop_days               | DECIMAL  | Absent + unpaid leave (for LOP calculation)      |
| half_days              | INTEGER  | Count of HALF_DAY                                |
| holiday_days           | INTEGER  | Count of HOLIDAY                                 |
| weekend_days           | INTEGER  | Count of WEEKEND                                 |
| overtime_hours         | DECIMAL  | Sum of OT hours                                  |
| paid_days               | DECIMAL  | Computed paid days (capped by total working days) |
| total_working_days      | INTEGER  | Working days in month (excl. weekends)          |
| status                 | ENUM     | DRAFT \| FINALIZED \| LOCKED                     |
| finalized_at / finalized_by | TIMESTAMP, UUID | When/who finalized        |
| locked_at / locked_by   | TIMESTAMP, UUID | When/who locked (on month lock)        |
| created_at / updated_at| TIMESTAMP | Audit                                            |

- **Unique:** `(organization_id, employee_id, year, month)`  
- **Indexes:** `(organization_id, year, month)`, `(employee_id, year, month)`.

**`monthly_attendance_summary_leaves`**

| Column       | Type    | Description                    |
|--------------|---------|--------------------------------|
| id           | UUID    | PK                             |
| summary_id   | UUID    | FK → monthly_attendance_summaries |
| leave_type_id| UUID    | FK → leave_types               |
| days         | DECIMAL | Days used for this leave type  |
| is_paid      | BOOLEAN | Paid vs unpaid leave           |

- **Unique:** `(summary_id, leave_type_id)` – one row per leave type per summary.

**`monthly_attendance_locks`**

| Column          | Type      | Description              |
|-----------------|-----------|--------------------------|
| id              | UUID      | PK                       |
| organization_id | UUID      | FK → organizations        |
| year            | INTEGER   |                          |
| month           | INTEGER   | 1–12                     |
| locked_at       | TIMESTAMP | When locked              |
| locked_by       | UUID      | User who locked          |
| remarks         | TEXT      | Optional                 |

- **Unique:** `(organization_id, year, month)` – one lock per org per month.

### 2.2 Sample Queries

**List all summaries for a month (with employee and leave breakdown):**

```sql
SELECT s.*, e.employee_code, e.first_name, e.last_name,
       json_agg(
         json_build_object('leave_type', lt.name, 'days', l.days, 'is_paid', l.is_paid)
       ) FILTER (WHERE l.id IS NOT NULL) AS leave_breakdown
FROM monthly_attendance_summaries s
JOIN employees e ON e.id = s.employee_id
LEFT JOIN monthly_attendance_summary_leaves l ON l.summary_id = s.id
LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
WHERE s.organization_id = :orgId AND s.year = :year AND s.month = :month
GROUP BY s.id, e.employee_code, e.first_name, e.last_name
ORDER BY e.employee_code;
```

**Check if a month is locked:**

```sql
SELECT id, locked_at, locked_by FROM monthly_attendance_locks
WHERE organization_id = :orgId AND year = :year AND month = :month;
```

**Summaries ready for payroll (finalized or locked):**

```sql
SELECT * FROM monthly_attendance_summaries
WHERE organization_id = :orgId AND year = :year AND month = :month
  AND status IN ('FINALIZED', 'LOCKED')
ORDER BY employee_id;
```

---

## 3. Backend Logic & API

### 3.1 Service: `MonthlyAttendanceSummaryService`

- **`buildSummaryForEmployee({ organizationId, employeeId, year, month })`**  
  - If month is locked → 403.  
  - Load attendance (from `AttendanceRecord`) and approved leaves (from `LeaveRequest`) for that month.  
  - Compute present/absent/half/holiday/weekend/OT, total working days, paid days, LOP days.  
  - Build leave breakdown by leave type.  
  - Upsert `MonthlyAttendanceSummary` and replace `monthly_attendance_summary_leaves`.

- **`buildMonthForOrganization(organizationId, year, month)`**  
  - If month is locked → 403.  
  - For each active employee (in org, not deleted, joined before end of month), call `buildSummaryForEmployee`.  
  - Returns counts of success/failure per employee.

- **`list({ organizationId, year, month, employeeId?, status?, page, limit })`**  
  - Paginated list of summaries with employee and leave breakdown.

- **`getById(id)`**  
  - Single summary by id (404 if not found).

- **`finalize(id, finalizedBy)`**  
  - DRAFT → FINALIZED; set finalizedAt/finalizedBy. Rejects if not DRAFT or if month is locked.

- **`lockMonth(organizationId, year, month, lockedBy?, remarks?)`**  
  - Create `MonthlyAttendanceLock` and set all summaries for that org/year/month to LOCKED and set lockedAt/lockedBy.

- **`isMonthLocked(organizationId, year, month)`**  
  - True if a lock exists for that org/month.

- **`getMonthLock(organizationId, year, month)`**  
  - Returns the lock record or null.

### 3.2 Rule-Application Flow

1. **Data sources**  
   - **Attendance:** `AttendanceRecord` for the month (status: PRESENT, ABSENT, HALF_DAY, HOLIDAY, WEEKEND).  
   - **Leaves:** `LeaveRequest` with `status = APPROVED` overlapping the month (approval workflow is respected).

2. **Calculations** (aligned with payroll):  
   - Working days: calendar days in month excluding weekends.  
   - Paid days: present + 0.5×half + paid leave + holiday, capped by total working days.  
   - LOP days: absent + unpaid leave days.

3. **Event configuration**  
   - Current implementation uses the same logic as payroll (status + approved leaves).  
   - Event Configuration (Attendance Components, Rule Settings, Rights Allocation, Workflow Mapping, Approval Workflow) already controls which leave requests are approved; only approved leaves are included.  
   - You can later extend the engine to resolve “event type” (EL/SL/CL/LOP/OT) per day from Rule Setting/Rights Allocation by employee paygroup/department and map to these aggregates.

### 3.3 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/v1/monthly-attendance-summary/build` | Build one employee’s summary (body: organizationId, employeeId, year, month) |
| POST   | `/api/v1/monthly-attendance-summary/build-month` | Build all employees for a month (body: organizationId, year, month) |
| GET    | `/api/v1/monthly-attendance-summary?organizationId=&year=&month=&employeeId=&status=&page=&limit=` | List summaries |
| GET    | `/api/v1/monthly-attendance-summary/lock?organizationId=&year=&month=` | Get month lock |
| GET    | `/api/v1/monthly-attendance-summary/:id` | Get summary by id |
| PUT    | `/api/v1/monthly-attendance-summary/:id/finalize` | Finalize summary |
| POST   | `/api/v1/monthly-attendance-summary/lock-month` | Lock month (body: organizationId, year, month, remarks?) |

All require authentication; build/finalize/lock require appropriate HR/Admin roles.

---

## 4. Validation and Locking

- **Build/update:** Not allowed if `MonthlyAttendanceLock` exists for that organization and month.  
- **Finalize:** Allowed only for DRAFT; not allowed if month is locked.  
- **Lock month:** Creates lock and sets all that month’s summaries to LOCKED; no further builds or finalizes for that month.  
- **Idempotent:** Building again (before lock) overwrites DRAFT or recomputes from calendar; existing FINALIZED/LOCKED rows are preserved when the month is locked (no overwrite once locked).

---

## 5. Payroll Integration

In **`PayrollService.processPayrollCycle`**:

1. For each employee, instead of always calling `getAttendanceData` and `getLeaveData`, the service calls **`getAttendanceAndLeaveForPeriod`**.
2. **`getAttendanceAndLeaveForPeriod`**:
   - If the payroll period is the **full calendar month** (periodStart = 1st, periodEnd = last day of that month) and a **FINALIZED or LOCKED** `MonthlyAttendanceSummary` exists for that employee and month, it returns attendance and leave data from the summary (including leave breakdown).
   - Otherwise it falls back to existing `getAttendanceData` + `getLeaveData` (raw records).

So:

- **With summary:** Payroll uses one consistent, finalized snapshot for that month.  
- **Without summary or different period:** Behavior is unchanged (live calendar + approved leaves).

---

## 6. Migration and Run

**Apply migration:**

```bash
cd backend
npx prisma migrate deploy
# or for dev: npx prisma migrate dev --name add_monthly_attendance_summary
```

**Generate client (if needed):**

```bash
npx prisma generate
```

**Typical flow:**

1. Build summaries for the month: `POST .../build-month` with `organizationId`, `year`, `month`.  
2. Review in list/detail APIs.  
3. Finalize individual summaries or keep as DRAFT until ready.  
4. Lock the month when closing: `POST .../lock-month`.  
5. Run payroll for that month; payroll will use the finalized/locked summary when the period is that full calendar month.

---

## 7. Scalability and Maintainability

- **Schema:** Single row per employee per month; leave breakdown in a separate table to avoid wide rows and to support payroll/audit.  
- **Lock:** One lock per org per month keeps logic simple and avoids partial locks.  
- **Payroll:** Optional use of summary keeps backward compatibility; full-month check avoids mixing summary and raw data in the same period.  
- **Extensibility:** Rule-application can be extended to use Rule Setting/Rights Allocation/Workflow Mapping to derive event types (EL/SL/CL/LOP/OT) per day and then aggregate into the same summary fields without changing the summary table shape.

This gives you a single place to collect, validate, and lock monthly attendance and to feed payroll with consistent, finalized numbers.
