# Revert Process & Validation On Hold - Complete Guide

> இந்த document-ல Validation Revert Process மற்றும் Validation On Hold feature பற்றிய முழு விளக்கம், Q&A, Testing steps எல்லாம் இருக்கு.

---

## Table of Contents

1. [Validation Process என்ன?](#1-validation-process-என்ன)
2. [Revert என்ன? எப்போது use பண்ணும்?](#2-revert-என்ன-எப்போது-use-பண்ணும்)
3. [Validation On Hold என்ன? எப்போது use பண்ணும்?](#3-validation-on-hold-என்ன-எப்போது-use-பண்ணும்)
4. [Revert vs Validation On Hold - Difference](#4-revert-vs-validation-on-hold---difference)
5. [Real-World Scenarios](#5-real-world-scenarios)
6. [Q&A - All Questions Answered](#6-qa---all-questions-answered)
7. [API Endpoints](#7-api-endpoints)
8. [Database Schema Changes](#8-database-schema-changes)
9. [Testing Guide](#9-testing-guide)
10. [UI Flow & Screenshots Guide](#10-ui-flow--screenshots-guide)

---

## 1. Validation Process என்ன?

HR ஒவ்வொரு மாதமும் attendance validate பண்ணும் process:

```
Employee Punch → System calculates → HR reviews → HR validates → Status: Completed ✅
```

**Validation Completed** ஆனா:
- அந்த நாள் **locked** 🔒
- Employee leave apply பண்ண முடியாது (or apply பண்ணாலும் payroll-ல reflect ஆகாது)
- HR correction (LOP/Permission/Leave deduction) permanently applied

**Validation Statuses:**
| Status | Meaning |
|--------|---------|
| **Pending** | Not yet processed/validated |
| **Completed** ✅ | HR validated, day is locked |
| **On Hold** ⏸️ | Temporarily frozen, not completed |

---

## 2. Revert என்ன? எப்போது use பண்ணும்?

### Revert = Permanent Undo (நிரந்தர திரும்பப்பெறுதல்)

HR validate பண்ணிட்ட correction-ஐ **completely undo** பண்றது.

**Revert பண்ணா என்ன நடக்கும்:**
1. HR-applied leave deduction (LOP/Permission/Leave) **delete** ஆகும்
2. Leave balance **restore** ஆகும்
3. Validation status → **Pending** ஆகும்
4. Day **unlock** ஆகும் 🔓
5. Employee again leave/permission apply பண்ணலாம்
6. HR மறுபடியும் Process → Validate பண்ணலாம்

### எப்போது Revert பண்ணுவாங்க?

- ❌ HR தவறா LOP mark பண்ணிட்டாங்க
- ❌ Employee-க்கு approved permission இருந்தது, ஆனா HR-க்கு தெரியல
- ❌ Biometric sync fail ஆனது, later punch data வந்தது
- ❌ Wrong leave type apply ஆனது
- ❌ DOJ/DOL date wrong-ஆ இருந்தது, correct பண்ணனும்

### முக்கியம்: HR validate பண்ணது மட்டும் தான் Revert ஆகும்

> Employee தானே leave apply பண்ணி approve ஆனது revert ஆகாது.
> HR system வழியா apply பண்ணின correction மட்டும் revert ஆகும்.

**எப்படி identify பண்றது:**
- `validationMethod` = `DIRECT_COMPONENT` / `NO_CORRECTION` / `NO_CORRECTION_FINAL`
- `leaveRequest.reviewComments` = `'Auto-approved by validation correction'`
- `leaveRequest.reason` starts with `'[Direct correction'` or `'[Validation correction'`

---

## 3. Validation On Hold என்ன? எப்போது use பண்ணும்?

### On Hold = Temporary Freeze (தற்காலிக நிறுத்தம்)

Validation-ஐ temporarily freeze பண்றது. Completed-ல இருந்து எடுத்து "on hold" state-ல வைக்கிறது.

**On Hold பண்ணா என்ன நடக்கும்:**
1. `isOnHold = true`, `isCompleted = false`
2. Calendar-ல **orange color**-ல "Validation on Hold: X" display ஆகும்
3. Leave deduction **remove ஆகாது** (Revert-போல delete ஆகாது)
4. HR Release பண்ணும் வரை hold-ல இருக்கும்

### On Hold Toggle Options:

| Option | Description |
|--------|-------------|
| **Associate Can Modify** | ON = Employee leave/permission apply பண்ணலாம் |
| **Managers Can Modify** | ON = Manager approve/reject பண்ணலாம் |
| **Revert Regularization** | ON = Existing regularization undo ஆகும் |

### எப்போது On Hold use பண்ணுவாங்க?

**Use Case 1: Mid-month hold**
```
Feb 1-7 validate பண்ணிட்டாங்க
Feb 5 la problem report ஆனது
Feb 5 ஐ On Hold பண்ணலாம்
Feb 8 onwards validation continue ஆகும் (affected ஆகாது)
```

**Use Case 2: Post-payroll correction**
```
Feb full month validate ✅
Payroll run ✅
Salary paid ✅
Employee says "Feb 14 wrong!"
Feb 14 ஐ On Hold பண்ணலாம்
Next payroll-ல adjustment/arrear ஆகும்
```

### Release from Hold

On Hold-ல இருக்குற row-ஐ release பண்ணா:
1. `isOnHold = false`
2. Day goes back to **Pending** state
3. HR Process button click பண்ணி re-validate பண்ணலாம்

---

## 4. Revert vs Validation On Hold - Difference

| Feature | Revert | Validation On Hold |
|---------|--------|--------------------|
| **Type** | Permanent undo | Temporary freeze |
| **Leave deduction** | ❌ Deleted | ✅ Stays (not deleted) |
| **Leave balance** | ✅ Restored | ❌ Not touched |
| **Status after** | Pending | On Hold |
| **Employee can apply** | ✅ Yes (immediately) | Depends on toggle |
| **When used** | Before payroll / wrong correction | After payroll / investigation needed |
| **Calendar color** | No special color (goes to pending) | 🟠 Orange |
| **Recovery** | Process again | Release → Process again |

### Simple Analogy:

```
Revert   = DELETE + UNDO  (completely erase the mistake)
On Hold  = PAUSE + FREEZE (stop and investigate, don't delete yet)
```

---

## 5. Real-World Scenarios

### Scenario 1: Late → LOP → Permission Applied

```
Step 1: Feb 10 → Employee punched at 11:30 AM (shift 9:30 AM)
        System → Late (2 hours)
        HR → LOP mark → Status: Completed ✅

Step 2: Employee says "I had manager-approved permission"

Step 3: HR clicks → Revert
        Status → Pending
        LOP → Deleted
        Balance → Restored

Step 4: Employee → Apply Permission for Feb 10
        Manager → Approve

Step 5: HR → Process → Validate
        Final: LOP ❌ removed, Permission ✅ applied
```

### Scenario 2: No Punch → Absent → Punch Added Later

```
Step 1: Feb 8 → Biometric sync failed
        System → Absent
        HR → Completed ✅

Step 2: IT department fixes biometric sync
        Punch data now available

Step 3: HR clicks → Revert
        Status → Pending

Step 4: HR clicks → Process
        System reads new punch data
        Final: Absent ❌ removed, Present ✅ marked
```

### Scenario 3: Wrong Leave → Correct Leave Applied

```
Step 1: Feb 12 → Employee on leave
        HR applied → CL (Casual Leave)
        Status → Completed ✅

Step 2: Employee says "I applied Sick Leave, not CL"

Step 3: HR clicks → Revert
        CL → Deleted, CL balance restored

Step 4: Employee → Apply SL for Feb 12
        Manager → Approve

Step 5: HR → Process → Validate
        Final: CL ❌ removed, SL ✅ applied
```

### Scenario 4: DOJ Wrong → Corrected

```
Step 1: New joinee DOJ = Feb 1
        System → marks Feb 1-5 as absent (before DOJ correction)
        HR validated → Completed

Step 2: HR corrects DOJ to Jan 15

Step 3: HR clicks → Revert (Feb 1-5)
Step 4: HR clicks → Process
        System now reads correct DOJ
        Final: Correct attendance from Feb 1
```

### Scenario 5: Holiday Missing → Added Later

```
Step 1: Feb 26 was a local holiday but not in system
        System → Absent for all employees on Feb 26
        HR validated → Completed

Step 2: Admin adds Feb 26 as holiday

Step 3: HR clicks → Revert (Feb 26)
Step 4: HR clicks → Process
        System reads holiday data
        Final: Absent ❌, Holiday ✅ (Completed)
```

---

## 6. Q&A - All Questions Answered

### Q1: HR validate பண்ணது மட்டும் தான் revert ஆகுமா? Employee leave apply பண்ணி approve ஆனதும் revert ஆகுமா?

**A:** HR validate பண்ணது மட்டும் தான் revert ஆகும். Employee தானே leave apply பண்ணி manager approve பண்ணினது revert ஆகாது. ஏன்னா அது employee-initiated action, HR correction இல்ல.

---

### Q2: Single day revert பண்ண முடியுமா?

**A:** ஆமா! Revert Process page-ல specific employee + specific date select பண்ணி revert பண்ணலாம். ஒரு employee-க்கு ஒரு day மட்டும் revert பண்ண முடியும்.

---

### Q3: Revert பண்ணிட்டு EL apply பண்ணினா Validation Completed ஏன் வரல?

**A:** Revert பண்ணின பிறகு:
1. Employee EL apply பண்ணி manager approve பண்ணணும்
2. HR **Process** button click பண்ணணும் (system fresh data read பண்ணும்)
3. Approved leave இருந்தா system automatically **Completed** mark பண்ணும்

Process button click பண்ணாம Completed வராது!

---

### Q4: Validation On Hold single day-க்கா or whole month-க்கா?

**A:** **Per day per employee**. Feb 1 to 7 on hold பண்ணா, Feb 8 onwards validation normally நடக்கும். Affected ஆகாது. Individual dates select பண்ணி hold பண்ணலாம்.

---

### Q5: On Hold பண்ணின date-ல employee event apply பண்ண முடியாதா?

**A:** Toggle-ஐ depend பண்ணும்:
- **Associate Can Modify = ON** → Employee leave/permission apply பண்ணலாம்
- **Associate Can Modify = OFF** → Employee apply பண்ண முடியாது

---

### Q6: Feb 1 to 7 On Hold பண்ணா, Feb 8 validation நடக்குமா?

**A:** ஆமா! Feb 8 onwards normal-ஆ validation process நடக்கும். On Hold பண்ணின dates மட்டும் affected. மற்ற dates independent.

---

### Q7: Validation On Hold பண்டிருக்கும்போது Revert பண்ண முடியுமா?

**A:** On Hold state-ல revert பண்ண வேண்டாம். Flow இப்படி:
1. First **Release** பண்ணு (On Hold → Pending)
2. Then **Revert** பண்ணு (if needed)
3. Or just **Process** again பண்ணு

---

### Q8: Validation On Hold-ன் use என்ன?

**A:**
- **Investigation time** வேணும் - உடனே decision எடுக்க முடியாது
- **Post-payroll correction** - salary already paid, next month adjust பண்ணணும்
- **Employee dispute** - employee complaint பண்ணிருக்காங்க, verify பண்ணணும்
- **Temporary freeze** - delete பண்ணாம hold பண்ணி later decide பண்ணலாம்

---

### Q9: "Next payroll adjustment" என்ன? Payroll run பண்ணி salary போட்டாச்சு, அப்றம எப்படி?

**A:** Feb-க்கு payroll run பண்ணி salary paid ஆயிடுச்சு. ஆனா Feb 14 wrong-ஆ LOP mark ஆயிருந்துச்சு.

**Process:**
1. Feb 14 ஐ **On Hold** பண்ணு
2. Correct leave apply பண்ணு
3. **Release** பண்ணு
4. March payroll-ல system **arrear/adjustment** calculate பண்ணும்
5. Feb-ல extra LOP deduct ஆனது March-ல refund ஆகும்

```
Feb Salary: ₹30,000 - ₹1,000 (wrong LOP) = ₹29,000
March Salary: ₹30,000 + ₹1,000 (arrear adjustment) = ₹31,000
```

---

### Q10: Revert எப்போது பண்ணுவாங்க? Month complete ஆனதுக்கு அப்றமா? Mid-ல?

**A:** **எப்போது வேணும்னாலும் பண்ணலாம்!**

- Feb 5 revert பண்ணணும் → Feb 28 வரை wait பண்ண வேண்டாம்
- Feb 6 லேயே revert பண்ணலாம்
- Single day revert supported
- Full month wait பண்ண தேவையில்லை

**Timeline restriction இல்லை** - HR எந்த நாளும் எந்த completed date-ஐயும் revert பண்ணலாம்.

---

### Q11: Priyadarshini-க்கு 3,4,5,6 leave approved ஆனா validation completed ஏன் வரல?

**A:** `isCompleted` calculation-ல bug இருந்தது. Approved leave இருந்தாலும் completed mark ஆகல. Fix applied:

```typescript
// Before (bug):
const isCompleted = normalCompleted || holidayWeekOffCompleted || lateCorrectedCompleted || earlyCorrectedCompleted;

// After (fixed):
const leaveCompleted = hasLeaveApplied && !hasPendingLeave;
const isCompleted = normalCompleted || holidayWeekOffCompleted || lateCorrectedCompleted || earlyCorrectedCompleted || leaveCompleted;
```

HR Process button click பண்ணா, approved leave-கள் automatic-ஆ "Completed" mark ஆகும்.

---

## 7. API Endpoints

### Existing Endpoints (Updated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/attendance/validation-process/run` | Run validation process (now includes onHold count) |
| GET | `/api/v1/attendance/validation-process/calendar-summary` | Calendar summary (now includes onHold count) |
| GET | `/api/v1/attendance/validation-process/employee-list` | Employee list (now supports `validationOnHold` type) |
| POST | `/api/v1/attendance/validation-process/revert` | Revert by date range (legacy - still works) |
| GET | `/api/v1/attendance/validation-process/revert-history` | Revert history audit log |

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/attendance/validation-process/completed-list` | Get completed/on-hold rows for grid |
| POST | `/api/v1/attendance/validation-process/revert-rows` | Revert specific employee+date rows |
| POST | `/api/v1/attendance/validation-process/on-hold` | Put selected rows on hold |
| POST | `/api/v1/attendance/validation-process/release-hold` | Release rows from hold |

### API Details

#### GET `/completed-list`
```
Query Params:
  organizationId (required) - UUID
  fromDate (required) - YYYY-MM-DD
  toDate (required) - YYYY-MM-DD
  paygroupId (optional) - UUID
  search (optional) - string (name or code)
  page (optional) - number (default 1)
  limit (optional) - number (default 50)

Response:
{
  rows: [{ employeeId, employeeCode, employeeName, date, isCompleted, isOnHold, holdReason }],
  total: number,
  page: number,
  limit: number
}
```

#### POST `/revert-rows`
```
Body:
{
  organizationId: UUID,
  selectedRows: [{ employeeId: UUID, date: "YYYY-MM-DD" }],
  remarks?: string
}

Response:
{
  reverted: number,
  leaveRequestsDeleted: number,
  balancesRestored: number,
  errors: [{ employeeId, date, message }]
}
```

#### POST `/on-hold`
```
Body:
{
  organizationId: UUID,
  selectedRows: [{ employeeId: UUID, date: "YYYY-MM-DD" }],
  holdAssociateCanModify?: boolean (default false),
  holdManagerCanModify?: boolean (default false),
  revertRegularization?: boolean (default false),
  reason?: string
}

Response:
{
  updated: number,
  errors: [{ employeeId, date, message }]
}
```

#### POST `/release-hold`
```
Body:
{
  organizationId: UUID,
  selectedRows: [{ employeeId: UUID, date: "YYYY-MM-DD" }]
}

Response:
{
  released: number,
  errors: [{ employeeId, date, message }]
}
```

---

## 8. Database Schema Changes

### AttendanceValidationResult - New Fields

```prisma
model AttendanceValidationResult {
  // ... existing fields ...

  isOnHold                 Boolean  @default(false) @map("is_on_hold")
  holdAssociateCanModify   Boolean  @default(false) @map("hold_associate_can_modify")
  holdManagerCanModify     Boolean  @default(false) @map("hold_manager_can_modify")
  holdReason               String?  @map("hold_reason") @db.VarChar(500)

  // ... existing fields ...
}
```

### ValidationDaySummary - New Field

```typescript
type ValidationDaySummary = {
  completed: number;
  approvalPending: number;
  late: number;
  earlyGoing: number;
  noOutPunch: number;
  shiftChange: number;
  absent: number;
  shortfall: number;
  overtime: number;
  onHold: number;       // NEW
};
```

---

## 9. Testing Guide

### Prerequisites

```bash
# Backend server start
cd backend
npm run dev
# Runs on http://localhost:5000

# Frontend server start
cd frontend
npm run dev
# Runs on http://localhost:3000
```

### Login Credentials

| Email | Password | Role |
|-------|----------|------|
| hr@gmail.com | Test@1234 | HR_MANAGER |

---

### Test Case 1: Basic Validation Process

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as HR | Dashboard loads |
| 2 | Go to HR Activities → Validation Process | Page loads |
| 3 | Set From: 2025-02-01, To: 2025-02-28 | Dates set |
| 4 | Click **Process** | Calendar shows daily counts |
| 5 | Check calendar | Green = Completed, Red = Anomaly |

---

### Test Case 2: Revert Process

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On Validation Process page, click **"Revert / Validation On Hold"** | Navigates to Revert Process page |
| 2 | See grid with completed/on-hold rows | Table shows employee code, name, date, status |
| 3 | Search by employee name/code | Filtered results |
| 4 | Select 2-3 rows via checkboxes | Bottom bar shows "X selected" |
| 5 | Click **"Revert"** (red button) | Confirmation dialog opens |
| 6 | Enter remarks, click **"Yes, Revert"** | Success dialog with counts |
| 7 | Go back to Validation Process, click Process | Reverted rows now show as Pending |

---

### Test Case 3: Validation On Hold

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On Revert Process page, select rows | Rows selected |
| 2 | Click **"Validation On Hold"** (orange button) | On Hold dialog opens |
| 3 | Toggle "Associate Can Modify" = ON | Toggle turns blue |
| 4 | Enter reason, click **"Put On Hold"** | Success dialog shows count |
| 5 | Go back to Validation Process calendar | Orange color shows "Validation on Hold: X" |
| 6 | Click on that date in calendar | Grouping modal shows "Validation on Hold" row |

---

### Test Case 4: Release from Hold

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | In calendar, click date with On Hold count | Grouping modal opens |
| 2 | Click person icon on "Validation on Hold" row | Employee Grid (Validation on Hold) opens |
| 3 | See "Release" in Correction dropdown | Only "Release" option available |
| 4 | Select rows, click **"Proceed"** | Rows released from hold |
| 5 | Go back, click Process | Released rows become Pending → can be re-validated |

---

### Test Case 5: Full Cycle (End-to-End)

```
Process → Completed ✅
    ↓
Revert / On Hold button → RevertProcessPage
    ↓
Select rows → "Validation On Hold" → On Hold ⏸️
    ↓
Calendar shows orange "Validation on Hold: 2"
    ↓
Click date → Grouping modal → "Validation on Hold: 2" with person icon
    ↓
Employee Grid → Correction: "Release" → Proceed → Released
    ↓
Process again → Completed ✅ (re-validated)
```

---

### Test Case 6: Revert History

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On Validation Process page, click **"Revert History"** tab | History tab opens |
| 2 | See audit log table | Columns: Date Range, Employees, Days Reverted, Leaves Removed, Balances Restored, Remarks, Reverted On |
| 3 | Pagination works | Next/Prev buttons if > 20 records |

---

### API Testing (via PowerShell/curl)

```powershell
# 1. Login
$resp = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"hr@gmail.com","password":"Test@1234"}'
$token = $resp.data.tokens.accessToken
$headers = @{Authorization = "Bearer $token"; "Content-Type" = "application/json"}
$orgId = $resp.data.user.employee.organizationId

# 2. Run Validation Process
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/attendance/validation-process/run" `
  -Method POST -Headers $headers `
  -Body (@{organizationId=$orgId; fromDate="2025-02-01"; toDate="2025-02-28"} | ConvertTo-Json)

# 3. Get Completed List
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/attendance/validation-process/completed-list?organizationId=$orgId&fromDate=2025-02-01&toDate=2025-02-28&limit=5" `
  -Headers $headers

# 4. Put On Hold
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/attendance/validation-process/on-hold" `
  -Method POST -Headers $headers `
  -Body (@{organizationId=$orgId; selectedRows=@(@{employeeId="<EMP_ID>"; date="2025-02-02"}); holdAssociateCanModify=$true; reason="Testing"} | ConvertTo-Json -Depth 3)

# 5. Release Hold
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/attendance/validation-process/release-hold" `
  -Method POST -Headers $headers `
  -Body (@{organizationId=$orgId; selectedRows=@(@{employeeId="<EMP_ID>"; date="2025-02-02"})} | ConvertTo-Json -Depth 3)

# 6. Revert Rows
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/attendance/validation-process/revert-rows" `
  -Method POST -Headers $headers `
  -Body (@{organizationId=$orgId; selectedRows=@(@{employeeId="<EMP_ID>"; date="2025-02-02"}); remarks="Test revert"} | ConvertTo-Json -Depth 3)
```

---

## 10. UI Flow & Screenshots Guide

### Page Navigation Map

```
Login → Dashboard
  ↓
HR Activities → Validation Process Page
  ├── Calendar Tab (main view)
  │   ├── Process button → runs validation
  │   ├── Refresh button → reloads calendar
  │   ├── "Revert / Validation On Hold" button → RevertProcessPage
  │   └── Date click → Validation Grouping Modal
  │       ├── Absent → Employee Grid (Absent)
  │       ├── Late → Employee Grid (Late)
  │       ├── Completed → Employee Grid (Completed)
  │       ├── Validation on Hold → Employee Grid (On Hold) ← NEW
  │       └── ... other types
  │
  ├── Status Tab
  ├── Late Deductions Tab
  └── Revert History Tab

RevertProcessPage (NEW)
  ├── Employee+Date grid with checkboxes
  ├── Search box (name/code filter)
  ├── Pagination
  ├── Bottom Action Bar
  │   ├── Cancel → go back
  │   ├── "Validation On Hold" (orange) → On Hold Dialog
  │   │   ├── Associate Can Modify toggle
  │   │   ├── Managers Can Modify toggle
  │   │   ├── Revert Regularization toggle
  │   │   └── Reason text field
  │   └── "Revert" (red) → Revert Confirmation Dialog
  │       └── Remarks text field
  └── Result Dialogs (success/error)

Employee Grid (Validation on Hold) (NEW)
  ├── Same layout as other Employee Grids
  ├── Correction dropdown = "Release" only
  └── Proceed → releases from hold
```

### Calendar Cell Colors

| Color | Meaning |
|-------|---------|
| 🟢 Green (`bg-green-50`) | All Completed |
| 🔴 Red (`bg-red-50`) | Has anomalies (late/absent/etc) |
| 🟡 Amber (`bg-amber-50`) | Mix of completed + anomalies |
| 🟠 Orange (`bg-orange-50`) | Has On Hold records |
| ⬜ White | No data / future date |

### Status Badges

| Badge | Color | Meaning |
|-------|-------|---------|
| Completed | 🟢 Green | `bg-green-100 text-green-800` |
| On Hold | 🟠 Orange | `bg-orange-100 text-orange-800` |
| Pending | ⚪ Gray | `bg-gray-100 text-gray-600` |

---

## Files Modified

### Backend
| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Added isOnHold, holdAssociateCanModify, holdManagerCanModify, holdReason fields |
| `backend/src/services/attendance.service.ts` | Added getCompletedList, revertByRows, putOnHold, releaseHold methods; Updated calendar aggregation for onHold |
| `backend/src/controllers/attendance.controller.ts` | Added getCompletedList, revertByRows, putOnHold, releaseHold controllers |
| `backend/src/routes/attendance.routes.ts` | Registered 4 new routes |
| `backend/src/utils/attendance.validation.ts` | Added queryCompletedListSchema, revertByRowsSchema, onHoldSchema, releaseHoldSchema |

### Frontend
| File | Changes |
|------|---------|
| `frontend/src/services/attendance.service.ts` | Added getCompletedList, revertByRows, putOnHold, releaseHold API methods; Added CompletedListRow interface; Updated ValidationDaySummary with onHold |
| `frontend/src/pages/RevertProcessPage.tsx` | **NEW** - Full page with grid, dialogs, actions |
| `frontend/src/pages/ValidationProcessPage.tsx` | Added onHold to calendar display; Changed Revert button to navigate to RevertProcessPage |
| `frontend/src/pages/ValidationProcessEmployeeGridPage.tsx` | Added validationOnHold type support with Release correction |
| `frontend/src/App.tsx` | Added RevertProcessPage route |

---

*Last updated: February 2026*
