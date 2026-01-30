# How to Check Dynamic Module Permissions

## 1. Seed permissions (one-time or after adding new modules)

From project root:

```powershell
cd backend
npx ts-node src/scripts/seed-permissions.ts
```

Or from project root:

```powershell
npx ts-node backend/src/scripts/seed-permissions.ts
```

You should see lines like `✅ Created permission: dashboard.read` (or `⏭️ Skipped (exists)` if already present). At the end it assigns all permissions to HR_MANAGER and ORG_ADMIN.

## 2. Start the app

- Backend: `cd backend` then `npm run dev` (port 5000)
- Frontend: `cd frontend` then `npm run dev` (port 3000)

Or use `.\run.ps1` from project root to start both.

## 3. What to check

### A. Super Admin

1. Log in as **Super Admin**.
2. **Sidebar**: You should see all menus including **Organization Management** and **Module Permission**.
3. Open **Module Permission** (`/permissions`).
4. Select role **MANAGER** or **EMPLOYEE**.
5. Toggle **View / Add / Edit / Delete** for some modules (e.g. uncheck **View** for Leave Management).
6. Click **Save** and confirm success.

### B. Org Admin

1. Log in as **Org Admin**.
2. **Sidebar**: You should see **Module Permission** and all other modules (no Organization Management).
3. Open **Module Permission** and assign/remove permissions for HR_MANAGER, MANAGER, or EMPLOYEE as above.

### C. Manager or Employee (with limited permissions)

1. Log in as a user with role **MANAGER** or **EMPLOYEE** whose permissions you just limited (e.g. no View on Leave).
2. **Sidebar**: The **Leave Management** menu item should **not** appear (no view permission).
3. If you open `/leave` directly (e.g. bookmark), you should be **redirected to Dashboard** (page access gated).
4. Modules where you have only **View** (no Add/Edit/Delete): you should see the page but Add/Edit/Delete buttons can be hidden or disabled when you use `usePermissions()` in those pages.

### D. Module Permission screen layout

- **Module Permission** is visible only to **Super Admin** and **Org Admin**.
- If you log in as **HR_MANAGER**, you should **not** see **Module Permission** in the sidebar.
- If you open `/permissions` as HR_MANAGER (e.g. type URL), you should see **Access Denied** (page blocks non–Super Admin / non–Org Admin).

## 4. Quick checklist

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run seed-permissions | New app-module permissions created/assigned |
| 2 | Login as Super Admin | Sidebar: Organization Management + Module Permission visible |
| 3 | Open Module Permission | Table: MODULE \| View \| Add \| Edit \| Delete |
| 4 | Select MANAGER, uncheck View for "Leave Management", Save | Success message |
| 5 | Login as that MANAGER | Leave Management not in sidebar |
| 6 | As MANAGER, go to `/leave` | Redirect to Dashboard |
| 7 | Login as Org Admin | Module Permission visible; Organization Management not visible |
| 8 | Login as HR_MANAGER | Module Permission not in sidebar |

## 5. Troubleshooting

- **Sidebar shows no modules (or only some)**  
  Ensure seed ran and the user’s role has at least **read** for those resources. Super Admin and Org Admin always see all modules (except super_admin_only for Org Admin).

- **"Module Permission" not in sidebar**  
  Only **Super Admin** and **Org Admin** see it. HR_MANAGER does not.

- **Permission table empty or missing rows**  
  Run `seed-permissions.ts` again. Ensure backend returns permissions (e.g. GET `/api/v1/permissions`) and that the frontend config `APP_MODULES` matches the resources in the seed (dashboard, employees, departments, etc.).

- **Replace saves but role still has old permissions**  
  Hard refresh (Ctrl+F5) or log out and log in again so the UI and any cached permissions are updated.
