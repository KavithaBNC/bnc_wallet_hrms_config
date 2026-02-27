# Event Configuration Flags – Backend Usage

This document describes how **AttendanceComponent** (event) configuration options are used in backend logic, where they are checked, and how they integrate with Rule Setting, Rights Allocation, Employee Assignment, and Monthly Attendance.

## 1. Where the flags live

Flags are stored on **`attendance_components`** (model `AttendanceComponent` in Prisma):

| Flag | DB column | Requirement |
|------|-----------|-------------|
| Authorized | `authorized` | Controls whether the event is treated as authorized (e.g. for payroll / reporting). |
| Has Balance | `has_balance` | If **NO** → system does **not** maintain balance for this event. |
| Allow Auto Credit Rule | `allow_auto_credit_rule` | If **NO** → auto credit does **not** run for this event. |
| Allow Hourly | `allow_hourly` | If **NO** → hourly/half-day option must be hidden and backend rejects fractional days. |
| Allow WeekOff / Holiday | `allow_week_off_selection`, `allow_holiday_selection` | If **NO** → applying leave on weekend/holiday is blocked. |
| Applicable for Regularization | `applicable_for_regularization` | If **NO** → this event must not be offered in regularization (e.g. “mark as leave type”). |
| Allow Datewise | `allow_datewise` | If **NO** → date-wise entry for this event can be restricted (UI/API). |

Linking to **LeaveType**: there is no FK. Matching is by **same organization** and:

- `attendance_components.event_name` ≈ `leave_types.name` (case-insensitive), or  
- `attendance_components.short_name` ≈ `leave_types.code` (case-insensitive).

Utility: **`backend/src/utils/event-config.ts`** – `getAttendanceComponentForLeaveType(organizationId, leaveType)`.

---

## 2. Where each flag is checked (API / service layer)

### Has Balance = NO

- **Leave balance**
  - **File**: `backend/src/services/leave-balance.service.ts`
  - **When**: On **get balance** (and when creating initial balances).
  - **Logic**: Only **create** `EmployeeLeaveBalance` rows for leave types whose event config has **`has_balance = true`** (via `getLeaveTypeIdsWithBalance()`). Leave types with **Has Balance = NO** never get a balance row.
- **Leave request – apply**
  - **File**: `backend/src/services/leave-request.service.ts` → `create()`
  - **Logic**: If the event config has **Has Balance = NO**, **skip** balance check (no “insufficient balance” validation).
- **Leave request – approve**
  - **File**: `backend/src/services/leave-request.service.ts` → `approve()`
  - **Logic**: If **Has Balance = NO**, **do not** deduct from balance (skip `EmployeeLeaveBalance` update).

### Allow Auto Credit Rule = NO

- **Auto credit entitlement**
  - **File**: `backend/src/utils/auto-credit-entitlement.ts` → `getEntitlementForEmployeeAndLeaveType()`
  - **Logic**: If the event config has **`allowAutoCreditRule = false`**, return **defaultDaysPerYear** (or 0) and **do not** use any Auto Credit setting for that leave type.
- **Leave balance – initial creation**
  - **File**: `backend/src/services/leave-balance.service.ts`
  - **Logic**: When creating initial balances, entitlement from **Auto Credit** is applied **only** for leave types whose event config has **Allow Auto Credit Rule = YES** (`getLeaveTypeIdsWithAutoCreditAllowed()`). Others use `defaultDaysPerYear` only.

So: **If Allow Auto Credit Rule = NO → auto credit does not run for that event.**

### Allow Hourly = NO

- **Leave request – create**
  - **File**: `backend/src/services/leave-request.service.ts` → `create()`
  - **Logic**: If the request is **hourly/half-day** (e.g. `totalDays < 1` or fractional, or optional `totalDays` in body like `0.5`), and the event config has **`allowHourly = false`** → **400**: “This leave type does not allow hourly or half-day leave.”
- **Frontend**: When **Allow Hourly = NO**, hide half-day/hourly option and do not send fractional `totalDays`.

### Allow WeekOff / Holiday = NO

- **Leave request – create**
  - **File**: `backend/src/services/leave-request.service.ts` → `create()`
  - **Logic**: For each date in `[startDate, endDate]`:
    - If **`allowWeekOffSelection = false`** and date is **weekend** → **400** with message that this leave type cannot be applied on week-offs.
    - If **`allowHolidaySelection = false`** and date is **holiday** (from `holidays` table for the org) → **400** with message that this leave type cannot be applied on holidays.

### Applicable for Regularization = NO

- **Current backend**: Regularization is **check-in/check-out correction** only; there is no “event type” on the request. So there is **no server-side check** yet when creating a regularization.
- **Where to enforce**: When you add “regularization with event” (e.g. “mark absent as Leave type X”):
  - **API**: When listing events for regularization dropdown, filter by **`applicable_for_regularization = true`** (e.g. use a helper that returns only such components).
  - **Service**: When creating/updating a regularization that sets an event/leave type, **reject** if the chosen event has **Applicable for Regularization = NO**.
- **Helper**: You can add in `event-config.ts` something like `getComponentsApplicableForRegularization(organizationId)` that returns components where `applicableForRegularization === true`.

### Allow Datewise

- Use in **API/validation** when you have date-wise entry (e.g. one row per date). If **Allow Datewise = NO**, reject or hide date-wise entry for that event (exact place depends on your API design).

### Authorized

- Use in **payroll / monthly attendance / reporting** to classify days (e.g. only “authorized” leave/absence types count in a certain way). Hook into payroll engine or monthly summary where you map event type to “authorized” vs “unauthorized”.

---

## 3. Validating flags when applying leave (API flow)

**Leave apply flow (create leave request):**

