# BNC HRMS - Complete Business Process Flows

---

## 1. EMPLOYEE LIFECYCLE - MASTER PROCESS FLOW

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          EMPLOYEE LIFECYCLE - END TO END                                 │
│                                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │          │    │          │    │          │    │          │    │                  │  │
│  │ ONBOARD  │───▶│  ACTIVE  │───▶│SEPARATION│───▶│   FnF    │───▶│  EXIT / REJOIN   │  │
│  │          │    │          │    │          │    │SETTLEMENT│    │                  │  │
│  └──────────┘    └────┬─────┘    └──────────┘    └──────────┘    └──────────────────┘  │
│                       │                                                                 │
│              ┌────────┼────────┐                                                        │
│              ▼        ▼        ▼                                                        │
│         ┌────────┐┌────────┐┌────────┐                                                  │
│         │Transfer││Promote ││Incrmnt │                                                  │
│         └────────┘└────────┘└────────┘                                                  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.1 Employee Onboarding Flow

```
  ┌─────────────────────┐
  │   HR / ORG_ADMIN    │
  │   Initiates Hire    │
  └──────────┬──────────┘
             │
             ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                    SINGLE EMPLOYEE CREATE                       │
  │                  POST /api/v1/employees                         │
  │                                                                 │
  │  ┌─────────────────────────────────────────────────────────┐   │
  │  │ Step 1: Validate Organization                           │   │
  │  │  • Org exists? User has employees.create permission?    │   │
  │  └────────────────────────┬────────────────────────────────┘   │
  │                           │                                     │
  │  ┌────────────────────────▼────────────────────────────────┐   │
  │  │ Step 2: Generate Employee Code                          │   │
  │  │  • If prefix "BNC" + nextNumber → BNC001, BNC002...    │   │
  │  │  • If number only → 1000, 1001, 1002...                │   │
  │  │  • Fallback → UUID-based code                           │   │
  │  └────────────────────────┬────────────────────────────────┘   │
  │                           │                                     │
  │  ┌────────────────────────▼────────────────────────────────┐   │
  │  │ Step 3: Create User Account                             │   │
  │  │  • Email + hashed password (bcrypt)                     │   │
  │  │  • Role: EMPLOYEE / MANAGER / HR_MANAGER                │   │
  │  │  • isActive = true, organizationId linked               │   │
  │  └────────────────────────┬────────────────────────────────┘   │
  │                           │                                     │
  │  ┌────────────────────────▼────────────────────────────────┐   │
  │  │ Step 4: Create Employee Record                          │   │
  │  │                                                          │   │
  │  │  Personal:  name, DOB, gender, marital status, address  │   │
  │  │  Work:      department, position, reporting manager     │   │
  │  │  Financial: paygroup, cost centre, entity, bank A/C     │   │
  │  │  Tax:       PAN, TAN, PF number, ESI number             │   │
  │  │  Status:    employeeStatus = ACTIVE                     │   │
  │  └────────────────────────┬────────────────────────────────┘   │
  │                           │                                     │
  │  ┌────────────────────────▼────────────────────────────────┐   │
  │  │ Step 5: Initialize Salary                               │   │
  │  │  • Link to paygroup salary structure                    │   │
  │  │  • Set basicSalary, grossSalary, CTC                   │   │
  │  │  • effectiveDate = dateOfJoining                        │   │
  │  └────────────────────────┬────────────────────────────────┘   │
  │                           │                                     │
  │  ┌────────────────────────▼────────────────────────────────┐   │
  │  │ Step 6: Initialize Leave Balances                       │   │
  │  │  • For EACH active leave type:                          │   │
  │  │    ┌────────────────────────────────────────────┐       │   │
  │  │    │ EL: openingBalance=12, available=12        │       │   │
  │  │    │ SL: openingBalance=8,  available=8         │       │   │
  │  │    │ CL: openingBalance=7,  available=7         │       │   │
  │  │    │ PL: openingBalance=0,  available=0         │       │   │
  │  │    └────────────────────────────────────────────┘       │   │
  │  │  • Check auto-credit rules for accrual setup            │   │
  │  └────────────────────────┬────────────────────────────────┘   │
  │                           │                                     │
  │  ┌────────────────────────▼────────────────────────────────┐   │
  │  │ Step 7: Setup Approval Hierarchy                        │   │
  │  │  • Resolve reporting manager                            │   │
  │  │  • Map to approval workflows                            │   │
  │  └────────────────────────┬────────────────────────────────┘   │
  │                           ▼                                     │
  │              ✅ Employee Ready for Operations                   │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

### 1.2 Bulk Import Flow

```
  ┌────────────────────┐
  │  HR Uploads Excel  │
  │  (.xlsx file)      │
  └─────────┬──────────┘
            │
            ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                    BULK IMPORT PIPELINE                         │
  │              POST /api/v1/employees/bulk-import                 │
  │                                                                 │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │  Phase 1: UPLOAD & PARSE                                 │  │
  │  │                                                           │  │
  │  │  Excel File ──▶ XLSX Library ──▶ Raw Rows                │  │
  │  │                                                           │  │
  │  │  Header Normalization:                                    │  │
  │  │  "Associate Name" / "Employee Name" / "NAME" → firstName │  │
  │  │  "Email ID" / "email" → email                            │  │
  │  │  Date: DD/MM/YYYY, YYYY-MM-DD, Excel serial → ISO date  │  │
  │  │  Gender: M/MALE → MALE, F/FEMALE → FEMALE               │  │
  │  │  Marital: S/SINGLE → SINGLE, M/MARRIED → MARRIED        │  │
  │  └──────────────────────────┬───────────────────────────────┘  │
  │                              │                                  │
  │  ┌──────────────────────────▼───────────────────────────────┐  │
  │  │  Phase 2: VALIDATION                                     │  │
  │  │                                                           │  │
  │  │  For each row:                                            │  │
  │  │  ├── Email unique? (not in DB already)                   │  │
  │  │  ├── Department exists in org?                            │  │
  │  │  ├── Position exists in org?                              │  │
  │  │  ├── Required fields present? (name, email, DOJ)         │  │
  │  │  └── Data format valid?                                   │  │
  │  │                                                           │  │
  │  │  ❌ Invalid rows → Collected in error report              │  │
  │  │  ✅ Valid rows → Proceed to creation                      │  │
  │  └──────────────────────────┬───────────────────────────────┘  │
  │                              │                                  │
  │  ┌──────────────────────────▼───────────────────────────────┐  │
  │  │  Phase 3: SYNC TO CONFIGURATOR                           │  │
  │  │                                                           │  │
  │  │  POST Excel to Configurator API ──▶ Create users there   │  │
  │  └──────────────────────────┬───────────────────────────────┘  │
  │                              │                                  │
  │  ┌──────────────────────────▼───────────────────────────────┐  │
  │  │  Phase 4: BATCH CREATE (Transaction)                     │  │
  │  │                                                           │  │
  │  │  For each valid row (all-or-nothing):                    │  │
  │  │  ├── Generate employee code                               │  │
  │  │  ├── Create User (hashed temp password)                  │  │
  │  │  ├── Create Employee record                               │  │
  │  │  └── Increment org's nextNumber                          │  │
  │  └──────────────────────────┬───────────────────────────────┘  │
  │                              │                                  │
  │  ┌──────────────────────────▼───────────────────────────────┐  │
  │  │  Phase 5: POST-CREATION                                  │  │
  │  │                                                           │  │
  │  │  Pass 2: Resolve reporting managers (by name/code match) │  │
  │  │  Pass 3: Create salary records (fetch paygroup structure)│  │
  │  │  Pass 4: Initialize leave balances                       │  │
  │  └──────────────────────────┬───────────────────────────────┘  │
  │                              │                                  │
  │                              ▼                                  │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │  RESULT REPORT                                           │  │
  │  │  • Total rows: 150                                       │  │
  │  │  • Created: 142                                          │  │
  │  │  • Failed: 8 (with error details)                        │  │
  │  │  • Skipped: 0                                            │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

### 1.3 Employee Separation & Exit Flow

