# HRMS Module Setup Guide (Tamil)
_New HRMS Admin க்கு module-by-module நடைமுறை guide_

---

## 1) Recommended Setup Order (First என்ன செய்யணும்)

1. **Employees (base master)**
2. **Time Attendance**
   - Shift Master
   - Shift Assign
   - Associate Shift Change
3. **Attendance Policy**
   - Late & Others
   - Week of Assign
   - Holiday Assign
   - Excess Time Conversion
   - OT usage rule
4. **Event Configuration**
   - Attendance Components
   - Approval Workflow
   - Workflow Mapping
   - Rights Allocation
   - Rule Setting
   - Auto Credit Setting
   - Encashment / Carry Forward
5. **Event**
   - Excess Time Request
   - Excess Time Approval
   - Event Apply
   - Event Request
   - Event Approval
   - Event Balance Entry
6. **Payroll Master**
   - Employee Separation
   - Employee Rejoin
7. **Transaction**
   - Increment
   - Transfer and Promotion Entry
   - Emp Code Transfer
   - Pay group Transfer

---

## 2) Module Link Map (எது எதுடன் link? எங்கே reflect ஆகும்?)

### Employees
- **Add/Update in:** Employees, Department, Position, Paygroup
- **Links to:** Time Attendance, Attendance Policy, Event, Payroll, Transaction
- **Reflect ஆகும் இடம்:**
  - Shift assignment eligibility
  - Policy matching (dept/paygroup/employee scope)
  - Leave/Event apply list
  - Payroll separation/rejoin screens

### Time Attendance > Shift Master
- **Add:** Shift timing (start/end, grace, break, OT flags)
- **Links to:** Shift Assign, Attendance Policy, Event Apply (permission window)
- **Reflect:**
  - Attendance calendar status (Late/Early/OT/Deviation)
  - Permission allowed time range
  - Monthly attendance calculations

### Time Attendance > Shift Assign
- **Add:** யாருக்கு எந்த shift
- **Links to:** Attendance Policy rule picking
- **Reflect:**
  - Employee தினசரி attendance logic எந்த shift அடிப்படையில் போகும்

### Time Attendance > Associate Shift Change
- **Add:** Employee shift change (effective)
- **Links to:** Attendance day-wise computation
- **Reflect:**
  - Change dateக்கு பிறகு new shift rules apply ஆகும்

### Attendance Policy > Late & Others
- **Add:** Grace, late, early, shortfall, OT behavior
- **Links to:** Attendance processing engine
- **Reflect:**
  - L, EG, D, OT போன்ற markers
  - Work hours vs shortfall behavior

### Attendance Policy > Week of Assign
- **Add:** Week-off pattern
- **Links to:** Attendance day classification
- **Reflect:**
  - Calendarல் week-off mark

### Attendance Policy > Holiday Assign
- **Add:** Holiday allocation (scope-wise)
- **Links to:** Attendance + Event deduction logic
- **Reflect:**
  - Calendarல் holiday mark
  - Leave counting rules

### Attendance Policy > Excess Time Conversion
- **Add:** Excess நேரம் event/credit conversion
- **Links to:** Event/comp-off usage
- **Reflect:**
  - Excess-time request value and balance behavior

### Attendance Policy > OT usage rule
- **Add:** Min OT, Max OT, round-off, OT start logic
- **Links to:** Attendance OT computation
- **Reflect:**
  - OT eligible minutes/hours

### Event Configuration > Attendance Components
- **Add:** Event type definition (Leave/Onduty/Permission flags)
- **Links to:** Event Apply, Balance Entry, Approval flow
- **Reflect:**
  - Apply screen dropdown
  - Balance track on/off
  - Hourly/datewise availability

### Event Configuration > Approval Workflow
- **Add:** Approval levels/flow template
- **Links to:** Workflow Mapping
- **Reflect:**
  - Event Request -> Event Approval route

### Event Configuration > Workflow Mapping
- **Add:** Dept/paygroup/employeeக்கு எந்த workflow
- **Links to:** Event Apply submission
- **Reflect:**
  - Correct approverக்கு request போகும்

### Event Configuration > Rights Allocation
- **Add:** Role-based rights
- **Links to:** UI access + actions
- **Reflect:**
  - Menu visibility / add-edit permissions

### Event Configuration > Rule Setting
- **Add:** Event-specific business rule
- **Links to:** Apply validation
- **Reflect:**
  - Rule-based accept/reject behavior

### Event Configuration > Auto Credit Setting
- **Add:** Periodic credit rules
- **Links to:** Balance engine
- **Reflect:**
  - Periodic leave credits auto update

### Event Configuration > Encashment / Carry Forward
- **Add:** Year-end carry/encash rules
- **Links to:** Leave balance rollover
- **Reflect:**
  - Year close balance and payroll impact

