# Attendance Rules Implementation & Validation Guide

This document explains how your HRMS backend calculates **Working Hours**, **Break**, **Deviation**, **Shortfall**, and **OT**, maps your config to code, and provides test cases and pseudo-code. Rules apply only **after** assignment (employee / department / paygroup / shift).

---

## 1. Config → Backend Field Mapping

| Your config | Backend key (in `__POLICY_RULES__` JSON) | Used in |
|-------------|------------------------------------------|---------|
| Minimum Break Hours consider as Deviation: 01:00 | `minBreakHoursAsDeviation` (HH:MM string) | Break deviation |
| Including Shift Break: NO | `includingShiftBreak` (boolean) | Allowed break |
| Consider Late as Shortfall: NO | `considerLateAsShortfall` | Shortfall |
| Consider Early Going as Shortfall: NO | `considerEarlyGoingAsShortfall` | Shortfall |
| Consider Excess Break as Shortfall: NO | `considerExcessBreakAsShortfall` | Shortfall |
| Minimum Shortfall Hours consider as Deviation: 00:00 | `minShortfallHoursAsDeviation` (HH:MM) | Shortfall deviation |
| Can Early Coming be OT: NO | `earlyComingConsideredAsOT` | OT |
| Can Excess Stay be OT: YES | `excessStayConsideredAsOT` | OT |
| Minimum OT Hours per day: 04:00 | `minOTHoursPerDay` (HH:MM) | OT |
| Maximum OT Hours per day: 16:00 | `maxOTHoursPerDay` (HH:MM) | OT |
| Round Off Option: NO | `roundOffOption` | OT |
| OT starts after Shift End | `otStartsAfterShiftEnd` (e.g. `00:01`) | OT start time |

**Shift:** `startTime` (09:00), `endTime` (18:00), `breakDuration` in **minutes** (60 for 1 hour). Break window 13:00–14:00 is not stored as times; only the duration (60 min) is used.

---

## 2. Backend Logic (How Each Is Calculated)

### 2.1 Working Hours

- **Formula:** `workHours = (checkOut - checkIn) in hours - breakHours`
- **Source:** `attendance.service.ts` → `calculateWorkHours(checkIn, checkOut, breakHours)` and `computePolicyFieldsForDay`.
- **breakHours:** From `attendanceRecord.breakHours` if set; else `shift.breakDuration / 60` (shift stores minutes).
- **Note:** There are no separate Break In/Break Out punches in the current engine; break is a single duration (e.g. 1 hour). If you have break punches, you must compute actual break duration (e.g. 14:00 − 13:00) and pass it as `breakHours` when calling the policy compute.

```text
workHours = max(0, (checkOut - checkIn) / 3600000 - breakHours)
```

### 2.2 Break Duration (Used for Deviation)

- **Allowed break:**
  - If `includingShiftBreak === true`: allowed = shift break duration in hours (`breakDuration / 60`).
  - If `includingShiftBreak === false`: allowed = `minBreakHoursAsDeviation` parsed as hours (e.g. 01:00 → 1.0). So any break **above** 1 hour is “excess”.
- **Excess break:** `excessBreakHours = max(0, actualBreakHours - allowedBreakHours)`.
- **Break deviation:** `breakDeviation = (excessBreakHours > 0.001)`.

So with **Including Shift Break: NO** and **Minimum Break Hours consider as Deviation: 01:00**, the system treats **1 hour** as the allowed break; anything above 1 hour is excess and causes **break deviation**.

### 2.3 Deviation (Yes/No)

- **Definition:** Either “break deviation” or “shortfall deviation” (or both).
- **Break deviation:** Excess break above allowed (see above).
- **Shortfall deviation:** Shortfall hours ≥ `minShortfallHoursAsDeviation` (see Shortfall below).
- **Code:** `isDeviation = breakDeviation || shortfallDeviation`.  
  `deviationReason` aggregates: Late X min; Early going X min; Excess break; Shortfall (when shortfall deviation and not break).

So: **Deviation** = flag that something is wrong (excess break and/or shortfall above threshold). It does **not** by itself reduce salary; that depends on payroll using shortfall (see below).

### 2.4 Shortfall (Hours)

- **Definition:** Only accumulated if policy says “consider X as shortfall”.
- **Sources (with your config all NO):**
  - `considerLateAsShortfall` → add `lateMinutes/60` to shortfall.
  - `considerEarlyGoingAsShortfall` → add `earlyMinutes/60` to shortfall.
  - `considerExcessBreakAsShortfall` → add `excessBreakHours` to shortfall.