```
  ┌─────────────────────────────────┐
  │  HR Initiates Separation        │
  │  POST /api/v1/employee-         │
  │       separations               │
  └───────────────┬─────────────────┘
                  │
                  ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                    SEPARATION PROCESS                            │
  │                                                                  │
  │  ┌───────────────────────────────────────────────────────────┐  │
  │  │ Step 1: Record Separation Details                         │  │
  │  │                                                            │  │
  │  │  ┌────────────────────────────────────────────────┐       │  │
  │  │  │ resignationApplyDate: when notice given        │       │  │
  │  │  │ noticePeriod: 30/60/90 days                    │       │  │
  │  │  │ noticePeriodReason: SERVED / WAIVED / BUYOUT   │       │  │
  │  │  │ relievingDate: last working day                │       │  │
  │  │  │ reasonOfLeaving:                               │       │  │
  │  │  │   RESIGNATION │ TERMINATION │ DEATH │          │       │  │
  │  │  │   DISABILITY │ RETIREMENT │ OTHER              │       │  │
  │  │  └────────────────────────────────────────────────┘       │  │
  │  └───────────────────────────┬───────────────────────────────┘  │
  │                              │                                   │
  │  ┌───────────────────────────▼───────────────────────────────┐  │
  │  │ Step 2: Update Employee Status                            │  │
  │  │                                                            │  │
  │  │  If RESIGNATION → employeeStatus = RESIGNED               │  │
  │  │  Else           → employeeStatus = TERMINATED             │  │
  │  └───────────────────────────┬───────────────────────────────┘  │
  │                              │                                   │
  │  ┌───────────────────────────▼───────────────────────────────┐  │
  │  │ Step 3: Disable Login                                     │  │
  │  │                                                            │  │
  │  │  User.isActive = false                                    │  │
  │  │  Employee can no longer access systems                    │  │
  │  └───────────────────────────┬───────────────────────────────┘  │
  │                              │                                   │
  │                              ▼                                   │
  │                   Trigger FnF Settlement                         │
  │                   (See Section 8)                                 │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

### 1.4 Employee Rejoin Flow

```
  ┌───────────────────────────┐
  │  HR Initiates Rejoin      │
  │  POST /api/v1/employees/  │
  │       rejoin              │
  └────────────┬──────────────┘
               │
               ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                      REJOIN PROCESS                              │
  │                                                                  │
  │  ┌─────────────────────────────────────────────────────────┐    │
  │  │ Prerequisites Check                                      │    │
  │  │  • Previous status = RESIGNED or TERMINATED              │    │
  │  │  • New email provided (must be unique)                   │    │
  │  │  • New joining date provided                             │    │
  │  └──────────────────────┬──────────────────────────────────┘    │
  │                         │                                        │
  │  ┌──────────────────────▼──────────────────────────────────┐    │
  │  │ Step 1: Role Inference from Position Title               │    │
  │  │                                                          │    │
  │  │  "HR Admin" / "HR Manager" → HR_MANAGER                 │    │
  │  │  "Manager" / "Team Lead"   → MANAGER                    │    │
  │  │  Everything else           → EMPLOYEE                   │    │
  │  └──────────────────────┬──────────────────────────────────┘    │
  │                         │                                        │
  │  ┌──────────────────────▼──────────────────────────────────┐    │
  │  │ Step 2: Create Fresh Records                             │    │
  │  │                                                          │    │
  │  │  ┌──────────────────────────────────────────────────┐   │    │
  │  │  │  NEW User Account (new email + temp password)    │   │    │
  │  │  │  NEW Employee Code (next in sequence)            │   │    │
  │  │  │  NEW Employee Record:                            │   │    │
  │  │  │    • Copy: department, position, paygroup,       │   │    │
  │  │  │      shift, bank details, tax info, address,     │   │    │
  │  │  │      emergency contacts, documents               │   │    │
  │  │  │    • Fresh: dateOfJoining, employeeCode, userId  │   │    │
  │  │  │    • Flag: is_rejoin = true                      │   │    │
  │  │  │    • Audit: previousEmployeeId,                  │   │    │
  │  │  │            previousEmployeeCode                  │   │    │
  │  │  │  NEW Leave Balances (fresh year)                 │   │    │
  │  │  │  NEW Salary Record                               │   │    │
  │  │  └──────────────────────────────────────────────────┘   │    │
  │  └──────────────────────┬──────────────────────────────────┘    │
  │                         │                                        │
  │                         ▼                                        │
  │          ✅ Employee ACTIVE again with new code                  │
  │             Previous record preserved for audit                  │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 2. ATTENDANCE MANAGEMENT - COMPLETE FLOW

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        ATTENDANCE - END TO END DAILY CYCLE                              │
│                                                                                         │
│  CLOCK-IN          PROCESSING         VALIDATION        MONTHLY          PAYROLL        │
│  ────────          ──────────         ──────────        SUMMARY          ───────        │
│                                                         ───────                         │
│  ┌────────┐     ┌────────────┐     ┌────────────┐    ┌──────────┐    ┌──────────┐      │
│  │ Punch  │────▶│ Calculate  │────▶│ Apply      │───▶│ Aggregate│───▶│ Feed to  │      │
│  │ Record │     │ Hours &    │     │ Validation │    │ Monthly  │    │ Payroll  │      │
│  │        │     │ Status     │     │ Rules      │    │ Totals   │    │ Engine   │      │
│  └────────┘     └────────────┘     └────────────┘    └──────────┘    └──────────┘      │
│                                         │                                               │
│                                    ┌────┴────┐                                          │
│                                    ▼         ▼                                          │
│                              ┌─────────┐ ┌────────┐                                    │
│                              │  HOLD   │ │  AUTO  │                                    │
│                              │(Review) │ │ APPLY  │                                    │
│                              └─────────┘ └────────┘                                    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1 Clock-In / Clock-Out Methods

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                     ATTENDANCE PUNCH SOURCES                            │
  │                                                                         │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐  │
  │  │ BIOMETRIC│  │   WEB    │  │  MOBILE  │  │  FACE  │  │ GEOFENCE │  │
  │  │  Device  │  │  Portal  │  │   App    │  │ Camera │  │  GPS     │  │
  │  │  (ESSL)  │  │          │  │          │  │        │  │          │  │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  └────┬─────┘  │
  │       │              │              │             │             │       │
  │       │  ATTLOG      │  API Call    │  API Call   │ base64 img │ GPS   │
  │       │  sync        │              │             │             │ coord │
  │       ▼              ▼              ▼             ▼             ▼       │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │              UNIFIED PUNCH PROCESSING ENGINE                      │ │
  │  │                   attendance.service.ts                           │ │
  │  │                                                                    │ │
  │  │  1. Identify Employee (by code / userId / face match)             │ │
  │  │  2. Determine punch type (first IN = checkIn, last OUT = checkOut)│ │
  │  │  3. Find or Create AttendanceRecord for date                      │ │
  │  │  4. Set timestamps + checkInMethod                                │ │
  │  │  5. Calculate work hours                                          │ │
  │  │  6. Determine status                                              │ │
  │  │                                                                    │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                         │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Biometric Sync Flow (ESSL/ZKTeco)

```
  ┌──────────────┐                    ┌──────────────┐
  │  Biometric   │                    │  HRMS        │
  │  Devices     │                    │  Backend     │
  │  (On-site)   │                    │              │
  └──────┬───────┘                    └──────┬───────┘
         │                                    │
         │  1. Employee punches finger/card   │
         │     Device records ATTLOG entry    │
         │                                    │
         │  2. eSSL Cloud syncs punch data    │
         │                                    │
         │                                    │  3. Sync Trigger
         │                                    │  POST /attendance/sync-biometric
         │                                    │
         │  4. HRMS fetches from eSSL API     │
         │◀───────────────────────────────────│
         │                                    │
         │  5. Returns punch logs:            │
         │  ┌──────────────────────────────┐  │
         │  │ empCode: BNC001              │  │
         │  │ punchTime: 09:05:23          │  │
         │  │ direction: IN                │  │
         │  │ deviceId: D001               │  │
         │  └──────────────────────────────┘  │
         │────────────────────────────────────▶│
         │                                    │
         │                                    │  6. Group by (employee, date)
         │                                    │     First IN → checkIn
         │                                    │     Last OUT → checkOut
         │                                    │
         │                                    │  7. Match employee in HRMS
         │                                    │
         │                                    │  8. Create/Update
         │                                    │     AttendanceRecord
         │                                    │     checkInMethod = BIOMETRIC
         │                                    │
         │                                    │  9. Calculate hours + status
         │                                    │
         │                                    │  10. Log: synced/created/
         │                                    │      updated/errors
```

---

### 2.3 Attendance Status Determination

```
  ┌─────────────────────────────────────────────────────────┐
  │            STATUS INFERENCE ENGINE                       │
  │                                                          │
  │  For each date + employee:                               │
  │                                                          │
  │  ┌──────────────────┐                                   │
  │  │ Is Weekend?      │──── YES ──▶ status = WEEKEND      │
  │  └────────┬─────────┘                                   │
  │           NO                                             │
  │           ▼                                              │
  │  ┌──────────────────┐                                   │
  │  │ Is Holiday?      │──── YES ──▶ status = HOLIDAY      │
  │  └────────┬─────────┘                                   │
  │           NO                                             │
  │           ▼                                              │
  │  ┌──────────────────┐                                   │
  │  │ Leave Approved?  │──── YES ──▶ status = LEAVE        │
  │  └────────┬─────────┘                                   │
  │           NO                                             │
  │           ▼                                              │
  │  ┌──────────────────┐                                   │
  │  │ Punch Recorded?  │──── NO ───▶ status = ABSENT       │
  │  └────────┬─────────┘                                   │
  │          YES                                             │
  │           ▼                                              │
  │  ┌──────────────────┐                                   │
  │  │ Both In & Out?   │──── YES ──▶ status = PRESENT      │
  │  └────────┬─────────┘            + calc workHours       │
  │           NO                     + calc overtimeHours    │
  │           ▼                                              │
  │     status = PENDING (in-progress day)                   │
  │                                                          │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │ Work Hours Calculation:                           │   │
  │  │                                                    │   │
  │  │ totalHours = checkOut - checkIn                   │   │
  │  │ workHours  = totalHours - breakDuration           │   │
  │  │ overtimeHrs = max(0, workHours - shiftDuration)   │   │
  │  └──────────────────────────────────────────────────┘   │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

---

### 2.4 Attendance Regularization Flow

```
  ┌────────────────────┐
  │  Employee notices   │
  │  missing/wrong      │
  │  punch record       │
  └─────────┬──────────┘
            │
            ▼
  ┌──────────────────────────────────────────────────────────────┐
  │               REGULARIZATION WORKFLOW                        │
  │                                                              │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │ Step 1: Employee Submits Request                     │   │
  │  │                                                       │   │
  │  │  ┌────────────────────────────────────────────┐      │   │
  │  │  │ date: 2026-03-15                           │      │   │
  │  │  │ requestedCheckIn: 09:00                    │      │   │
  │  │  │ requestedCheckOut: 18:00                   │      │   │
  │  │  │ reason: "Forgot to punch out"              │      │   │
  │  │  │ documents: [attachment_url]                 │      │   │
  │  │  └────────────────────────────────────────────┘      │   │
  │  │                                                       │   │
  │  │  AttendanceRecord found/created (ABSENT state)       │   │
  │  │  RegularizationRequest.status = PENDING              │   │
  │  └───────────────────────┬──────────────────────────────┘   │
  │                          │                                   │
  │                          ▼                                   │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │ Step 2: HR/Manager Reviews                           │   │
  │  │                                                       │   │
  │  │  Views: original punch data, requested times,        │   │
  │  │         reason, supporting documents                  │   │
  │  └───────────┬──────────────────────┬───────────────────┘   │
  │              │                      │                        │
  │         APPROVE                  REJECT                     │
  │              │                      │                        │
  │              ▼                      ▼                        │
  │  ┌───────────────────┐  ┌───────────────────┐              │
  │  │ Update Attendance │  │ Status = REJECTED │              │
  │  │ Record with       │  │ Balance unchanged │              │
  │  │ requested times   │  │ Employee notified │              │
  │  │ Status = APPROVED │  └───────────────────┘              │
  │  │ Recalc workHours  │                                      │
  │  └───────────────────┘                                      │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘
