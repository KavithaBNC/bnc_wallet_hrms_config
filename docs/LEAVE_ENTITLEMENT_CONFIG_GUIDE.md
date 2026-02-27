# Dynamic Leave Entitlement Configuration Guide

Leave entitlements are fully policy-driven. There is no hardcoded default. Admins must configure entitlements via **Leave Management** or **Auto Credit Setting**.

## Entitlement Priority

Monthly Leave Balance uses this order:

1. **employee_leave_balance** – Opening balance / carry forward (if record exists)
2. **Auto Credit Setting** – Employee / Paygroup / Department–based entitlement
3. **Leave Type defaultDaysPerYear** – Only if configured in Leave Management

If none is configured, Opening/Balance shows 0 and the system warns the admin.

---

## Step-by-Step: Configure Entitlements

### Option A: Leave Management (Default Days Per Year)

Use when entitlement is **same for all employees** for that leave type.

1. Go to **Leave Management** (or wherever Leave Types are managed).
2. Find the Leave Type (Earned Leave, Sick Leave, etc.).
3. Click **Edit**.
4. Set **Default Days Per Year** to the desired value:
   - **Earned Leave (EL):** e.g. 12, 15, or 18
   - **Sick Leave (SL):** e.g. 10 or 12
   - **Maternity Leave (ML):** e.g. 180
   - **Paternity Leave (PL):** e.g. 15
   - **Comp Off (CO):** 0 (usage-based; no fixed entitlement)
5. Save.

---

### Option B: Auto Credit Setting (Employee / Paygroup / Department–specific)

Use when entitlement varies by paygroup, department, or employee.

1. Go to **Event Configuration** → **Auto Credit Setting**.
2. Click **Add** or **Create**.
3. Configure:
   - **Event Type:** Select the leave (Earned Leave, Sick Leave, etc.).
   - **Display Name:** e.g. EL, SL.
   - **Associate:** Leave blank for all, or enter employee code for a specific employee.
   - **Paygroup:** Optional – filter by paygroup.
   - **Department:** Optional – filter by department.
   - **Auto Credit Rule:** Set entitlement days (e.g. `{ "entitlementDays": 12 }` or similar field as per your schema).
4. Set **Effective Date** and **Effective To**.
5. Save.

---

## Clearing Existing Hardcoded 12 Days

If Leave Types were created with `defaultDaysPerYear = 12`:

```bash
cd backend
npm run clear:hardcoded-leave-entitlements
```

Then configure entitlements in Leave Management or Auto Credit Setting.

---

## Validation & Warnings

- If no entitlement is configured (Leave Management, Auto Credit, or balance), Opening and Balance show **0**.
- The Monthly Details sidebar shows: *"Entitlement not configured – Configure entitlement for: [leave names]..."*.
- No fixed fallback (e.g. 12 days) is applied.

---

## Mapping Script Behavior

When you run `npm run map:unmapped-leave-components`:

- New Leave Types are created with **defaultDaysPerYear = NULL**.
- Admins must configure entitlement manually.
- No default value is assigned.
