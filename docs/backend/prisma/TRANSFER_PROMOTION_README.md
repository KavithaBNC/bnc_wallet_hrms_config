# TransferPromotion Model & Migration

## Analysis summary

The `TransferPromotion` model was derived from:

- **Validation** (`src/utils/transfer-promotion.validation.ts`): `organizationId`, `employeeId`, `paygroupId`, `effectiveDate`, `appliedFrom`, `isIncrement`, `incrementFrom`, `afterLOP`, `beforeLOP`, `incrementComponents`
- **Service** (`src/services/transfer-promotion.service.ts`): same fields, with `createdAt` / `updatedAt` in responses, and Prisma `Decimal` for `afterLOP` / `beforeLOP`, `Json` for `incrementComponents`
- **Additional field**: `notes` (optional) for HR/approver comments on the transfer or promotion

The migration **only** creates the `transfer_promotions` table and its foreign keys. It does **not** drop, truncate, or alter any other table or data.

---

## Prisma schema snippet (TransferPromotion model)

```prisma
model TransferPromotion {
  id                   String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  organizationId       String    @map("organization_id") @db.Uuid
  employeeId           String    @map("employee_id") @db.Uuid
  paygroupId           String?   @map("paygroup_id") @db.Uuid
  effectiveDate        DateTime  @map("effective_date") @db.Date
  appliedFrom          String    @map("applied_from") @db.VarChar(50)
  isIncrement          Boolean   @default(true) @map("is_increment")
  incrementFrom        DateTime?  @map("increment_from") @db.Date
  afterLOP             Decimal   @default(0) @map("after_lop") @db.Decimal(12, 2)
  beforeLOP            Decimal   @default(0) @map("before_lop") @db.Decimal(12, 2)
  incrementComponents  Json?      @map("increment_components")
  notes                String?   @db.VarChar(500)
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employee     Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  paygroup     Paygroup?    @relation(fields: [paygroupId], references: [id], onDelete: SetNull)

  @@map("transfer_promotions")
}
```

---

## Why `migrate dev` fails (P1014 / shadow database)

When you run `npx prisma migrate dev`, Prisma builds a **shadow database** and reapplies **all** migrations in order to validate them. In this project:

- The first two migrations (`20260129100000_add_sub_department`, `20260130040645_sub_department_changes`) are **empty** (no `CREATE TABLE`).
- So the shadow DB ends up with **no** base tables (no `organizations`, `employees`, `paygroups`, etc.).
- The third migration (`20260131000000_add_transfer_promotions`) creates `transfer_promotions` with foreign keys to those tables → **P1014: "The underlying table for model `organizations` does not exist."**

Your **real** database (RDS) already has those tables (e.g. from `db push` or earlier setup), so the migration is valid there. Use **`migrate deploy`** to apply migrations only to the real database (no shadow DB).

---

## Safe migration commands (use deploy, not dev)

From the **backend** directory (`bnc_wallet_hrms/backend`):

1. **Apply the migration to your real database** (no shadow DB; safe for production):

   ```bash
   npx prisma migrate deploy
   ```

2. **Regenerate the Prisma client** (required after schema or migration changes):

   ```bash
   npx prisma generate
   ```

3. **Start the backend:**

   ```bash
   npm run dev
   ```

**Do not use** `npx prisma migrate dev` until the migration history can build the full schema from scratch (e.g. by adding a baseline migration that creates `organizations`, `employees`, `paygroups`, etc., or by resetting migration history).

---

## Adding new migrations (e.g. Post to Payroll)

Because `migrate dev` fails on the shadow database, **add new migrations manually** and apply with deploy:

1. Create a new folder under `prisma/migrations/` with a timestamp and name, e.g. `20260220000000_add_post_to_payroll_mappings`.
2. Add a `migration.sql` file inside it with the `CREATE TABLE` / `ALTER TABLE` statements.
3. Apply to your real database (no shadow DB):

   ```bash
   npx prisma migrate deploy
   ```

4. Regenerate the client:

   ```bash
   npx prisma generate
   ```

**Note:** The migration only creates `transfer_promotions` and its foreign keys. It does not drop or modify any other table or data.

If `transfer_promotions` already exists (e.g. from an earlier `prisma db push`) and deploy fails with "relation already exists", mark the migration as applied without running it:

```bash
npx prisma migrate resolve --applied 20260131000000_add_transfer_promotions
npx prisma generate
```