```

---

### 2.5 Monthly Summary & Lock Flow

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │              MONTHLY ATTENDANCE SUMMARY PIPELINE                    │
  │                                                                     │
  │  ┌───────────────────────────────────────────────────────────────┐ │
  │  │ Input: organizationId, year, month                           │ │
  │  └───────────────────────────┬───────────────────────────────────┘ │
  │                              │                                      │
  │  ┌───────────────────────────▼───────────────────────────────────┐ │
  │  │ Data Collection (per employee)                                │ │
  │  │                                                               │ │
  │  │  ├── All AttendanceRecords for month                         │ │
  │  │  ├── All approved LeaveRequests for month                    │ │
  │  │  ├── Week-off rules (Sunday + alternate Saturday?)           │ │
  │  │  └── Holiday calendar for organization                       │ │
  │  └───────────────────────────┬───────────────────────────────────┘ │
  │                              │                                      │
  │  ┌───────────────────────────▼───────────────────────────────────┐ │
  │  │ Calculation                                                   │ │
  │  │                                                               │ │
  │  │  ┌─────────────────────────────────────────────────────┐     │ │
  │  │  │  Calendar Days:        31                           │     │ │
  │  │  │  - Weekends:           8                            │     │ │
  │  │  │  - Holidays:           1                            │     │ │
  │  │  │  - Week-offs:          0                            │     │ │
  │  │  │  = Working Days:       22                           │     │ │
  │  │  │                                                      │     │ │
  │  │  │  Present Days:         18                           │     │ │
  │  │  │  Absent Days:          2                            │     │ │
  │  │  │  Leave Days:           2 (EL:1, SL:1)              │     │ │
  │  │  │                                                      │     │ │
  │  │  │  Total Work Hours:     162                          │     │ │
  │  │  │  Overtime Hours:       12                           │     │ │
  │  │  │  LOP Days:             2 (unpaid absence)           │     │ │
  │  │  └─────────────────────────────────────────────────────┘     │ │
  │  └───────────────────────────┬───────────────────────────────────┘ │
  │                              │                                      │
  │  ┌───────────────────────────▼───────────────────────────────────┐ │
  │  │ Status Progression                                            │ │
  │  │                                                               │ │
  │  │  DRAFT ──────▶ FINALIZED ──────▶ LOCKED                      │ │
  │  │  (working)     (ready for        (no edits                   │ │
  │  │                 payroll)          allowed)                    │ │
  │  │                                                               │ │
  │  │  Once LOCKED:                                                 │ │
  │  │  ✗ No attendance edits for this month                        │ │
  │  │  ✗ No leave changes for this month                           │ │
  │  │  ✗ No validation rule changes                                │ │
  │  │  ✓ Data feeds to payroll engine                              │ │
  │  └───────────────────────────────────────────────────────────────┘ │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## 3. LEAVE MANAGEMENT - COMPLETE FLOW

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         LEAVE MANAGEMENT - END TO END                                   │
│                                                                                         │
│  CONFIGURE        ACCRUE           REQUEST         APPROVE         CONSUME              │
│  ─────────        ──────           ───────         ───────         ───────              │
│                                                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
│  │ Leave    │  │ Auto-Credit  │  │ Employee │  │ Manager/ │  │ Balance Update   │     │
│  │ Types +  │─▶│ Accrual +    │─▶│ Submits  │─▶│ HR       │─▶│ + Attendance     │     │
│  │ Policies │  │ Carry-fwd    │  │ Request  │  │ Approves │  │   Calendar       │     │
│  └──────────┘  └──────────────┘  └──────────┘  └──────────┘  └──────────────────┘     │
│                                                                                         │
│                                                      Year End                           │
│                                                         │                               │
│                                                         ▼                               │
│                                               ┌──────────────────┐                      │
│                                               │ Encashment +     │                      │
│                                               │ Carry Forward    │                      │
│                                               └──────────────────┘                      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.1 Leave Type Configuration

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                 LEAVE TYPE SETUP                                  │
  │                                                                   │
  │  ┌─────────────────────────────────────────────────────────────┐ │
  │  │ Leave Types Defined Per Organization:                       │ │
  │  │                                                              │ │
  │  │  ┌──────────┬──────┬─────────┬───────────┬────────────┐    │ │
  │  │  │ Type     │ Code │ Days/Yr │ Accrual   │ Paid?      │    │ │
  │  │  ├──────────┼──────┼─────────┼───────────┼────────────┤    │ │
  │  │  │ Earned   │  EL  │   12    │ MONTHLY   │ Yes (enc.) │    │ │
  │  │  │ Sick     │  SL  │    8    │ ANNUAL    │ Yes        │    │ │
  │  │  │ Casual   │  CL  │    7    │ ANNUAL    │ Yes        │    │ │
  │  │  │ Maternity│  ML  │  182    │ NONE      │ Yes        │    │ │
  │  │  │ Paternity│  PL  │   15    │ NONE      │ Yes        │    │ │
  │  │  │ Comp-Off │  CO  │    0    │ NONE      │ Yes        │    │ │
  │  │  │ LOP      │ LOP  │    0    │ NONE      │ No         │    │ │
  │  │  └──────────┴──────┴─────────┴───────────┴────────────┘    │ │
  │  │                                                              │ │
  │  │  Each type has:                                              │ │
  │  │  • maxCarryForward: max days to carry to next year          │ │
  │  │  • isPaid: encashable on separation?                        │ │
  │  │  • includeWeekend: count weekends in leave duration?        │ │
  │  └─────────────────────────────────────────────────────────────┘ │
  │                                                                   │
  └──────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Auto-Credit / Accrual Flow

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                    AUTO-CREDIT ACCRUAL ENGINE                    │
  │                                                                  │
  │  ┌────────────────────────────────────────────────────────────┐ │
  │  │ Auto-Credit Rule Definition:                               │ │
  │  │                                                             │ │
  │  │  Rule: "EL Monthly Accrual for Paygroup 1"                │ │
  │  │  ┌──────────────────────────────────────────────────────┐  │ │
  │  │  │ eventType:     "Earned Leave"                        │  │ │
  │  │  │ frequency:     MONTHLY                               │  │ │
  │  │  │ accrualDays:   1.0 day/month                         │  │ │
  │  │  │ rounding:      HALF_DAY_ROUNDED_UP                   │  │ │
  │  │  │ scope:         paygroupIds=[PG1], deptIds=[all]      │  │ │
  │  │  │ effectiveDate: 2026-01-01                            │  │ │
  │  │  │ priority:      1                                      │  │ │
  │  │  │ condition:     fullMonthWorked                        │  │ │
  │  │  └──────────────────────────────────────────────────────┘  │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                  │
  │  ┌────────────────────────────────────────────────────────────┐ │
  │  │ Monthly Execution:                                         │ │
  │  │                                                             │ │
  │  │  Month End Trigger (batch or manual)                       │ │
  │  │       │                                                     │ │
  │  │       ▼                                                     │ │
  │  │  Query all AutoCreditSettings effective this month         │ │
  │  │       │                                                     │ │
  │  │       ▼                                                     │ │
  │  │  For EACH matching employee:                               │ │
  │  │       │                                                     │ │
  │  │       ├── Check condition (fullMonthWorked? minDays?)      │ │
  │  │       │                                                     │ │
  │  │       ├── Calculate accrual = 1.0 day                      │ │
  │  │       │                                                     │ │
  │  │       ├── Update LeaveBalance:                             │ │
  │  │       │   accrued += 1.0                                   │ │
  │  │       │   available += 1.0                                 │ │
  │  │       │                                                     │ │
  │  │       └── Log transaction                                  │ │
  │  │                                                             │ │
  │  │  Result: EL balance grows 1 day each month                 │ │
  │  │  Jan=1, Feb=2, Mar=3... Dec=12                             │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Leave Request & Approval Flow

```
  ┌────────────────┐
  │  Employee      │
  │  Requests      │
  │  Leave         │
  └───────┬────────┘
          │
          ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                    LEAVE REQUEST PIPELINE                            │
  │                                                                      │
  │  ┌────────────────────────────────────────────────────────────────┐ │
  │  │ Step 1: VALIDATION                                            │ │
  │  │                                                                │ │
  │  │  ┌─────────────────────────────────────────────────────────┐  │ │
  │  │  │ ✓ Leave type exists and enabled?                        │  │ │
  │  │  │ ✓ Balance sufficient? (available >= totalDays)          │  │ │
  │  │  │ ✓ No overlapping approved leaves?                       │  │ │
  │  │  │ ✓ Date range valid? (fromDate <= toDate)                │  │ │
  │  │  │ ✓ Not in locked month?                                  │  │ │
  │  │  └─────────────────────────────────────────────────────────┘  │ │
  │  └────────────────────────────┬───────────────────────────────────┘ │
  │                               │                                      │
  │  ┌────────────────────────────▼───────────────────────────────────┐ │
  │  │ Step 2: CALCULATE DAYS                                        │ │
  │  │                                                                │ │
  │  │  Duration: FULL_DAY / FIRST_HALF / SECOND_HALF               │ │
  │  │  Exclude weekends (if includeWeekend = false)                │ │
  │  │  Exclude holidays                                             │ │
  │  │  totalDays = calculated working days                          │ │
  │  └────────────────────────────┬───────────────────────────────────┘ │
  │                               │                                      │
  │  ┌────────────────────────────▼───────────────────────────────────┐ │
  │  │ Step 3: RESOLVE APPROVER                                      │ │
  │  │                                                                │ │
  │  │  ┌──────────────────────────────────────────────────────────┐ │ │
  │  │  │ Check WorkflowMapping for employee's paygroup/dept:     │ │ │
  │  │  │                                                          │ │ │
  │  │  │ Level 1: Reporting Manager                               │ │ │
  │  │  │   ↓ hierarchy: "reporting_manager"                       │ │ │
  │  │  │   ↓ resolve: employee.reportingManagerId                 │ │ │
  │  │  │                                                          │ │ │
  │  │  │ Level 2: HR Manager (if configured)                      │ │ │
  │  │  │   ↓ hierarchy: "hr_manager"                              │ │ │
  │  │  │   ↓ resolve: HR department manager                       │ │ │
  │  │  │                                                          │ │ │
  │  │  │ Level 3: Org Admin (if configured)                       │ │ │
  │  │  │   ↓ hierarchy: "admin"                                   │ │ │
  │  │  │   ↓ resolve: ORG_ADMIN user                              │ │ │
  │  │  └──────────────────────────────────────────────────────────┘ │ │
  │  └────────────────────────────┬───────────────────────────────────┘ │
  │                               │                                      │
  │  ┌────────────────────────────▼───────────────────────────────────┐ │
  │  │ Step 4: CREATE REQUEST                                        │ │
  │  │                                                                │ │
  │  │  LeaveRequest.status = PENDING                                │ │
  │  │  Notify Level 1 approver (email)                              │ │
  │  └────────────────────────────┬───────────────────────────────────┘ │
  │                               │                                      │
  │                               ▼                                      │
  │  ┌────────────────────────────────────────────────────────────────┐ │
  │  │ Step 5: MULTI-LEVEL APPROVAL                                  │ │
  │  │                                                                │ │
  │  │     ┌─────────────┐         ┌─────────────┐                  │ │
  │  │     │  Level 1    │         │  Level 2    │                  │ │
  │  │     │  Manager    │         │  HR         │                  │ │
  │  │     └──────┬──────┘         └──────┬──────┘                  │ │
  │  │            │                       │                          │ │
  │  │       ┌────┴────┐            ┌────┴────┐                    │ │
  │  │       ▼         ▼            ▼         ▼                    │ │
  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐              │ │
  │  │  │APPROVE │ │REJECT  │ │APPROVE │ │REJECT  │              │ │
  │  │  │        │ │        │ │(Final) │ │        │              │ │
  │  │  │Move to │ │Status= │ │        │ │Status= │              │ │
  │  │  │Level 2 │ │REJECTED│ │        │ │REJECTED│              │ │
  │  │  └───┬────┘ └────────┘ └───┬────┘ └────────┘              │ │
  │  │      │                     │                                │ │
  │  │      └─────────────────────┘                                │ │
  │  │                │                                             │ │
  │  │                ▼                                             │ │
  │  │  ┌──────────────────────────────────────┐                   │ │
  │  │  │ FINAL APPROVAL:                      │                   │ │
  │  │  │                                      │                   │ │
  │  │  │ • Status = APPROVED                  │                   │ │
  │  │  │ • LeaveBalance.available -= totalDays│                   │ │
  │  │  │ • LeaveBalance.used += totalDays     │                   │ │
  │  │  │ • Attendance calendar updated        │                   │ │
  │  │  │ • Employee notified                  │                   │ │
  │  │  └──────────────────────────────────────┘                   │ │
  │  └────────────────────────────────────────────────────────────────┘ │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 Encashment & Carry-Forward Flow