1. **Input**: `leaveTypeId`, `startDate`, `endDate`, optional `totalDays` (for half-day e.g. `0.5`), `reason`, etc.
2. **Resolve event config**:  
   `component = getAttendanceComponentForLeaveType(organizationId, leaveType)`  
   (LeaveType from DB by `leaveTypeId`.)
3. **Allow Hourly**:  
   If `totalDays < 1` or fractional → require `component.allowHourly === true`; else **400**.
4. **Allow WeekOff / Holiday**:  
   For each day in `[startDate, endDate]`:
   - If weekend and `!component.allowWeekOffSelection` → **400**.
   - If holiday and `!component.allowHolidaySelection` → **400**.
5. **Has Balance**:  
   If `component?.hasBalance === false` → **skip** balance fetch and balance check.  
   Else → get/create balance, then **check** `totalDays <= available` (and `!leaveType.canBeNegative`).
6. **Create** `LeaveRequest` with computed `totalDays`.

**Leave approve flow:**

1. Load leave request + employee + leaveType.
2. `component = getAttendanceComponentForLeaveType(organizationId, leaveType)`.
3. If `component?.hasBalance === false` → **do not** update `EmployeeLeaveBalance**.
4. Else → deduct `totalDays` from balance (used/available) as today.

---

## 4. Integration with monthly attendance calculation

- **Monthly attendance summary** uses:
  - **Attendance records** (present/absent/half-day/holiday/weekend).
  - **Approved leave requests** (with leave type and days).
- **Event config flags** affect monthly calculation **indirectly**:
  - **Has Balance = NO**: No balance is maintained; leave can still be applied and approved; approved leave is still counted in “leave days” in the monthly summary (paid/unpaid by leave type’s `isPaid`).
  - **Allow Auto Credit = NO**: Balance (when maintained) is not fed by auto credit; entitlement comes from `defaultDaysPerYear` or manual entry.
  - **Authorized**: When you classify “authorized vs unauthorized” in payroll or reports, use `component.authorized` for the event tied to the leave type.

So: monthly attendance calculation does **not** need to re-check **Has Balance** or **Allow Auto Credit**; it just uses approved leaves and attendance records. The flags only change **how balance is created/updated** and **how entitlement is set**.

---

## 5. Link to Rule Setting, Rights Allocation, Employee Assignment, Attendance Calendar

- **Rule Setting**: Auto Credit rules (e.g. `AutoCreditSetting`) are applied only for leave types whose **AttendanceComponent** has **Allow Auto Credit Rule = YES** (enforced in `getEntitlementForEmployeeAndLeaveType` and in leave balance creation).
- **Rights Allocation**: `rights_allocations.attendance_events` (JSON) typically stores which events (e.g. by shortName/code) an allocation allows. When you **validate** “can this employee use this leave type?”, you can combine Rights Allocation (allowed events) with **event config** (e.g. allow hourly, allow week-off) so that:
  - Backend validations above (allow hourly, week-off/holiday, has balance) are applied, and
  - Only events listed in the employee’s rights are allowed.
- **Employee Assignment**: Same idea: if assignment defines which events an employee can use, filter by both assignment and event config flags when validating leave apply.
- **Attendance Calendar**: Calendar shows approved leaves and attendance; it does not need to re-validate flags. For **listing leave types** (e.g. for “Apply leave” dropdown), you can optionally filter or annotate by event config (e.g. hide half-day option when **Allow Hourly = NO**).

---

## 6. Sample backend logic (pseudo-code)

```ts
// Resolve component for leave type (event config)
const component = await getAttendanceComponentForLeaveType(orgId, leaveType);

// When applying leave
if (component) {
  if (totalDays < 1 && !component.allowHourly) throw new AppError('...');
  await validateWeekOffAndHoliday(orgId, start, end, component.allowWeekOffSelection, component.allowHolidaySelection);
  if (!component.hasBalance) skipBalanceCheck = true;
}
if (!skipBalanceCheck) {
  const balance = await getOrCreateLeaveBalance(...);
  if (totalDays > balance.available && !leaveType.canBeNegative) throw new AppError('...');
}

// When approving leave
if (component?.hasBalance !== false) {
  await updateLeaveBalance(employeeId, leaveTypeId, year, deductDays);
}
```

---

## 7. SQL (reference)

No direct SQL is required for the flags themselves; Prisma reads/writes `attendance_components`. For reference, the columns used are:

```sql
SELECT id, short_name, event_name, authorized, has_balance, allow_auto_credit_rule,
       allow_hourly, allow_datewise, allow_week_off_selection, allow_holiday_selection,
       applicable_for_regularization
FROM attendance_components
WHERE organization_id = :org_id AND event_category = 'Leave';
```

Matching to leave types is done in app code by `event_name`/`short_name` vs `leave_types.name`/`code`.

---

## 8. Files touched (summary)

| Area | File | What changed |
|------|------|----------------|
| Event config | `backend/src/utils/event-config.ts` | **New**: resolve component for leave type; `getLeaveTypeIdsWithBalance`, `getLeaveTypeIdsWithAutoCreditAllowed`. |
| Auto credit | `backend/src/utils/auto-credit-entitlement.ts` | Only apply auto credit when component `allowAutoCreditRule === true`. |
| Leave balance | `backend/src/services/leave-balance.service.ts` | Create balance only for types with `hasBalance`; use auto credit only for types with `allowAutoCreditRule`. |
| Leave request | `backend/src/services/leave-request.service.ts` | Validate allowHourly, weekOff/holiday; skip balance check/deduction when `!hasBalance`. |
| Validation | `backend/src/utils/leave.validation.ts` | Optional `totalDays` in create leave request (for half-day). |

Regularization: when you add “event type” to regularization, add a check using **Applicable for Regularization** and optionally a helper from `event-config.ts`.
