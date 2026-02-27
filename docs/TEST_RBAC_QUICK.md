# Quick RBAC Test

## 🚀 Run on YOUR Local Machine

```bash
# 1. Start Backend
cd backend
npm run dev
# Keep this terminal open

# 2. Start Frontend (new terminal)
cd frontend
npm run dev
# Keep this terminal open

# 3. Run Automated Tests (new terminal)
cd /home/user/hrms_2026
./test_rbac.sh
```

## 📋 Test Users (All password: Test@123)

| Role | Email | Can Create | Can Update | Can Delete |
|------|-------|:----------:|:----------:|:----------:|
| SUPER_ADMIN | superadmin@test.hrms.com | ✅ | ✅ | ✅ |
| ORG_ADMIN | orgadmin@test.hrms.com | ✅ | ✅ | ✅ |
| HR_MANAGER | hrmanager@test.hrms.com | ✅ | ✅ | ❌ |
| MANAGER | manager@test.hrms.com | ❌ | ❌ | ❌ |
| EMPLOYEE | employee@test.hrms.com | ❌ | ❌ | ❌ |

## 🖱️ Quick Manual Test

1. Open http://localhost:3000
2. Login as `employee@test.hrms.com` / `Test@123`
3. Go to Employees page
4. **Expected:** No "New Employee", "Edit", or "Delete" buttons ✅

5. Logout and login as `hrmanager@test.hrms.com` / `Test@123`
6. Go to Employees page
7. **Expected:** "New Employee" and "Edit" buttons visible ✅
8. **Expected:** "Delete" button hidden ✅

## ✅ Success Checklist

- [ ] Automated test script runs without errors
- [ ] EMPLOYEE role: No create/edit/delete buttons
- [ ] MANAGER role: No create/edit/delete buttons
- [ ] HR_MANAGER: Has create/edit, no delete
- [ ] ORG_ADMIN: Has create/edit/delete
- [ ] Cross-org access blocked (see test output)

## 📊 View Results

```bash
cat rbac_test_results.txt
```

## 🔧 If Tests Fail

1. **Database not seeded:**
   ```bash
   cd backend
   npm run seed
   ```

2. **Backend not running:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Still issues:**
   - Check `RBAC_VERIFICATION.md` for detailed troubleshooting
   - Check backend logs for errors
   - Verify database is accessible