- **Shortfall deviation:** `shortfallHours >= minShortfallHoursAsDeviation` (e.g. 00:00 → any shortfall counts for deviation).
- **With your config:** All three “Consider X as Shortfall” are NO → **shortfallHours = 0** always → shortfall deviation is false. So **Deviation** can only come from **break deviation** (excess break > 1 hour).

**Important:** Late and Early Going are still **computed and shown** (Late/Early Going badges). They only **feed into shortfall** (and hence salary impact) when the corresponding “Consider as Shortfall” is YES. With NO, salary need not be impacted.

### 2.5 OT (Overtime)

- **When OT is calculated:** Only when a **policy rule** is applied (rule exists for that shift/employee/date and contains the OT keys). Assignment scope: employee / department / paygroup; see Section 6.
- **Excess stay OT (your config: YES):**
  - OT start time = shift end + `otStartsAfterShiftEnd` (e.g. 18:00 + 00:01 → 18:01).
  - If `checkOut > otStartTime`: `otHours = (checkOut - otStartTime)` in hours.
  - Then: `overtimeHours = clamp(otHours, 0, maxOTHoursPerDay)`; if `overtimeHours < minOTHoursPerDay` then `overtimeHours = 0`.
- **Early coming OT (your config: NO):** Not added; early coming is ignored for OT.
- **Round off:** If `roundOffOption` true, OT hours are rounded to integer.

So **OT starts only after shift end** (plus the 1-minute grace). It is **not** “extra stay” in general; it is only the portion **after** that OT start time, then capped by min/max.

---

## 3. Differentiation

### 3.1 Deviation vs Shortfall

| Term | Meaning |
|------|--------|
| **Deviation** | A **flag** (Yes/No): either excess break **or** shortfall ≥ minimum shortfall hours. Used for reporting / compliance / calendar badge “D”. |
| **Shortfall** | A **quantity** (hours) built from late + early + excess break **only if** the policy toggles “Consider X as Shortfall” are YES. Used for salary deduction (if payroll uses it). |

With your config: shortfall is always 0 (all consider-as-shortfall = NO). Deviation can still be Yes due to **excess break** only.

### 3.2 OT vs Extra Stay

| Term | Meaning |
|------|--------|
| **Extra stay** | Any time after shift end (e.g. 18:00). Raw concept. |
| **OT (Overtime)** | Only the part of extra stay **after** `shiftEnd + otStartsAfterShiftEnd`, then **capped** by min/max OT hours. So OT ≤ extra stay, and can be 0 if stay is below min OT threshold. |

### 3.3 Late vs Shortfall

| Term | Meaning |
|------|--------|
| **Late** | Check-in after (shift start + grace). Results in **Late: X min** and can contribute to **deviation reason**. |
| **Shortfall** | Late minutes **only** count as shortfall hours if `considerLateAsShortfall` is YES. With NO, late is shown but does not add to shortfall (no salary impact from late as shortfall). |

---

## 4. When OT Is or Is Not Calculated (Your Config)

- **OT is calculated** when:
  - A Late & Others policy rule is **applicable** (assignment matches employee/department/paygroup, effective date ≤ day, shiftId matches or null).
  - `excessStayConsideredAsOT` is YES.
  - `checkOut > shiftEnd + otStartsAfterShiftEnd` (e.g. > 18:01).
  - Then: OT = clamp(stay after 18:01, 0, maxOT); if OT < 4h then OT = 0.

- **OT is not calculated** (or is 0) when:
  - No applicable policy rule for that employee/date/shift.
  - `excessStayConsideredAsOT` is NO.
  - Check-out is before or at OT start time (e.g. ≤ 18:01).
  - Stay after 18:01 is less than minimum OT (4 hours) → OT forced to 0.
  - Early coming: with `earlyComingConsideredAsOT` NO, early coming is never added to OT.

---

## 5. Output Shape (What Calendar / API Should Show)

For each day the backend (and calendar) should reflect:

| Field | Meaning |
|-------|--------|
| **Attendance Status** | PRESENT (or LATE / EARLY GOING as badges; status can stay PRESENT with late/early flags) |
| **Deviation** | Yes if break deviation or shortfall deviation; else No |
| **Shortfall Hours** | 0 with your config (all consider-as-shortfall = NO); otherwise sum of late+early+excess break when considered as shortfall |
| **OT Hours** | From excess stay after shift end, min/max applied |

Late and Early Going are shown as **badges** (Late: X min, Early going: X min) and in `deviationReason` when they contribute to deviation.

---

## 6. Rules Apply Only After Assignment

Policy is taken from **ShiftAssignmentRule** with `remarks` containing `__POLICY_RULES__`. Applicable rule is chosen by:

