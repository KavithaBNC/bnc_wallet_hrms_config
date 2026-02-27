# ⚡ RUN THIS NOW TO FIX THE ERROR

## Copy and paste these commands in PowerShell (backend directory):

```powershell
# 1. Stop backend if running (Ctrl+C)

# 2. Run migration script
npm run migrate:workflow-mapping

# 3. Generate Prisma client
npx prisma generate

# 4. Start backend
npm run dev
```

## If npm script fails, use this instead:

```powershell
npx ts-node -r tsconfig-paths/register src/scripts/apply-workflow-mapping-migration.ts
npx prisma generate
npm run dev
```

## What happens:

1. ✅ Creates `workflow_mappings` table in your database
2. ✅ Adds all foreign keys
3. ✅ Creates triggers
4. ✅ Regenerates Prisma client
5. ✅ Error will be fixed!

---

**After running, the error "table does not exist" will be gone!**
