# 🚨 QUICK FIX: Workflow Mapping Table Missing

## The Error
```
The table `public.workflow_mappings` does not exist in the current database.
```

## ✅ IMMEDIATE FIX (Copy & Paste These Commands)

**Open PowerShell in the backend directory and run:**

```powershell
# Step 1: Stop your backend server (Ctrl+C if running)

# Step 2: Run the migration script
npm run migrate:workflow-mapping

# Step 3: Regenerate Prisma client
npx prisma generate

# Step 4: Restart backend
npm run dev
```

That's it! The table will be created and the error will be fixed.

---

## Alternative: If npm script doesn't work

Run the script directly:

```powershell
npx ts-node -r tsconfig-paths/register src/scripts/apply-workflow-mapping-migration.ts
npx prisma generate
npm run dev
```

---

## What This Does

1. ✅ Creates `workflow_mappings` table
2. ✅ Adds foreign keys to organizations, paygroups, departments
3. ✅ Creates updated_at trigger
4. ✅ Regenerates Prisma client
5. ✅ Backend will work correctly

---

## Verification

After running, check if it worked:

```powershell
npx prisma studio
```

You should see `workflow_mappings` table in the list.