```
  ┌──────────────────────────────────────────────────────────────────┐
  │               YEAR-END LEAVE PROCESSING                          │
  │               (Fiscal Year: April - March)                       │
  │                                                                  │
  │  ┌──────────────────────────────────────────────────────────┐   │
  │  │ Encashment/Carry-Forward Rule (per leave type):          │   │
  │  │                                                           │   │
  │  │  ┌───────────────────────────────────────────────────┐   │   │
  │  │  │ eventType:              Earned Leave               │   │   │
  │  │  │ isEncashmentApplicable: true                       │   │   │
  │  │  │ maxEncashmentDays:      30                         │   │   │
  │  │  │ encashmentRate:         basicSalary / 30 per day   │   │   │
  │  │  │ isCarryForwardApplicable: true                     │   │   │
  │  │  │ maxCarryForwardDays:    5                          │   │   │
  │  │  │ leaveExpiryDays:        1095 (3 years)             │   │   │
  │  │  └───────────────────────────────────────────────────┘   │   │
  │  └──────────────────────────────────────────────────────────┘   │
  │                                                                  │
  │  ┌──────────────────────────────────────────────────────────┐   │
  │  │ Year-End Processing (March 31):                          │   │
  │  │                                                           │   │
  │  │  Employee: Available EL = 8 days                         │   │
  │  │                                                           │   │
  │  │  ┌───────────────────────────────────────────────────┐   │   │
  │  │  │                                                    │   │   │
  │  │  │  Carry Forward = min(8, maxCarryFwd=5) = 5 days   │   │   │
  │  │  │                                                    │   │   │
  │  │  │  Remaining = 8 - 5 = 3 days                       │   │   │
  │  │  │                                                    │   │   │
  │  │  │  If encashment applicable:                         │   │   │
  │  │  │    Encash 3 days × (basic/30) = ₹3,000            │   │   │
  │  │  │                                                    │   │   │
  │  │  │  Next Year Opening:                                │   │   │
  │  │  │    openingBalance = 5 (carried forward)            │   │   │
  │  │  │    + monthly accrual starts fresh                  │   │   │
  │  │  │                                                    │   │   │
  │  │  └───────────────────────────────────────────────────┘   │   │
  │  └──────────────────────────────────────────────────────────┘   │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 4. PAYROLL PROCESSING - COMPLETE FLOW

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          PAYROLL - END TO END MONTHLY CYCLE                             │
│                                                                                         │
│  SETUP           INPUTS          CALCULATE       REVIEW         OUTPUT                  │
│  ─────           ──────          ─────────       ──────         ──────                  │
│                                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────────┐        │
│  │ Salary   │  │Attendance│  │  Payroll  │  │   HR     │  │ Payslips +       │        │
│  │Structure │─▶│ + Leave  │─▶│  Calc     │─▶│  Review  │─▶│ Compliance       │        │
│  │+ Paygroup│  │ + Loans  │  │  Engine   │  │ + Adjust │  │ Reports          │        │
│  └──────────┘  └──────────┘  └───────────┘  └──────────┘  └──────────────────┘        │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.1 Payroll Input Collection

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                  PAYROLL INPUT AGGREGATION                       │
  │               (For each employee in payroll cycle)               │
  │                                                                  │
  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
  │  │   ATTENDANCE     │  │     LEAVE       │  │   VARIABLE     │  │
  │  │   SUMMARY        │  │    BALANCE      │  │    INPUTS      │  │
  │  │                  │  │                 │  │                │  │
  │  │ workDays:   22   │  │ paidLeave:  3  │  │ OT hours: 10  │  │
  │  │ present:    18   │  │ unpaidLeave: 2 │  │ incentive: 5K  │  │
  │  │ absent:      2   │  │ EL used: 2     │  │ bonus: 0       │  │
  │  │ weekends:    8   │  │ SL used: 1     │  │ arrears: 2K    │  │
  │  │ holidays:    1   │  │               │  │                │  │
  │  │ OT hrs:     10   │  │               │  │                │  │
  │  └────────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
  │           │                    │                    │            │
  │           ▼                    ▼                    ▼            │
  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
  │  │    SALARY       │  │     LOANS       │  │   STATUTORY    │  │
  │  │   STRUCTURE     │  │   & ADVANCES    │  │    CONFIG      │  │
  │  │                  │  │                 │  │                │  │
  │  │ Basic:  30,000  │  │ Loan EMI: 500  │  │ PF: 12%       │  │
  │  │ HRA:     6,000  │  │ Advance: 0     │  │ ESIC: 0.75%   │  │
  │  │ Conv:    1,600  │  │                 │  │ PT: ₹200      │  │
  │  │ Special: 7,400  │  │                 │  │ TDS: slab     │  │
  │  │ Gross:  45,000  │  │                 │  │                │  │
  │  └────────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
  │           │                    │                    │            │
  │           └────────────────────┼────────────────────┘            │
  │                                │                                 │
  │                                ▼                                 │
  │                    ┌──────────────────────┐                      │
  │                    │  PAYROLL CALCULATION │                      │
  │                    │  ENGINE              │                      │
  │                    └──────────────────────┘                      │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Payroll Calculation Engine

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                    PAYROLL CALCULATION ENGINE                            │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ Step 1: PRO-RATA CALCULATION (if mid-month join/exit)             │ │
  │  │                                                                    │ │
  │  │  proRataFactor = presentDays / workDays                           │ │
  │  │  proRataBasic  = basicSalary × proRataFactor                     │ │
  │  │  proRataGross  = grossSalary × proRataFactor                     │ │
  │  │                                                                    │ │
  │  │  Example: 18 present / 22 workDays = 0.818                       │ │
  │  │           Basic = 30,000 × 0.818 = ₹24,545                      │ │
  │  └──────────────────────────────────┬─────────────────────────────────┘ │
  │                                     │                                    │
  │  ┌──────────────────────────────────▼─────────────────────────────────┐ │
  │  │ Step 2: EARNINGS CALCULATION                                      │ │
  │  │                                                                    │ │
  │  │  ┌────────────────────────────────────────────────────────┐       │ │
  │  │  │ Fixed Components (from salary structure):              │       │ │
  │  │  │   BASIC:      ₹30,000 (40% of CTC)                   │       │ │
  │  │  │   HRA:        ₹ 6,000 (8% of CTC)                    │       │ │
  │  │  │   CONVEYANCE: ₹ 1,600                                 │       │ │
  │  │  │   SPECIAL:    ₹ 7,400                                 │       │ │
  │  │  │                                                        │       │ │
  │  │  │ Variable Components:                                   │       │ │
  │  │  │   OT Pay:     10 hrs × rate = ₹1,500                 │       │ │
  │  │  │   Incentive:  ₹5,000                                  │       │ │
  │  │  │   Arrears:    ₹2,000                                  │       │ │
  │  │  │                                                        │       │ │
  │  │  │ GROSS EARNINGS = ₹53,500                              │       │ │
  │  │  └────────────────────────────────────────────────────────┘       │ │
  │  └──────────────────────────────────┬─────────────────────────────────┘ │
  │                                     │                                    │
  │  ┌──────────────────────────────────▼─────────────────────────────────┐ │
  │  │ Step 3: STATUTORY DEDUCTIONS                                      │ │
  │  │                                                                    │ │
  │  │  ┌──────────────────────────────────────────────────────────────┐ │ │
  │  │  │                                                              │ │ │
  │  │  │  (a) EPF (Provident Fund):                                  │ │ │
  │  │  │      Employee: 12% of Basic (capped at ₹15,000)            │ │ │
  │  │  │      = min(30,000 × 12%, 1,800) = ₹1,800                   │ │ │
  │  │  │      Employer: 12% of Basic = ₹1,800 (not deducted)       │ │ │
  │  │  │                                                              │ │ │
  │  │  │  (b) ESIC (Employee State Insurance):                       │ │ │
  │  │  │      Applicable if gross ≤ ₹21,000                         │ │ │
  │  │  │      Employee: 0.75% of Gross                               │ │ │
  │  │  │      Employer: 3.25% of Gross                               │ │ │
  │  │  │      (Not applicable here: gross > 21K)                     │ │ │
  │  │  │                                                              │ │ │
  │  │  │  (c) Professional Tax:                                      │ │ │
  │  │  │      State slab-based (Maharashtra: ₹200/month)            │ │ │
  │  │  │      = ₹200                                                 │ │ │
  │  │  │                                                              │ │ │
  │  │  │  (d) TDS (Income Tax) - Section 192:                       │ │ │
  │  │  │      Annual taxable = (Gross - PF - ESIC - PT) × 12       │ │ │
  │  │  │      Apply tax slabs (NEW / OLD regime)                    │ │ │
  │  │  │      Monthly TDS = Annual Tax / 12                         │ │ │
  │  │  │      = ₹3,200 (example)                                    │ │ │
  │  │  │                                                              │ │ │
  │  │  └──────────────────────────────────────────────────────────────┘ │ │
  │  └──────────────────────────────────┬─────────────────────────────────┘ │
  │                                     │                                    │
  │  ┌──────────────────────────────────▼─────────────────────────────────┐ │
  │  │ Step 4: OTHER DEDUCTIONS                                          │ │
  │  │                                                                    │ │
  │  │  Loan EMI:        ₹  500                                         │ │
  │  │  LOP Deduction:   ₹4,091 (2 days × gross/22)                    │ │
  │  │  Other:           ₹    0                                         │ │
  │  └──────────────────────────────────┬─────────────────────────────────┘ │
  │                                     │                                    │
  │  ┌──────────────────────────────────▼─────────────────────────────────┐ │
  │  │ Step 5: NET SALARY                                                │ │
  │  │                                                                    │ │
  │  │  ┌──────────────────────────────────────────────────────────┐     │ │
  │  │  │                                                          │     │ │
  │  │  │  Gross Earnings:     ₹53,500                            │     │ │
  │  │  │  - EPF (employee):   ₹ 1,800                            │     │ │
  │  │  │  - ESIC:             ₹     0                            │     │ │
  │  │  │  - Prof. Tax:        ₹   200                            │     │ │
  │  │  │  - TDS:              ₹ 3,200                            │     │ │
  │  │  │  - Loan EMI:         ₹   500                            │     │ │
  │  │  │  - LOP Deduction:    ₹ 4,091                            │     │ │
  │  │  │  ─────────────────────────────                           │     │ │
  │  │  │  NET SALARY:         ₹43,709                            │     │ │
  │  │  │                                                          │     │ │
  │  │  └──────────────────────────────────────────────────────────┘     │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 Payroll Cycle Status Flow

```
  ┌──────────────────────────────────────────────────────────────────┐
  │              PAYROLL CYCLE LIFECYCLE                              │
  │                                                                  │
  │  ┌────────┐    ┌─────────────┐    ┌───────────┐                │
  │  │ DRAFT  │───▶│ IN_PROGRESS │───▶│ PROCESSED │                │
  │  │        │    │             │    │           │                │
  │  │ Create │    │ Calculation │    │ Payslips  │                │
  │  │ cycle  │    │ running     │    │ generated │                │
  │  └────────┘    └─────────────┘    └─────┬─────┘                │
  │                                         │                       │
  │                                         ▼                       │
  │                                   ┌───────────┐                │
  │                                   │ FINALIZED │                │
  │                                   │           │                │
  │                                   │ HR review │                │
  │                                   │ complete  │                │
  │                                   └─────┬─────┘                │
  │                                         │                       │
  │                                         ▼                       │
  │                                   ┌───────────┐                │
  │                                   │  LOCKED   │                │
  │                                   │           │                │
  │                                   │ No edits  │                │
  │                                   │ allowed   │                │
  │                                   └─────┬─────┘                │
  │                                         │                       │
  │                                         ▼                       │
  │                                   ┌───────────┐                │
  │                                   │  POSTED   │──▶ Accounting  │
  │                                   │  / PAID   │     Integration│
  │                                   └───────────┘                │
  │                                                                 │
  └──────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Compliance Reports Output

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                COMPLIANCE REPORTS GENERATED                      │
  │                                                                  │
  │  From finalized payroll cycle:                                   │
  │                                                                  │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
  │  │  EPF Report  │  │  ESIC Report │  │   PT Report  │          │
  │  │              │  │              │  │              │          │
  │  │ Employee UAN │  │ Employees    │  │ Monthly PT   │          │
  │  │ Monthly wage │  │ covered      │  │ by state     │          │
  │  │ EE + ER      │  │ EE + ER      │  │ slab-based   │          │
  │  │ contribution │  │ contribution │  │              │          │
  │  └──────────────┘  └──────────────┘  └──────────────┘          │
  │                                                                  │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
  │  │  TDS Report  │  │  Payroll     │  │  Payslips    │          │
  │  │  / Form 16   │  │  Register    │  │  (PDF)       │          │
  │  │              │  │              │  │              │          │
  │  │ PAN, TAN     │  │ All employee │  │ Per-employee │          │
  │  │ Monthly TDS  │  │ summary      │  │ earnings +   │          │
  │  │ Annual cert  │  │ attendance + │  │ deductions   │          │
  │  │              │  │ earnings +   │  │ net salary   │          │
  │  │              │  │ deductions   │  │              │          │
  │  └──────────────┘  └──────────────┘  └──────────────┘          │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 5. APPROVAL WORKFLOW ENGINE

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                      APPROVAL WORKFLOW - CONFIGURATION & EXECUTION                     │
│                                                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        WORKFLOW CONFIGURATION                                     │  │
│  │                                                                                   │  │
│  │  Step 1: Define ApprovalWorkflow                                                 │  │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ workflowType: "Employee" / "Manager" / "HR" / "Org Admin"                │  │  │
│  │  │ shortName:    "MGR_LEAVE_APPROVAL"                                        │  │  │
│  │  │                                                                            │  │  │
│  │  │ attendanceEvents:                                                          │  │  │
│  │  │  ┌───────────────────────────────────────────────────────┐                │  │  │
│  │  │  │ Event: "Leave - Earned Leave"                         │                │  │  │
│  │  │  │   applicable: true                                    │                │  │  │
│  │  │  │   toApprove: true (requires approval)                 │                │  │  │
│  │  │  │   cancelApproval: true (cancel also needs approval)   │                │  │  │
│  │  │  │                                                        │                │  │  │
│  │  │  │ Event: "Leave - Sick Leave"                           │                │  │  │
│  │  │  │   applicable: true                                    │                │  │  │
│  │  │  │   toApprove: true                                     │                │  │  │
│  │  │  │   cancelApproval: false (auto-cancel)                 │                │  │  │
│  │  │  └───────────────────────────────────────────────────────┘                │  │  │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                   │  │
│  │  Step 2: Create WorkflowMapping (binds workflow to employee scope)               │  │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ displayName: "Leave Approval - Engineering + Paygroup 1"                  │  │  │
│  │  │ scope:       paygroupIds=[PG1], departmentIds=[Engineering]               │  │  │
│  │  │ priority:    1 (first match wins)                                         │  │  │
│  │  │                                                                            │  │  │
│  │  │ approvalLevels: [                                                         │  │  │
│  │  │   { level: 1, hierarchy: "reporting_manager", workflow: WF_MGR }         │  │  │
│  │  │   { level: 2, hierarchy: "hr_manager",        workflow: WF_HR  }         │  │  │
│  │  │ ]                                                                         │  │  │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        APPROVAL EXECUTION FLOW                                    │  │
│  │                                                                                   │  │
│  │  Request Created (Leave / Regularization / CompOff / etc.)                       │  │
│  │       │                                                                           │  │
│  │       ▼                                                                           │  │
│  │  ┌──────────────────────────────────────────────────────────┐                    │  │
│  │  │ Resolve Approver Hierarchy:                              │                    │  │
│  │  │                                                           │                    │  │
│  │  │ "reporting_manager" → employee.reportingManagerId        │                    │  │
│  │  │ "department_head"   → employee.department.managerId      │                    │  │
│  │  │ "hr_manager"        → HR department's manager            │                    │  │
│  │  │ "hr_head"           → same as hr_manager                 │                    │  │
│  │  │ "admin"             → ORG_ADMIN user                     │                    │  │
│  │  └──────────────────────────┬───────────────────────────────┘                    │  │
│  │                              │                                                    │  │
│  │       ┌──────────────────────▼───────────────────────────┐                       │  │
│  │       │                                                   │                       │  │
│  │       ▼                                                   │                       │  │
│  │  ┌──────────┐    APPROVE    ┌──────────┐    APPROVE     ┌──────────┐            │  │
│  │  │ Level 1  │──────────────▶│ Level 2  │───────────────▶│  FINAL   │            │  │
│  │  │ Manager  │               │ HR       │                │ APPROVED │            │  │
│  │  └────┬─────┘               └────┬─────┘                └──────────┘            │  │
│  │       │                          │                                               │  │
│  │       │ REJECT                   │ REJECT                                        │  │
│  │       ▼                          ▼                                               │  │
│  │  ┌──────────┐            ┌──────────┐                                           │  │
│  │  │ REJECTED │            │ REJECTED │                                           │  │
│  │  └──────────┘            └──────────┘                                           │  │
│  │                                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. EMPLOYEE CHANGE REQUEST FLOW

