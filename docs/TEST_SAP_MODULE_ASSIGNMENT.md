# How to Test SAP-Style Module Assignment

## Prerequisites

- Backend running: `cd backend && npm run dev`
- Frontend running: `cd frontend && npm run dev`
- Database: apply the new table (Step 1 below)

---

## Step 1: Apply database migration

Create the `organization_modules` table.

**Option A – Prisma (recommended):**

```powershell
cd backend
npx prisma db push
```

**Option B – Raw SQL:**

If you prefer SQL, run the contents of `database/organization_modules.sql` in your PostgreSQL client (e.g. pgAdmin, psql) against your HRMS database.

---

## Step 2: Super Admin – Assign modules to an organization

1. Open **http://localhost:5173/login** (or your frontend URL).
2. Log in as **Super Admin**:
   - Email: `admin@hrms.com`
   - Password: `Admin@123456`
3. Go to **Organization Management** (sidebar).
4. Find **BNC Motors** (or any org) and click **Assign modules**.
5. In the modal, select the modules this org should have (e.g. Dashboard, Employees, Department, Position, Attendance, Leave, Payroll, Module Permission).
6. Click **Save modules**.
7. You should see a success message. Org Admin for this org will now see only these modules.

---

## Step 3: Org Admin – Only sees assigned modules

1. Log out (or use an incognito/private window).
2. Log in as **Org Admin**:
   - Email: `orgadmin@hrms.com`
   - Password: `OrgAdmin@123`
3. Check the **sidebar**.
   - You should see **only** the modules you assigned in Step 2 (e.g. Dashboard, Employees, Department, etc.).
   - You should **not** see modules you did not assign (e.g. if you left out Payroll, it should not appear).
4. If you assigned **Module Permission**, it should appear; Org Admin can use it to assign modules to HR / Manager / Employee (Step 4).

---

## Step 4: Org Admin – Assign modules to HR, Manager, Employee

1. Still logged in as **Org Admin**.
2. Go to **Module Permission** (sidebar).
3. In the role dropdown, you should see only **HR Manager**, **Manager**, and **Employee** (no Org Admin).
4. The table should list **only the modules assigned to your organization** (same as your sidebar).
5. Select one or more roles (e.g. HR Manager).
6. Check **View / Add / Edit** for the modules you want that role to have.
7. Click **Apply to selected roles**.
8. You should see a success message. Those roles now have org-specific permissions for your org only.

---

## Step 5: HR Manager / Manager / Employee – See only assigned modules

1. Log out and log in as **HR Manager**:
   - Email: `hr@hrms.com`
   - Password: `Hr@123456`
2. Check the **sidebar**.
   - You should see only the modules that Org Admin gave to HR Manager in Step 4 (and that are enabled for the org).
3. Optionally repeat with a **Manager** or **Employee** account and confirm they only see what was assigned to their role.

---

## Quick checklist

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Run `prisma db push` or run `organization_modules.sql` | Table `organization_modules` exists. |
| 2 | Super Admin → Organization Management → Assign modules for BNC Motors | Modules saved; success message. |
| 3 | Log in as Org Admin | Sidebar shows only assigned modules. |
| 4 | Org Admin → Module Permission → assign View/Add/Edit to HR Manager | Success message; HR role has org-specific permissions. |
| 5 | Log in as HR Manager | Sidebar shows only modules assigned to HR for that org. |

---

## Troubleshooting

- **Org Admin sees no modules**  
  Super Admin must first use **Assign modules** for that organization and save. Until then, Org Admin has no org-specific modules.

- **"Your organization could not be determined"** on Module Permission (Org Admin)  
  The Org Admin user must have an **employee** record linked to the organization. Ensure the user has an employee profile for that org.

- **Backend error: relation "organization_modules" does not exist**  
  Run Step 1 (migration / SQL) and ensure the table was created in the correct database.

- **Permission denied on PUT /organizations/:id/modules**  
  Only Super Admin can set org modules. Confirm you are logged in as Super Admin when using Assign modules.