1. **Organization** and **effectiveDate** ≤ attendance date.
2. **Shift:** rule’s `shiftId` = employee’s shift **or** rule’s `shiftId` is null (global).
3. **Scope** (first match wins by priority):
   - If rule has **employeeIds** and current employee id is in list → use this rule.
   - Else if rule has **paygroupId** and **departmentId** and both match employee → use.
   - Else if rule has **paygroupId** only and matches → use.
   - Else if rule has **departmentId** only and matches → use.
   - Else (no filters) → org-wide rule.

So: **rules only apply after** an employee is assigned to a shift (or a rule applies by paygroup/department/org). If no rule matches, policy is null and OT uses fallback (e.g. shift-based) and deviation/shortfall may not follow the policy document.

---

## 7. Common Mistakes (Rules Created But Not Reflected)

1. **Rule not applicable:** Shift / paygroup / department / employee not set or not matching; effective date in future; wrong organization.
2. **Policy JSON not saved:** Frontend must save the rule with `__POLICY_RULES__` + JSON; if the key names differ (e.g. typo), backend ignores them.
3. **Break not from punches:** Backend uses `breakHours` (or shift break duration). If you have Break In/Out punches, something must compute break duration and set `record.breakHours` or pass it into the policy compute; otherwise break deviation uses only shift break vs `minBreakHoursAsDeviation`.
4. **OT start time:** OT starts at shift end **+** `otStartsAfterShiftEnd` (e.g. 18:01). Check-out at 18:00 gives 0 OT.
5. **Min OT threshold:** With min OT = 4h, staying until 22:01 gives 4h OT; staying until 20:00 gives 1h59m → below 4h → OT = 0 in code.

---

## 8. Pseudo-Code / Flowchart-Style Logic

```text
FUNCTION computePolicyFieldsForDay(checkIn, checkOut, breakHours, shift, policyRules, dayStart):

  // ---- Working hours ----
  workHours = (checkOut - checkIn) in hours - breakHours
  workHours = max(0, workHours)

  // ---- Late ----
  IF policyRules AND shift.startTime AND policyRules.considerLateFromGraceTime:
    graceEnd = shiftStart + shiftStartGrace
    IF checkIn > graceEnd:
      isLate = true
      lateMinutes = (checkIn - graceEnd) in minutes

  // ---- Early going ----
  IF policyRules AND shift.endTime:
    graceStart = shiftEnd - shiftEndGrace
    IF checkOut < graceStart:
      isEarly = true
      earlyMinutes = (graceStart - checkOut) in minutes

  // ---- Allowed break & break deviation ----
  IF policyRules.includingShiftBreak:
    allowedBreakHours = shift.breakDuration / 60
  ELSE:
    allowedBreakHours = parseHHMM(policyRules.minBreakHoursAsDeviation)   // e.g. 01:00 -> 1.0
  excessBreakHours = max(0, breakHours - allowedBreakHours)
  breakDeviation = (excessBreakHours > 0.001)

  // ---- Shortfall (only if consider-as-shortfall toggles are YES) ----
  shortfallHours = 0
  IF policyRules.considerLateAsShortfall AND lateMinutes != null:     shortfallHours += lateMinutes/60
  IF policyRules.considerEarlyGoingAsShortfall AND earlyMinutes != null: shortfallHours += earlyMinutes/60
  IF policyRules.considerExcessBreakAsShortfall:                      shortfallHours += excessBreakHours
  minShortfallHours = parseHHMM(policyRules.minShortfallHoursAsDeviation)
  shortfallDeviation = (shortfallHours >= minShortfallHours)

  // ---- Deviation (flag) ----
  isDeviation = breakDeviation OR shortfallDeviation
  deviationReason = concat(Late/Early/Excess break/Shortfall as applicable)

  // ---- OT (only after shift end + grace) ----
  overtimeHours = 0
  IF policyRules.excessStayConsideredAsOT AND shift.endTime:
    otStartTime = shiftEnd + parseHHMM(policyRules.otStartsAfterShiftEnd)   // e.g. 18:01
    IF checkOut > otStartTime:
      otHours = (checkOut - otStartTime) in hours
      minOT = parseHHMM(policyRules.minOTHoursPerDay)    // 4
      maxOT = parseHHMM(policyRules.maxOTHoursPerDay)    // 16
      overtimeHours = clamp(otHours, 0, maxOT)
      IF overtimeHours < minOT: overtimeHours = 0
  IF policyRules.earlyComingConsideredAsOT AND shift.startTime AND checkIn < shiftStart:
    overtimeHours += (shiftStart - checkIn) in hours
  IF policyRules.roundOffOption: overtimeHours = round(overtimeHours)

  RETURN workHours, overtimeHours, isLate, lateMinutes, isEarly, earlyMinutes,
         isDeviation, deviationReason
```

---

## 9. Test Scenarios (Punch In/Out; Break = 1h from shift)