```
  ┌────────────────────┐
  │  HR / Manager      │
  │  Submits Change    │
  │  Request           │
  └─────────┬──────────┘
            │
            ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │              EMPLOYEE CHANGE REQUEST PIPELINE                    │
  │                                                                  │
  │  ┌────────────────────────────────────────────────────────────┐ │
  │  │ Change Request Record:                                     │ │
  │  │                                                             │ │
  │  │  ┌─────────────────────┐  ┌─────────────────────┐         │ │
  │  │  │   EXISTING DATA     │  │   REQUESTED DATA    │         │ │
  │  │  │                     │  │                     │         │ │
  │  │  │ name: "John Smith"  │  │ name: "Jon Smith"   │         │ │
  │  │  │ dept: Engineering   │  │ dept: Sales          │         │ │
  │  │  │ position: Sr. Eng   │  │ position: Sales Mgr │         │ │
  │  │  │ manager: Mgr A      │  │ manager: Mgr B      │         │ │
  │  │  │ bank: HDFC xxxx1234│  │ bank: SBI xxxx5678  │         │ │
  │  │  └─────────────────────┘  └─────────────────────┘         │ │
  │  │                                                             │ │
  │  │  Changeable Fields:                                        │ │
  │  │  ├── Personal: name, DOB, gender, marital status          │ │
  │  │  ├── Professional: department, position, manager          │ │
  │  │  ├── Financial: bank details, tax info                    │ │
  │  │  ├── Organizational: entity, location, cost centre        │ │
  │  │  └── Extensions: qualifications, family, previous jobs    │ │
  │  └───────────────────────────┬────────────────────────────────┘ │
  │                              │                                   │
  │                              ▼                                   │
  │  ┌───────────────────────────────────────────────────────────┐  │
  │  │                    APPROVAL                               │  │
  │  │                                                            │  │
  │  │        ┌─────────┐                 ┌─────────┐            │  │
  │  │        │ PENDING │                 │ PENDING │            │  │
  │  │        └────┬────┘                 └────┬────┘            │  │
  │  │             │                           │                  │  │
  │  │        ┌────┴────┐                 ┌────┴────┐            │  │
  │  │        ▼         ▼                 ▼         ▼            │  │
  │  │   ┌────────┐ ┌────────┐       ┌────────┐ ┌────────┐     │  │
  │  │   │APPROVE │ │REJECT  │       │APPROVE │ │REJECT  │     │  │
  │  │   │        │ │        │       │        │ │        │     │  │
  │  │   │ Apply  │ │ No     │       │ Apply  │ │ Reason │     │  │
  │  │   │ ALL    │ │ change │       │ ALL    │ │ stored │     │  │
  │  │   │ fields │ │        │       │ fields │ │        │     │  │
  │  │   │ to emp │ │        │       │ to emp │ │        │     │  │
  │  │   └────────┘ └────────┘       └────────┘ └────────┘     │  │
  │  │                                                            │  │
  │  └───────────────────────────────────────────────────────────┘  │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 7. TRANSFER & PROMOTION FLOW

```
  ┌──────────────────────────────────────────────────────────────────┐
  │              TRANSFER / PROMOTION / INCREMENT PROCESS            │
  │                                                                  │
  │  ┌────────────────────────────────────────────────────────────┐ │
  │  │ Transfer/Promotion Record:                                 │ │
  │  │                                                             │ │
  │  │  effectiveDate:   2026-04-01                               │ │
  │  │  appliedFrom:     EFFECTIVE_DATE / IMMEDIATE / PAYROLL     │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                  │
  │  Three Types:                                                    │
  │                                                                  │
  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
  │  │  TRANSFER    │  │  PROMOTION    │  │  INCREMENT           │ │
  │  │              │  │               │  │                      │ │
  │  │ Change:      │  │ Change:       │  │ isIncrement = true   │ │
  │  │ • Department │  │ • Position    │  │                      │ │
  │  │ • Location   │  │ • Grade       │  │ incrementComponents: │ │
  │  │ • Entity     │  │ • Department  │  │ ┌────────┬──────┐    │ │
  │  │ • Manager    │  │ • Paygroup    │  │ │BASIC   │+5000 │    │ │
  │  │              │  │               │  │ │HRA     │+1000 │    │ │
  │  │              │  │               │  │ │SPECIAL │+1500 │    │ │
  │  │              │  │               │  │ └────────┴──────┘    │ │
  │  │              │  │               │  │                      │ │
  │  │              │  │               │  │ beforeLOP: ₹35,000   │ │
  │  │              │  │               │  │ afterLOP:  ₹42,500   │ │
  │  └──────┬───────┘  └───────┬───────┘  └──────────┬───────────┘ │
  │         │                  │                      │              │
  │         └──────────────────┼──────────────────────┘              │
  │                            │                                     │
  │                            ▼                                     │
  │  ┌────────────────────────────────────────────────────────────┐ │
  │  │ Execution:                                                 │ │
  │  │                                                             │ │
  │  │  If Transfer:                                              │ │
  │  │    Update employee.departmentId, locationId, entityId      │ │
  │  │                                                             │ │
  │  │  If Promotion:                                             │ │
  │  │    Update employee.positionId, grade, paygroupId           │ │
  │  │                                                             │ │
  │  │  If Increment:                                             │ │
  │  │    Call applyIncrementFromTransferPromotion()              │ │
  │  │    → Update salary structure effective from incrementFrom  │ │
  │  │    → Preserve salary history (old values + dates)          │ │
  │  │    → New payslips use updated components                   │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 8. FULL & FINAL (FnF) SETTLEMENT FLOW

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                    FnF SETTLEMENT - END TO END                          │
  │                                                                          │
  │  ┌────────────┐    ┌─────────────┐    ┌────────────┐    ┌────────────┐ │
  │  │ Separation │───▶│ Calculate   │───▶│  HR Review │───▶│   PAID     │ │
  │  │ Initiated  │    │ Settlement  │    │  & Approve │    │ (Closed)   │ │
  │  └────────────┘    └─────────────┘    └────────────┘    └────────────┘ │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │                SETTLEMENT CALCULATION ENGINE                      │ │
  │  │                                                                    │ │
  │  │  ┌──────────────────────────────────────────────────────────────┐ │ │
  │  │  │  EARNINGS                                                    │ │ │
  │  │  │                                                              │ │ │
  │  │  │  1. Final Month Pro-rata Salary                             │ │ │
  │  │  │     = (daysWorked / totalDays) × grossSalary                │ │ │
  │  │  │     - PF deduction (12% of basic, cap ₹15K)                │ │ │
  │  │  │     - PT deduction (₹200)                                   │ │ │
  │  │  │                                                              │ │ │
  │  │  │  2. Leave Encashment                                        │ │ │
  │  │  │     For each paid leave type with balance > 0:              │ │ │
  │  │  │     days = min(availableBalance, maxEncashmentDays)          │ │ │
  │  │  │     amount = days × (basicSalary / 30)                      │ │ │
  │  │  │                                                              │ │ │
  │  │  │  3. Gratuity (Payment of Gratuity Act, 1972)                │ │ │
  │  │  │     Eligibility: 4.5+ years service (or death/disability)   │ │ │
  │  │  │     Formula: (basic × 15 × completedYears) / 26            │ │ │
  │  │  │     Cap: ₹20,00,000 (statutory max)                        │ │ │
  │  │  │     Completed years includes +1 if >6 months remainder     │ │ │
  │  │  │                                                              │ │ │
  │  │  │  4. Pro-rata Bonus (Payment of Bonus Act)                   │ │ │
  │  │  │     = (grossSalary × 8.33% × monthsWorkedInFY) / 12       │ │ │
  │  │  │                                                              │ │ │
  │  │  └──────────────────────────────────────────────────────────────┘ │ │
  │  │                                                                    │ │
  │  │  ┌──────────────────────────────────────────────────────────────┐ │ │
  │  │  │  DEDUCTIONS                                                  │ │ │
  │  │  │                                                              │ │ │
  │  │  │  5. Notice Period Recovery                                  │ │ │
  │  │  │     If notice NOT fully served:                              │ │ │
  │  │  │     shortfall = noticePeriodDays - servedDays                │ │ │
  │  │  │     recovery = shortfall × (grossSalary / 30)               │ │ │
  │  │  │                                                              │ │ │
  │  │  │  6. Excess Leave Recovery                                   │ │ │
  │  │  │     If any leave balance < 0:                                │ │ │
  │  │  │     recovery = |negativeBalance| × (basic / 30)             │ │ │
  │  │  │                                                              │ │ │
  │  │  │  7. Loan / Advance Recovery                                 │ │ │
  │  │  │     All active loans → pendingAmount recovered              │ │ │
  │  │  │     (insurance, travel, other)                               │ │ │
  │  │  │                                                              │ │ │
  │  │  │  8. TDS Adjustment (Section 192)                            │ │ │
  │  │  │     Taxable income = salary + encashment + bonus            │ │ │
  │  │  │     Exemptions: gratuity (₹20L), encashment (₹25L)        │ │ │
  │  │  │     PAN invalid? → 20% flat TDS                             │ │ │
  │  │  │     Apply NEW/OLD regime tax slabs                          │ │ │
  │  │  │                                                              │ │ │
  │  │  └──────────────────────────────────────────────────────────────┘ │ │
  │  │                                                                    │ │
  │  │  ┌──────────────────────────────────────────────────────────────┐ │ │
  │  │  │  NET SETTLEMENT = Total Earnings - Total Deductions          │ │ │
  │  │  │                                                              │ │ │
  │  │  │  Status: CALCULATED ──▶ APPROVED ──▶ PAID                   │ │ │
  │  │  │          (system)       (HR review)   (payment done)        │ │ │
  │  │  └──────────────────────────────────────────────────────────────┘ │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 9. ESOP (Employee Stock Option Plan) FLOW

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                       ESOP - END TO END LIFECYCLE                       │
  │                                                                          │
  │  POOL          PLAN          GRANT        VEST         EXERCISE         │
  │  ────          ────          ─────        ────         ────────         │
  │                                                                          │
  │  ┌────────┐  ┌────────┐  ┌──────────┐  ┌────────┐  ┌──────────────┐   │
  │  │ Create │─▶│ Define │─▶│  Issue   │─▶│ Monthly│─▶│  Employee    │   │
  │  │ Share  │  │Vesting │  │  Grant   │  │ Vest   │  │  Exercises   │   │
  │  │ Pool   │  │ Plan   │  │  to Emp  │  │Tranches│  │  Shares      │   │
  │  └────────┘  └────────┘  └──────────┘  └────────┘  └──────────────┘   │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ POOL SETUP:                                                       │ │
  │  │  totalShares: 10,000 │ sharePrice: ₹100 │ currency: INR         │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ VESTING PLAN:                                                     │ │
  │  │  "4-Year Cliff + Monthly Vest"                                    │ │
  │  │  vestingPeriod: 48 months │ cliff: 12 months │ frequency: MONTHLY│ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ GRANT TO EMPLOYEE:                                                │ │
  │  │                                                                    │ │
  │  │  Employee: John │ totalShares: 100 │ grantPrice: ₹100            │ │
  │  │  grantDate: 2026-01-01                                            │ │
  │  │                                                                    │ │
  │  │  Vesting Schedule Generated:                                      │ │
  │  │  ┌──────────┬──────────────┬──────────┐                          │ │
  │  │  │ Tranche  │ Vest Date    │ Shares   │                          │ │
  │  │  ├──────────┼──────────────┼──────────┤                          │ │
  │  │  │  1 (cliff)│ 2027-01-01  │ 25       │                          │ │
  │  │  │  2       │ 2027-02-01   │  2       │                          │ │
  │  │  │  3       │ 2027-03-01   │  2       │                          │ │
  │  │  │  ...     │ ...          │  2       │                          │ │
  │  │  │  37      │ 2029-01-01   │  2       │  (Last tranche)         │ │
  │  │  └──────────┴──────────────┴──────────┘                          │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ MONTHLY VESTING (Batch Job):                                      │ │
  │  │                                                                    │ │
  │  │  Find all tranches where vestingDate <= today AND status=PENDING  │ │
  │  │       │                                                            │ │
  │  │       ├── Mark tranche as VESTED                                  │ │
  │  │       ├── grant.vestedShares += tranche.shares                    │ │
  │  │       └── Log in EsopLedger: SHARES_VESTED                       │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ EXERCISE REQUEST:                                                 │ │
  │  │                                                                    │ │
  │  │  Employee: "I want to exercise 50 shares"                         │ │
  │  │       │                                                            │ │
  │  │       ▼                                                            │ │
  │  │  Validate: vestedShares - pendingExercises >= 50? ✓              │ │
  │  │       │                                                            │ │
  │  │       ▼                                                            │ │
  │  │  ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐  │ │
  │  │  │ PENDING  │───▶│ APPROVED │───▶│ COMPLETED │    │ REJECTED │  │ │
  │  │  │          │    │ (HR)     │    │ (Shares   │    │          │  │ │
  │  │  │ Request  │    │          │    │ transferred│   │          │  │ │
  │  │  │ created  │    │ Validate │    │ payment   │    │          │  │ │
  │  │  │          │    │ + approve│    │ collected) │    │          │  │ │
  │  │  └──────────┘    └──────────┘    └───────────┘    └──────────┘  │ │
  │  │                                                                    │ │
  │  │  On Complete: grant.exercisedShares += 50                         │ │
  │  │               Ledger: EXERCISE_COMPLETED                          │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ ESOP LEDGER TRANSACTIONS:                                         │ │
  │  │                                                                    │ │
  │  │  POOL_CREATED → PLAN_CREATED → GRANT_ISSUED → SHARES_VESTED →   │ │
  │  │  EXERCISE_REQUESTED → EXERCISE_APPROVED → EXERCISE_COMPLETED     │ │
  │  │                                                                    │ │
  │  │  On Separation: GRANT_CANCELLED (unvested shares return to pool) │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 10. COMP-OFF (Compensatory Off) FLOW

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                   COMP-OFF LIFECYCLE                              │
  │                                                                  │
  │  ┌────────────────────────────────────────────────────────────┐ │
  │  │ EARNING COMP-OFF:                                          │ │
  │  │                                                             │ │
  │  │  Employee works on:                                        │ │
  │  │  ├── Holiday (public holiday)  → 1 day comp-off           │ │
  │  │  ├── Weekend (Sunday)          → 1 day comp-off           │ │
  │  │  └── Extra hours beyond shift  → fractional comp-off      │ │
  │  │                                                             │ │
  │  │  Detected by:                                              │ │
  │  │  ├── Attendance validation rules (auto-detect)            │ │
  │  │  ├── Auto-credit rules                                    │ │
  │  │  └── Manual HR entry                                      │ │
  │  │                                                             │ │
  │  │  Result: LeaveBalance (Comp-Off type) credited            │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                  │
  │  ┌────────────────────────────────────────────────────────────┐ │
  │  │ USING COMP-OFF:                                            │ │
  │  │                                                             │ │
  │  │  ┌──────────┐    ┌──────────┐    ┌────────────────────┐   │ │
  │  │  │ Employee │───▶│ Manager  │───▶│ Balance Deducted   │   │ │
  │  │  │ Requests │    │ Approves │    │ Treated as Leave   │   │ │
  │  │  │ CompOff  │    │          │    │ in Attendance      │   │ │
  │  │  │ Leave    │    │          │    │                    │   │ │
  │  │  └──────────┘    └──────────┘    └────────────────────┘   │ │
  │  │                                                             │ │
  │  │  Same approval workflow as regular leave requests           │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                  │
  │  ┌────────────────────────────────────────────────────────────┐ │
  │  │ EXPIRY / AUTO-CONVERSION:                                  │ │
  │  │                                                             │ │
  │  │  If comp-off not used within deadline:                     │ │
  │  │  → Auto-convert to other leave type (org policy)          │ │
  │  │  → Or expire (balance reset to 0)                          │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 11. ATTENDANCE VALIDATION PROCESS FLOW

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │               VALIDATION PROCESS RULE ENGINE                            │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ RULE DEFINITION (Examples):                                       │ │
  │  │                                                                    │ │
  │  │  Rule 1 (Priority 1): "Late Arrival > 30 mins"                   │ │
  │  │  ┌──────────────────────────────────────────────────────────────┐ │ │
  │  │  │ condition:  checkIn > (shiftStart + 30 mins)                │ │ │
  │  │  │ action:     MARK_HALF_DAY                                    │ │ │
  │  │  │ autoApply:  true (no approval needed)                        │ │ │
  │  │  │ grouping:   LATE_AND_OTHERS                                  │ │ │
  │  │  │ limit:      max 3 per month (after 3rd → mark absent)       │ │ │
  │  │  └──────────────────────────────────────────────────────────────┘ │ │
  │  │                                                                    │ │
  │  │  Rule 2 (Priority 2): "Holiday Worked → Comp-Off Credit"        │ │
  │  │  ┌──────────────────────────────────────────────────────────────┐ │ │
  │  │  │ condition:  holiday && checkIn && checkOut                   │ │ │
  │  │  │ action:     CREDIT_COMPOFF                                   │ │ │
  │  │  │ autoApply:  true                                             │ │ │
  │  │  │ dayType:    HOLIDAY                                          │ │ │
  │  │  └──────────────────────────────────────────────────────────────┘ │ │
  │  │                                                                    │ │
  │  │  Rule 3 (Priority 3): "Excess Overtime > 4 hrs"                  │ │
  │  │  ┌──────────────────────────────────────────────────────────────┐ │ │
  │  │  │ condition:  totalHours > (shiftDuration + 4)                │ │ │
  │  │  │ action:     HOLD for review                                  │ │ │
  │  │  │ autoApply:  false (needs HR approval)                        │ │ │
  │  │  │ limit:      max 480 mins/month                               │ │ │
  │  │  └──────────────────────────────────────────────────────────────┘ │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ EXECUTION PIPELINE:                                               │ │
  │  │                                                                    │ │
  │  │  Admin triggers: POST /attendance/run-validation-process          │ │
  │  │       │                                                            │ │
  │  │       ▼                                                            │ │
  │  │  Fetch all effective rules (sorted by priority)                   │ │
  │  │       │                                                            │ │
  │  │       ▼                                                            │ │
  │  │  For EACH attendance record in scope:                             │ │
  │  │       │                                                            │ │
  │  │       ├── Check employee matches rule scope                       │ │
  │  │       │   (shift? paygroup? department? employee list?)           │ │
  │  │       │                                                            │ │
  │  │       ├── Evaluate condition against punch data                   │ │
  │  │       │                                                            │ │
  │  │       ├── Check limits (daily/weekly/monthly/annual)              │ │
  │  │       │                                                            │ │
  │  │       └── Apply action:                                           │ │
  │  │            │                                                       │ │
  │  │       ┌────┴────────────────────┐                                 │ │
  │  │       ▼                         ▼                                 │ │
  │  │  ┌──────────────┐      ┌──────────────┐                         │ │
  │  │  │ autoApply=   │      │ autoApply=   │                         │ │
  │  │  │ true         │      │ false        │                         │ │
  │  │  │              │      │              │                         │ │
  │  │  │ Apply        │      │ Mark as      │                         │ │
  │  │  │ correction   │      │ ON_HOLD      │                         │ │
  │  │  │ immediately  │      │              │                         │ │
  │  │  │ (HALF_DAY,   │      │ HR reviews   │                         │ │
  │  │  │  COMP_OFF,   │      │ later        │                         │ │
  │  │  │  MARK_LEAVE) │      │              │                         │ │
  │  │  └──────────────┘      └──────┬───────┘                         │ │
  │  │                                │                                  │ │
  │  │                           ┌────┴────┐                            │ │
  │  │                           ▼         ▼                            │ │
  │  │                     ┌──────────┐ ┌──────────┐                   │ │
  │  │                     │ APPROVE  │ │ REVERT   │                   │ │
  │  │                     │          │ │          │                   │ │
  │  │                     │ Apply    │ │ Restore  │                   │ │
  │  │                     │ correct- │ │ original │                   │ │
  │  │                     │ ion      │ │ status   │                   │ │
  │  │                     │ VALIDATED│ │ Log why  │                   │ │
  │  │                     └──────────┘ └──────────┘                   │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 12. ORGANIZATION SETUP FLOW

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                NEW ORGANIZATION ONBOARDING SEQUENCE                     │
  │                                                                          │
  │  ┌────┐   ┌────┐   ┌────┐   ┌────┐   ┌────┐   ┌────┐   ┌────┐       │
  │  │ 1  │──▶│ 2  │──▶│ 3  │──▶│ 4  │──▶│ 5  │──▶│ 6  │──▶│ 7  │       │
  │  │ Org │   │Dept│   │Pos │   │Pay │   │Leav│   │Shft│   │Sal │       │
  │  └────┘   └────┘   └────┘   └────┘   └────┘   └────┘   └────┘       │
  │    │                                                        │           │
  │    │   ┌────┐   ┌────┐   ┌────┐   ┌────┐                 │           │
  │    │──▶│ 8  │──▶│ 9  │──▶│ 10 │──▶│ 11 │                 │           │
  │    │   │Stat│   │Wkfl│   │Perm│   │Admn│                 │           │
  │    │   └────┘   └────┘   └────┘   └────┘                 │           │
  │                                                                          │
  │  Detailed Steps:                                                         │
  │                                                                          │
  │  ┌──────────────────────────────────────────────────────────────────┐   │
  │  │  1. CREATE ORGANIZATION                                         │   │
  │  │     name, legalName, taxId, industry, address, timezone         │   │
  │  │     employeeIdPrefix: "BNC", employeeIdNextNumber: 1            │   │
  │  │     fiscalYearStart: April 1                                    │   │
  │  │                                                                  │   │
  │  │  2. CREATE DEPARTMENTS                                          │   │
  │  │     Engineering, HR, Finance, Sales, Operations, Admin          │   │
  │  │     Set department managers                                      │   │
  │  │                                                                  │   │
  │  │  3. DEFINE JOB POSITIONS                                        │   │
  │  │     Engineer, Sr. Engineer, Lead, Manager, Director, VP, CXO    │   │
  │  │     Map to levels: ENTRY, JUNIOR, SENIOR, LEAD, MANAGER...     │   │
  │  │                                                                  │   │
  │  │  4. CREATE PAYGROUPS                                            │   │
  │  │     Skilled, Semi-Skilled, Management, Contract                 │   │
  │  │                                                                  │   │
  │  │  5. SETUP LEAVE TYPES                                           │   │
  │  │     EL, SL, CL, PL, ML, Comp-Off, LOP + accrual rules        │   │
  │  │     + auto-credit settings + encashment rules                   │   │
  │  │                                                                  │   │
  │  │  6. DEFINE SHIFTS                                               │   │
  │  │     Morning 9-6, Evening 2-11, Night 10-7                       │   │
  │  │     + shift assignment rules per dept/paygroup                   │   │
  │  │                                                                  │   │
  │  │  7. SALARY STRUCTURES (per paygroup)                            │   │
  │  │     Components: Basic(40%), HRA(8%), Conv, Special, PF, PT     │   │
  │  │                                                                  │   │
  │  │  8. STATUTORY CONFIG                                            │   │
  │  │     PF rates, ESIC rates, PT slabs, TDS regime                 │   │
  │  │                                                                  │   │
  │  │  9. APPROVAL WORKFLOWS                                         │   │
  │  │     Define workflows + map to paygroups/departments             │   │
  │  │                                                                  │   │
  │  │  10. PERMISSION CONFIGURATION                                   │   │
  │  │      Enable modules, assign role-permissions                    │   │
  │  │      Sync with Configurator API                                 │   │
  │  │                                                                  │   │
  │  │  11. CREATE ORG ADMIN USER                                      │   │
  │  │      ORG_ADMIN role, full org-level access                      │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 13. COMPLETE STATE MACHINE DIAGRAMS

