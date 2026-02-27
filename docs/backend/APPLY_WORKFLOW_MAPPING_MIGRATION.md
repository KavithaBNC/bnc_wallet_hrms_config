# Apply Workflow Mapping Migration

## 🔴 Error
```
The table `public.workflow_mappings` does not exist in the current database.
```

## ✅ Solution

The migration file exists but hasn't been applied to your database. Use one of these methods:

### Method 1: Use the Migration Script (Recommended - Easiest)

Run this command from the **backend** directory:

```powershell
npm run migrate:workflow-mapping
```

This script will:
- Check if the table already exists
- Create the `workflow_mappings` table
- Add all foreign key constraints
- Create the `updated_at` trigger
- Handle errors gracefully

### Method 2: Use Prisma Migrate Deploy

If you prefer using Prisma's migration system:

```powershell
# Stop backend server first (Ctrl+C)
npx prisma migrate deploy
npx prisma generate
npm run dev
```

### Method 3: Manual SQL (If above methods fail)

Connect to your database and run the SQL from:
`backend/prisma/migrations/20260206000000_add_workflow_mapping/migration.sql`

## After Migration

1. **Regenerate Prisma Client** (required):
   ```powershell
   npx prisma generate
   ```

2. **Restart Backend Server**:
   ```powershell
   npm run dev
   ```

## Verification

After applying the migration, verify the table exists:

```powershell
npx prisma studio
```

Or check in your database directly - you should see the `workflow_mappings` table.

## Why This Error Occurred

The migration file was created but never applied to your AWS RDS database. The script or `prisma migrate deploy` will apply it now.
