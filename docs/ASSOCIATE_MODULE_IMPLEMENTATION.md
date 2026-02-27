# Associate (Employee) Module – Paygroup & Company Details

## Summary

- **MODULE 1: Paygroup Selection (Popup)** – Before creating an employee, a popup asks for a required, searchable Paygroup. On submit, the chosen paygroup is stored and the Employee Create form opens.
- **MODULE 2: Employee Master Form – Company Details** – The first section is Company Details with: paygroup (from step 1), employee_code (auto-generated), first_name, middle_name, last_name, gender, date_of_birth, date_of_joining, official_email, official_mobile, department_id, designation_id (position), location_id, cost_centre_id, reporting_manager_id, grade, place_of_tax_deduction (Metro/Non-Metro), job_responsibility.

## Backend

### Schema (Prisma)

- **Paygroup** model: `id`, `organizationId`, `name`, `code?`, `isActive`.
- **Employee** additions: `paygroupId`, `officialEmail`, `officialMobile`, `locationId`, `costCentreId`, `grade`, `placeOfTaxDeduction` (enum METRO/NON_METRO), `jobResponsibility`.
- **Location** and **CostCentre** models for dropdowns.

### APIs

- `GET /api/v1/paygroups?organizationId=...` – list paygroups for Associate popup.
- `GET /api/v1/locations?organizationId=...` – list locations.
- `GET /api/v1/cost-centres?organizationId=...` – list cost centres.
- Employee create/update accept and persist the new Company Details fields.

### Migrations & seed

1. **Apply schema changes**

   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate dev --name add_paygroup_employee_company_fields
   ```

2. **Seed paygroups** (Bangalore Staff, BM Staff, BM Worker, Management, Staff, Worker):

   ```bash
   cd backend
   npx ts-node -r tsconfig-paths/register scripts/seed-paygroups.ts [organizationId]
   ```

   Omit `organizationId` to use the first organization in the DB.

## Frontend

### Create flow

1. User clicks **Create Employee**.
2. **Paygroup Selection** modal opens; user picks a Paygroup (searchable) and clicks **Submit**.
3. Modal closes; **Employee Form** opens with Company Details as the first section and Paygroup fixed from step 2.
4. User completes Company Details, then Personal, Employment, and Contact & Address.
5. On submit, employee is created with `paygroupId` and all Company Details fields.

### Edit flow

- User clicks **Edit** on an employee → form opens directly (no paygroup popup).
- If the employee has a paygroup, **Company Details** is shown first and includes paygroup (read-only).

### Files touched/added

- **New:** `frontend/src/components/employees/PaygroupSelectionModal.tsx`, `frontend/src/services/paygroup.service.ts`
- **Updated:** `frontend/src/pages/EmployeesPage.tsx` (create → paygroup modal then form), `frontend/src/components/employees/EmployeeForm.tsx` (Company Details tab, `initialPaygroupId`/`initialPaygroupName`, new fields and submit payload)

## Place of tax deduction

- Required when creating via the Paygroup flow.
- Options: **Metro**, **Non-Metro**.

## Location & cost centre

- Backend supports **Location** and **CostCentre** masters and list APIs.
- If no rows exist, seed or create them via separate admin/seed scripts; the Company Details dropdowns will then show options.
