# Fix: "This event type is not linked to any leave type"

## Quick fix: Run the mapping script

From the backend folder:

```bash
cd backend
npm run map:unmapped-leave-components
```

This automatically creates missing Leave Types (Name = Event Name, Code = Short Name) for unmapped Attendance Components. Re-run if you add new leave components later.

---

## What causes this error?

When you select a **Type** (Event Type) in the Apply Event form, the system must link it to a **Leave Type** so the leave request can be processed. The link is based on **name/code matching**:

- **Attendance Component** (Event Type): `Short Name` and `Event Name`
- **Leave Type**: `Code` and `Name`

If the Event Type's Short Name or Event Name does not match any Leave Type's Code or Name (case-insensitive), you get this error.

---

## Step 1: Find unmapped Event Types

### Option A: Run the diagnostic script (recommended)

From the backend folder:

```bash
cd backend

# For a specific organization (replace with your org UUID):
ORGANIZATION_ID=<your-org-uuid> npm run find:unmapped-leave-components

# Or to check all organizations:
npm run find:unmapped-leave-components
```

The script will list all Leave-category Attendance Components that are not linked to any Leave Type.

### Option B: Use the API (when logged in)

Call this endpoint with your `organizationId`:

```
GET /api/v1/attendance-components/unmapped-leave-components?organizationId=<your-org-uuid>
```

Use the browser Network tab or Postman. You must be authenticated.

---

## Step 2: Where to fix the mapping

**Module:** Event Configuration → **Attendance Components**

There is no separate "mapping" screen. The link is created when the Attendance Component's **Short Name** or **Event Name** matches a Leave Type's **Code** or **Name**.

---

## Step 3: Fix options

### Option A: Edit the Attendance Component (recommended)

1. Go to **Event Configuration** (from the left sidebar).
2. Click **Attendance Components**.
3. Find the unmapped Event Type (from Step 1) and click **Edit**.
4. Update **Short Name** or **Event Name** so it matches an existing Leave Type:
   - Either **Event Name** = Leave Type **Name** (e.g. "Earned Leave")
   - Or **Short Name** = Leave Type **Code** (e.g. "EL")
5. Click **Save**.

**Example:** If your Leave Type is "Earned Leave" (code: "EL"), the Attendance Component should have:
- Event Name: `Earned Leave` OR
- Short Name: `EL`

### Option B: Create a matching Leave Type

1. Go to **Leave Management** (or wherever Leave Types are managed).
2. Create a new Leave Type with **Name** and **Code** that match your Event Type's Event Name or Short Name.
3. The system will auto-link once names/codes match.

### Option C: Manual selection when applying leave (temporary workaround)

When the Event Type has no mapping, the Apply Event form shows an extra **Leave Type** dropdown below the Type field:

1. Select your Event Type in the **Type** dropdown.
2. In the **Leave Type** dropdown, choose the correct leave type.
3. Fill in dates and reason, then Save.

This works for that request only. For a permanent fix, use Option A or B.

---

## Mapping rules (how the system links them)

| Attendance Component | Leave Type | Match? |
|---------------------|------------|--------|
| Event Name: "Earned Leave" | Name: "Earned Leave" | Yes |
| Short Name: "EL" | Code: "EL" | Yes |
| Event Name: "Sick Leave" | Code: "SL" | No (different) |
| Short Name: "CL" | Name: "Casual Leave" | Yes (if code is "CL") |

Matching is **case-insensitive** and ignores extra spaces.

---

## Quick checklist

- [ ] Run `find:unmapped-leave-components` or call the API to list unmapped Event Types
- [ ] Go to **Event Configuration → Attendance Components**
- [ ] Edit the unmapped component so Short Name/Event Name matches a Leave Type
- [ ] Or create a matching Leave Type
- [ ] Test Apply Event again