### 13.1 Employee Status

```
                        ┌──────────────────────────────┐
                        │                              │
                        ▼                              │
  ┌──────────┐    ┌──────────┐    ┌──────────┐       │ REJOIN
  │          │    │          │    │          │       │
  │ ONBOARD  │───▶│  ACTIVE  │───▶│ RESIGNED │───────┘
  │          │    │          │    │          │
  └──────────┘    └────┬─────┘    └──────────┘
                       │
                       ├────────▶ TERMINATED ──────────┐
                       │                                │ REJOIN
                       ├────────▶ SUSPENDED             │
                       │                                │
                       ├────────▶ ON_LEAVE              ▼
                       │                           ┌──────────┐
                       └────────▶ RETIRED          │  ACTIVE  │
                                                   │  (new)   │
                                                   └──────────┘
```

### 13.2 Leave Request Status

```
                ┌──────────────────────┐
                │      PENDING         │
                │  (submitted)         │
                └──────┬────┬──────────┘
                       │    │
              APPROVE  │    │  REJECT
                       │    │
                       ▼    ▼
              ┌──────────┐ ┌──────────┐
              │ APPROVED │ │ REJECTED │
              └────┬─────┘ └──────────┘
                   │
              CANCEL│
                   ▼
              ┌──────────┐
              │CANCELLED │
              └──────────┘
```

