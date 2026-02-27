# Troubleshooting

## Connection pool timeout (Timed out fetching a new connection from the connection pool)

**Error:**
```
Invalid `prisma.permission.count()` invocation ... Timed out fetching a new connection from the connection pool.
(Current connection pool timeout: 10, connection limit: 5)
```

**Cause:** Default Prisma pool has 5 connections and 10s timeout. Under load (multiple tabs, Permissions page + other API calls), requests wait for a free connection and time out.

**Fix:** Increase pool size and timeout in your `DATABASE_URL` (in **backend/.env**).

1. Open **backend/.env**.
2. Find the line `DATABASE_URL=postgresql://...`.
3. If the URL has no `?` yet, add `?connection_limit=20&pool_timeout=30` at the end.
   If it already has query params (e.g. `?schema=public`), add `&connection_limit=20&pool_timeout=30`.

**Example:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/hrms_db?connection_limit=20&pool_timeout=30
```

4. Restart the backend (`npm run dev`).

---

## EPERM when running `npx prisma generate` or starting the backend

**Error:**
```
EPERM: operation not permitted, rename '...\query_engine-windows.dll.node.tmp...' -> '...\query_engine-windows.dll.node'
```

**Cause:** On Windows, the Prisma query engine DLL is locked by another process—usually the **backend server** (`npm run dev`) or another Node process. Prisma (or Node loading the client) tries to replace/rename the DLL and fails.

**Fix (choose one):**

### Option A: Use the fix script (recommended)

From the **backend** folder in PowerShell:

```powershell
.\fix-prisma-generate.ps1
```

This stops the process on port 5000 (your backend), runs `npx prisma generate`, then you can start the backend again with `npm run dev`.

### Option B: Manual steps

1. **Stop the backend** – In the terminal where `npm run dev` is running, press **Ctrl+C**.
2. **Generate Prisma client:**
   ```powershell
   npx prisma generate
   ```
3. **Start the backend again:**
   ```powershell
   npm run dev
   ```

### Option C: If EPERM persists

- Close **all** terminals and Cursor windows that might be running the backend or using the project.
- Temporarily **exclude** the project folder (or `node_modules\.prisma`) from Windows Defender / antivirus real-time scan.
- Open a **new** terminal, `cd` to the backend folder, and run:
  ```powershell
  npx prisma generate
  npm run dev
  ```

### Option D: Clean regenerate

From the backend folder:

```powershell
# Stop backend first (Ctrl+C in its terminal), then:
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
npx prisma generate
npm run dev
```