**Shift:** 09:00–18:00, break 1h (60 min). **Policy:** As in your config (break deviation > 1h; shortfall all NO; excess stay OT YES; min OT 4h, max 16h; OT starts 00:01 after shift end).

- **Break:** System uses `breakHours` (e.g. 1.0). There are no Break In/Out punches in the current engine; if your device sends them, a separate step must convert them to `breakHours` for the day.

### 9.1 Expected Results in Calendar View (Summary Table)

| # | Scenario | Punch In | Punch Out | breakHours | Status | Late | Early Going | Deviation | Shortfall Hrs | OT Hrs | Why OT / No OT |
|----|----------|----------|-----------|------------|--------|------|-------------|-----------|---------------|--------|----------------|
| A | Late entry, full hours | 10:00 | 19:00 | 1 | PRESENT | 60 min | No | No | 0 | **0** | Checkout 19:00 → stay after 18:01 ≈ 1h; below min OT 4h → OT = 0 (backend enforces min). |
| B | Early exit, no shortfall | 09:00 | 17:00 | 1 | PRESENT | No | 60 min | No | 0 | 0 | Checkout before 18:00; no excess stay. |
| C | Excess break > 1h | 09:00 | 18:00 | 1.5 | PRESENT | No | No | **Yes** | 0 | 0 | Excess break 0.5h > allowed 1h → break deviation. Shortfall not considered. |
| D | Excess stay after shift | 09:00 | 22:00 | 1 | PRESENT | No | No | No | 0 | **0** | 22:00−18:01 = 3h59m < min OT 4h → OT = 0. |
| D' | Same, OT ≥ min | 09:00 | 22:01 | 1 | PRESENT | No | No | No | 0 | **4** | 22:01−18:01 = 4h ≥ min → OT = 4h. |
| E | OT below minimum | 09:00 | 20:00 | 1 | PRESENT | No | No | No | 0 | **0** | 20:00−18:01 ≈ 1h59m < 4h → OT = 0. |
| F | OT above max cap | 09:00 | 10:00+1d | 1 | PRESENT | No | No | No | 0 | **16** | OT capped at 16h. |
| G | Punch on leave day | — | — | — | LEAVE | — | — | — | — | **0** | workingHoursInLeaveAsOT=NO; leave day not counted as OT. |
| H | Early coming | 08:00 | 18:00 | 1 | PRESENT | No | No | No | 0 | **0** | earlyComingConsideredAsOT=NO; 08:00–09:00 not OT. |
| I | 1 min early (edge) | 09:00 | 17:59 | 1 | PRESENT | No | 1 min | No | 0 | 0 | Early 1 min; shortfall=0 → no deviation. |

**Note (A):** If your backend enforces “OT = 0 when computed OT < minOTHoursPerDay”, then A gives OT = 0; only when stay after 18:01 reaches 4h (e.g. checkout 22:01) does OT show 4h.

### 9.2 Scenario Descriptions

- **A. Late entry but full working hours:** In 10:00, Out 19:00, break 1h → work 8h. Late 60 min; OT from 18:01 to 19:00 (subject to min 4h rule).
- **B. Early exit but no shortfall:** In 09:00, Out 17:00 → Early going 60 min; shortfall = 0 (consider early as shortfall = NO).
- **C. Excess break above 1h:** breakHours = 1.5; allowed = 1h → break deviation Yes; shortfall still 0.
- **D/E.** OT only after 18:01; below 4h → 0; from 22:01 onward → 4h+.
- **F.** OT capped at 16h.
- **G.** Leave day: status LEAVE; no OT from leave.
- **H.** Early coming not OT (config NO).
- **I.** 1 min early: Early going 1 min; no shortfall → no deviation.

---

## 10. Calendar View Checklist

- **Late:** Shown when `isLate` or computed late minutes (with grace) > 0.
- **Early going:** Shown when `isEarly` or computed early minutes (with grace) > 0.
- **Deviation:** Show “D” (or Yes) when `isDeviation` is true; tooltip/description can show `deviationReason`.
- **OT:** Show OT hours when `otMinutes` > 0 (or `overtimeHours`).
- **Shortfall hours:** Display when you have a shortfall concept (with your config it is always 0).

---

## 11. Salary and OT Summary

- **Salary:** With “Consider Late/Early Going/Excess Break as Shortfall” all NO, **shortfall = 0** → no deduction from these rules. Salary is only impacted if payroll uses shortfall and you later set any of these to YES.
- **OT:** Starts **only after** shift end + `otStartsAfterShiftEnd` (e.g. 18:01). Below min OT (4h) → 0; above max (16h) → capped at 16h.

This aligns backend logic with your config and gives you a single reference for implementation, testing, and validation.