### 13.3 Attendance Record Status

```
  ┌──────────┐      punch      ┌──────────┐
  │ ABSENT   │────────────────▶│ PRESENT  │
  │ (default)│                  └──────────┘
  └────┬─────┘
       │
       ├── leave approved ──▶ LEAVE
       ├── holiday ─────────▶ HOLIDAY
       ├── weekend ─────────▶ WEEKEND
       │
       └── validation rule ─▶ ON_HOLD
                                  │
                             ┌────┴────┐
                             ▼         ▼
                        VALIDATED   REVERTED
                        (correction  (original
                         applied)    restored)
```

### 13.4 Payroll Cycle Status

```
  DRAFT ──▶ IN_PROGRESS ──▶ PROCESSED ──▶ FINALIZED ──▶ LOCKED ──▶ PAID
  (create)  (calculating)   (payslips     (HR review    (no edits)  (salary
                             generated)    complete)                 credited)
```

### 13.5 FnF Settlement Status

```
  CALCULATED ─────────▶ APPROVED ─────────▶ PAID
  (system computed)     (HR approved)       (payment done, FINAL)
```

### 13.6 ESOP Grant Lifecycle

```
  ACTIVE ──▶ VESTING (tranches vest monthly)
                │
                ├── VESTED tranches → employee can EXERCISE
                │                          │
                │                     ┌────┴─────┐
                │                     ▼          ▼
                │                APPROVED   REJECTED
                │                     │
                │                     ▼
                │                COMPLETED (shares transferred)
                │
                └── On separation: CANCELLED (unvested → pool)
```

