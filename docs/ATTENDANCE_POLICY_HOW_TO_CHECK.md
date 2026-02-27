# Attendance Policy (Late & Others) – How to Check

## Why you saw only D (Shortfall) and no L (Late)

- **L** (Late) is set when check-in time is **after** shift start + grace (e.g. 9:00 + 4 min = 9:04).
- **D** (Deviation) can be set for **shortfall** (late + early + excess break counted as shortfall) or excess break.
- If the system compared punch time in one timezone and shift time in another, **late** could be missed and only **shortfall** (D) would show.

**Fix applied:** Shift times are now built from the **check-in date (local)** so late is computed correctly. After refresh, days with late punch-in should show **both L and D** when applicable.

---

## How to check that L and D work

### 1. Policy settings (Late & Others rule)

- **Shift Start Grace (minutes):** e.g. **4** (4 minutes after shift start).
- **Consider Late from Grace Time:** **YES**.
- **Consider Late as Shortfall:** If **YES**, late minutes count toward shortfall and you can see **both L and D**.
- **Minimum Shortfall Hours as Deviation:** If **00:00**, any shortfall can mark deviation (D).
- Rule must apply to the employee (correct shift / department / paygroup) and **effective date** on or before the day you check.

### 2. Shift

- **General Shift** (or the shift used in the rule) **start time** = **09:00** (or whatever you expect).
- Grace 4 min → late if punch-in **after 09:04**. So **09:10** or **09:15** should be **late**.

### 3. Only punch-in (Currently In)

- Punch in at **09:15** (no punch-out).
- Open **Attendance** → **Calendar**.
- You should see **L** (and tooltip e.g. **Late 11 min**).
- This path uses “late only” logic and was already working for you.

### 4. Full day (punch-in + punch-out)

- Punch in at **09:15**, punch out at **06:00 PM**.
- **Refresh** the calendar.
- You should see **both L and D** when:
  - Late is considered (e.g. **Consider Late from Grace Time** = YES, grace 4 min), and  
  - Shortfall is considered (e.g. **Consider Late as Shortfall** = YES and shortfall ≥ minimum).
- **L** = late punch-in (hover shows e.g. “Late 11 min”).
- **D** = deviation (hover shows e.g. “Late 11 min; Shortfall” or “Shortfall”).

### 5. If L still does not appear

- **Refresh** the page (backfill runs when loading records).
- Confirm **Shift Start Grace (minutes)** = **4** (not only the time field 04:00, which is 4 hours).
- Confirm **Consider Late from Grace Time** = **YES**.
- Confirm shift **start time** is **09:00**.
- Check **effective date** of the rule is on or before the attendance date.

---

## Summary

| Indicator | Meaning |
|-----------|--------|
| **L**     | Late (check-in after shift start + grace). |
| **EG**    | Early going (check-out before shift end − grace). |
| **D**     | Deviation (shortfall and/or excess break). |
| **OT**    | Overtime (excess stay after shift end). |

When you are late **and** shortfall is enabled, you can see **both L and D** on the same day. L shows late; D shows deviation (e.g. shortfall). Hover on **L** to see “Late X min”.