### Event > Event Balance Entry
- **Add:** Opening balance
- **Links to:** Event Apply
- **Reflect:**
  - Available balance count

### Event > Event Apply / Request / Approval
- **Add:** Employee apply + manager approval
- **Links to:** Leave balance + attendance summary
- **Reflect:**
  - Approved event attendance/calculationல் தெரியும்

### Event > Excess Time Request / Approval
- **Add:** Excess time claims
- **Links to:** OT/comp-off conversion
- **Reflect:**
  - Creditable/usable value for employee

### Payroll Master > Employee Separation/Rejoin
- **Add:** Exit/rejoin records
- **Links to:** Payroll + attendance continuity
- **Reflect:**
  - Active employee payroll inclusion/exclusion

### Transaction Modules
- **Add:** Increment / transfer / paygroup transfer / emp code transfer
- **Links to:** Payroll + policy scope
- **Reflect:**
  - Paygroup-based policy mapping changes
  - Salary and employee identity continuity

---

## 3) Multiple Shift Setup (General Shift + General Morning Shift + optional Night Shift)

### A) Shift Definitions
- **General Shift:** 09:00 - 18:00
- **General Morning Shift:** 06:00 - 14:00
- **Night Shift (optional):** 22:00 - 06:00

### B) Shift Assign Priority Model
- Priority 300: Employee-specific
- Priority 200: Department + Paygroup
- Priority 100: Shift default
- Priority 50: Org fallback

> Important: Shift Assignment rule selectionல் higher priority value first (desc) evaluate ஆகும்.

### C) Attendance Policy Per Shift (separate rule)
- `LateOthers_General`
- `LateOthers_GeneralMorning`
- `LateOthers_Night`

ஒவ்வொன்றுக்கும் grace, shortfall, OT வேறாக set பண்ணவும்.

---

## 4) Recommended Rule Values (Sample)

### General Shift (09:00-18:00)
- Shift Start Grace: `00:10`
- Shift End Grace: `00:10`
- Consider Late from Grace: `YES`
- Consider Early Going from Grace: `YES`
- Consider Late as Shortfall: `YES`
- Consider Early Going as Shortfall: `YES`
- Consider Excess Break as Shortfall: `YES`
- Min Shortfall as Deviation: `00:15`
- Excess Stay as OT: `YES`
- Early Coming as OT: `NO`
- Min OT/day: `01:00`
- Max OT/day: `04:00`
- OT starts after shift end: `00:01`
- Round Off: `YES`

### General Morning Shift (06:00-14:00)
- Shift Start Grace: `00:05`
- Shift End Grace: `00:05`
- Consider Late from Grace: `YES`
- Consider Early Going from Grace: `YES`
- Consider Late as Shortfall: `YES`
- Consider Early Going as Shortfall: `YES`
- Consider Excess Break as Shortfall: `NO`
- Min Shortfall as Deviation: `00:10`
- Excess Stay as OT: `YES`
- Early Coming as OT: `NO`
- Min OT/day: `00:30`
- Max OT/day: `03:00`
- OT starts after shift end: `00:01`
- Round Off: `NO`

---

## 5) இந்த rule set பண்ணினா என்ன நடக்கும்? (Outcome Summary)

- Grace முடிந்த பிறகு punch-in => **Late**
- Early out => **Early Going**
- Late/Early shortfall flags ON என்றால் => **Deviation/Shortfall** கூட வரும்
- OT Min-ஐ மீறினால் மட்டுமே OT count
- Round Off OFF என்றால் exact OT minutes
- Week-off/Holiday assign செய்யப்பட்ட date-ல் attendance classification மாற்றம்
- Event component flags அடிப்படையில்:
  - balance track ON/OFF
  - hourly apply ON/OFF
  - auto credit ON/OFF
- Workflow mapping சரியாக இருந்தால் request சரியான approverக்கு போகும்

---

## 6) Go-Live க்கு முன் Quick UAT Checklist

- [ ] 2 employees (General Shift, General Morning Shift)
- [ ] 1 Late case
- [ ] 1 Early Going case
- [ ] 1 OT case
- [ ] 1 Week-off date verify
- [ ] 1 Holiday date verify
- [ ] 1 Event Apply -> Approval end-to-end
- [ ] Event Balance Entry opening check
- [ ] Separation/Rejoin sample continuity check

---

## 7) Final Notes

- Employee master clean இல்லாமல் policy setup தொடங்காதீங்க.
- Shift + policy overlap avoid பண்ண clear naming & priority use பண்ணவும்.
- Mid-pay-cycleல் major policy change avoid பண்ணவும்.
- முதலில் pilot group run பண்ணி பிறகு org-wide rollout செய்யவும்.