---

## 14. EMAIL NOTIFICATION TRIGGERS

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                  EMAIL NOTIFICATION MAP                          │
  │                                                                  │
  │  TRIGGER EVENT              │  RECIPIENTS       │  TEMPLATE     │
  │  ─────────────              │  ──────────       │  ────────     │
  │                             │                   │               │
  │  Leave Request Submitted    │  Approver          │  leave_req    │
  │  Leave Approved             │  Employee+Approver │  leave_appr   │
  │  Leave Rejected             │  Employee          │  leave_rej    │
  │  Regularization Submitted   │  HR Manager        │  reg_submit   │
  │  Payslip Generated          │  Employee          │  payslip      │
  │  FnF Initiated              │  Employee          │  fnf_init     │
  │  Employee Onboarded         │  Employee + HR     │  welcome      │
  │  Password Reset             │  Employee          │  pwd_reset    │
  │  Email Verification         │  Employee          │  verify       │
  │  Payroll Cycle Created      │  HR Team           │  payroll_cyc  │
  │  Biometric Sync Errors      │  Admin             │  bio_error    │
  │                                                                  │
  │  Email sent via: Nodemailer (SMTP)                              │
  │  Templates: HTML with action buttons (approve/reject URLs)      │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 15. INTEGRATION DATA FLOWS

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                  SYSTEM INTEGRATION MAP                                 │
  │                                                                          │
  │                        ┌──────────────────┐                             │
  │                        │   HRMS BACKEND   │                             │
  │                        │   (Express.js)   │                             │
  │                        └────────┬─────────┘                             │
  │                                 │                                        │
  │          ┌──────────────────────┼──────────────────────┐                │
  │          │                      │                      │                │
  │          ▼                      ▼                      ▼                │
  │  ┌──────────────┐     ┌──────────────┐     ┌───────────────┐          │
  │  │ Configurator │     │   eSSL API   │     │  Face Service │          │
  │  │ API (BNC AI) │     │  (Biometric) │     │  (FastAPI)    │          │
  │  │              │     │              │     │               │          │
  │  │ ◀─── Auth    │     │ ◀─── Fetch   │     │ ◀─── Encode  │          │
  │  │      sync    │     │      punch   │     │      image   │          │
  │  │ ◀─── Module  │     │      logs    │     │ ◀─── Match   │          │
  │  │      perms   │     │              │     │      face    │          │
  │  │ ───▶ User    │     │ ───▶ Create  │     │               │          │
  │  │      create  │     │      attend  │     │ ───▶ Return  │          │
  │  │ ───▶ Bulk    │     │      record  │     │      empId   │          │
  │  │      import  │     │              │     │               │          │
  │  └──────────────┘     └──────────────┘     └───────────────┘          │
  │          │                      │                      │                │
  │          ▼                      ▼                      ▼                │
  │  ┌──────────────┐     ┌──────────────┐     ┌───────────────┐          │
  │  │ SMTP Server  │     │  PostgreSQL  │     │    Redis      │          │
  │  │              │     │  (AWS RDS)   │     │               │          │
  │  │ ───▶ Send    │     │              │     │ ◀─── Cache    │          │
  │  │      emails  │     │ 100+ tables  │     │      tokens   │          │
  │  │      (notif) │     │ All data     │     │ ◀─── Blacklist│          │
  │  │              │     │              │     │      expired  │          │
  │  └──────────────┘     └──────────────┘     └───────────────┘          │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 16. MASTER PROCESS SUMMARY

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         BNC HRMS - PROCESS FLOW SUMMARY                                │
│                                                                                         │
│  ┌──────────────────┬────────────────────┬──────────────────┬─────────────────────┐    │
│  │ PROCESS          │ TRIGGER            │ KEY STATUSES     │ TIMELINE            │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Onboarding       │ HR creates         │ → ACTIVE         │ One-time            │    │
│  │                  │ employee           │                  │                     │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Bulk Import      │ Excel upload       │ → ACTIVE (batch) │ One-time batch      │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Daily Attendance │ Employee punch     │ ABSENT→PRESENT   │ Daily               │    │
│  │                  │ (bio/web/face)     │                  │                     │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Biometric Sync   │ Admin triggers     │ Raw→Processed    │ Daily/On-demand     │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Regularization   │ Employee request   │ PENDING→APPROVED │ Per incident        │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Validation Rules │ Admin runs         │ HOLD→VALIDATED   │ Monthly             │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Monthly Summary  │ Month-end          │ DRAFT→LOCKED     │ Monthly             │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Leave Request    │ Employee submits   │ PENDING→APPROVED │ Per request         │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Leave Accrual    │ Auto-credit rule   │ Balance updated  │ Monthly             │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Carry-Forward    │ Fiscal year end    │ Balance rolled   │ Annual (March)      │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────���───────┤    │
│  │ Payroll Run      │ HR initiates       │ DRAFT→PAID       │ Monthly             │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Compliance Rpt   │ Post-payroll       │ Generated        │ Monthly             │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Change Request   │ HR/Manager         │ PENDING→APPROVED │ Per change          │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Transfer/Promote │ HR records         │ Created→Applied  │ Per event           │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Separation       │ HR initiates       │ ACTIVE→RESIGNED  │ Per exit            │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ FnF Settlement   │ Post-separation    │ CALC→APPROVED    │ Weeks               │    │
│  │                  │                    │ →PAID            │                     │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Rejoin           │ HR re-hires        │ →ACTIVE (new)    │ Per re-hire         │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ ESOP Grant       │ HR issues          │ ACTIVE→VESTED    │ Years               │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ ESOP Exercise    │ Employee requests  │ PENDING→COMPLETE │ Per request         │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Comp-Off         │ Holiday work       │ Earned→Used      │ Per occurrence      │    │
│  ├──────────────────┼────────────────────┼──────────────────┼─────────────────────┤    │
│  │ Org Setup        │ Super Admin        │ 11-step config   │ One-time            │    │
│  └──────────────────┴────────────────────┴──────────────────┴─────────────────────┘    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

*Generated: March 2026 | BNC HRMS Process Flows v1.0*
