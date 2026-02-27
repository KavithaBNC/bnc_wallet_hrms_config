# Fix: Workflow Mapping Migration Error

## Problem
The error occurs because:
1. The `workflow_mappings` table doesn't exist in your database
2. The migration file exists but hasn't been applied yet

## ✅ Solution (Choose One Method)

### Method 1: Use Migration Script (Easiest - Recommended)

Run this command from the **backend** directory:

```powershell
npm run migrate:workflow-mapping
```

This script will:
- ✅ Check if table already exists (safe to run multiple times)
- ✅ Create the `workflow_mappings` table
- ✅ Add all foreign key constraints
- ✅ Create the `updated_at` trigger
- ✅ Handle errors gracefully

Then regenerate Prisma client and restart:

```powershell
npx prisma generate
npm run dev
```

### Method 2: Use Prisma Migrate Deploy

**Step 1:** Stop the Backend Server (if running)
Press `Ctrl+C` in the terminal where the backend is running.

**Step 2:** Apply the Migration
```powershell
npx prisma migrate deploy
```

**Step 3:** Generate Prisma Client
```powershell
npx prisma generate
```

**Step 4:** Restart Backend Server
```powershell
npm run dev
```

### Method 3: Use `prisma db push` (Development Only)

If you prefer to push schema changes directly:

```powershell
npx prisma db push
npx prisma generate
npm run dev
```

**Note:** `db push` is for development only. Use `migrate deploy` or the script for production.

## Why This Works

- **Method 1 (Script)**: Directly executes SQL to create the table - most reliable
- **Method 2 (migrate deploy)**: Applies migrations without shadow database validation
- **Method 3 (db push)**: Pushes schema changes directly (development only)

## Verification

After running the migration, verify the table was created:

```powershell
npx prisma studio
```

Or check in your database directly - you should see the `workflow_mappings` table.

## Error Prevention

To prevent this error in the future:
- Always run migrations after adding new models to schema.prisma
- Use `npm run migrate:workflow-mapping` or `npx prisma migrate deploy` after schema changes
- Always run `npx prisma generate` after migrations
