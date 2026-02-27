# Phase 1: Testing Now - Step by Step

**Status**: Servers starting...  
**Time**: ~10-15 minutes  
**Skip Email Verification**: ✅ Yes

---

## 🚀 Step 1: Verify Servers Are Running

### Check Backend (Port 5000)
Open browser or PowerShell:
```
http://localhost:5000
```
✅ Should see: Server response or API endpoint

### Check Frontend (Port 3000)
Open browser:
```
http://localhost:3000
```
✅ Should see: Home page or login page

---

## 🧪 Step 2: Quick Test Flow

### Test 1: Register a New User (2 minutes)

1. **Open Browser**: Go to `http://localhost:3000/register`

2. **Fill Registration Form**:
   - First Name: `Test`
   - Last Name: `User`
   - Email: `test@example.com` (or use a unique email)
   - Password: `Test@1234`
   - Confirm Password: `Test@1234`

3. **Click "Register"**

4. **Expected Result**:
   - ✅ Success message: "Registration successful! Please check your email..."
   - ✅ Redirected to login page after 3 seconds

---

### Test 2: Skip Email Verification (30 seconds)

**Option A: Using Database GUI (Easiest)**
1. Open your PostgreSQL client (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Run this SQL:
   ```sql
   UPDATE users 
   SET is_email_verified = true 
   WHERE email = 'test@example.com';
   ```
4. ✅ Verify: `SELECT email, is_email_verified FROM users WHERE email = 'test@example.com';`

**Option B: Using Command Line**
```bash
# If you have psql installed
psql -U your_username -d your_database -c "UPDATE users SET is_email_verified = true WHERE email = 'test@example.com';"
```

---

### Test 3: Login (1 minute)

1. **Go to**: `http://localhost:3000/login`

2. **Enter Credentials**:
   - Email: `test@example.com`
   - Password: `Test@1234`

3. **Click "Login"**

4. **Expected Result**:
   - ✅ Redirected to `/dashboard`
   - ✅ No error messages
   - ✅ User information displayed

5. **Verify Tokens** (Optional):
   - Open DevTools (F12)
   - Go to: Application → Local Storage → `http://localhost:3000`
   - ✅ Check for `accessToken` and `refreshToken` keys
   - ✅ Tokens should be present (long strings)

---

### Test 4: View Profile (1 minute)

1. **Navigate to**: `http://localhost:3000/profile`

2. **Expected Result**:
   - ✅ Profile page loads
   - ✅ User email displayed
   - ✅ Role displayed (likely "EMPLOYEE")
   - ✅ Verification status badge shows "Verified"

---

### Test 5: Test Protected Routes (2 minutes)

1. **While Logged In**:
   - ✅ Navigate to `/dashboard` → Should work
   - ✅ Navigate to `/profile` → Should work

2. **After Logout**:
   - Click "Logout" button (usually in dashboard or profile)
   - ✅ Should redirect to `/login`
   - ✅ Tokens removed from localStorage

3. **Try Accessing Protected Route**:
   - While logged out, try: `http://localhost:3000/dashboard`
   - ✅ Should automatically redirect to `/login`

---

### Test 6: Test Form Validation (2 minutes)

1. **Go to**: `http://localhost:3000/register`

2. **Test Empty Form**:
   - Try to submit without filling anything
   - ✅ Should show validation errors under each field

3. **Test Invalid Email**:
   - Enter: `invalid-email` (no @ symbol)
   - ✅ Should show: "Please enter a valid email address"

4. **Test Weak Password**:
   - Enter: `1234` (too short, no uppercase, no special char)
   - ✅ Should show password requirements:
     - At least 8 characters
     - At least one uppercase letter
     - At least one lowercase letter
     - At least one number
     - At least one special character

5. **Test Password Mismatch**:
   - Password: `Test@1234`
   - Confirm Password: `Different@1234`
   - ✅ Should show: "Passwords do not match"

---

### Test 7: Test Error Handling (2 minutes)

1. **Go to**: `http://localhost:3000/login`

2. **Test Wrong Password**:
   - Email: `test@example.com`
   - Password: `WrongPassword123`
   - Click Login
   - ✅ Should show: "Invalid email or password"

3. **Test Non-Existent Email**:
   - Email: `nonexistent@example.com`
   - Password: `Test@1234`
   - Click Login
   - ✅ Should show: "Invalid email or password" (same message for security)

---

## ✅ Quick Checklist

Mark each as you complete:

- [ ] **Registration** - Form submits successfully
- [ ] **Email Verification Skipped** - Manually verified in database
- [ ] **Login** - Successfully logs in and redirects to dashboard
- [ ] **Tokens** - accessToken and refreshToken in localStorage
- [ ] **Profile Page** - Loads and displays user info
- [ ] **Protected Routes** - Dashboard/profile accessible when logged in
- [ ] **Logout** - Redirects to login and removes tokens
- [ ] **Route Protection** - Cannot access dashboard when logged out
- [ ] **Form Validation** - Shows errors for invalid inputs
- [ ] **Error Messages** - User-friendly error messages display

---

## 🐛 Troubleshooting

### Backend Not Running?
```bash
cd backend
npm run dev
```
Check terminal for: `Server running on port 5000`

### Frontend Not Running?
```bash
cd frontend
npm run dev
```
Check terminal for: `Local: http://localhost:3000`

### Can't Login After Registration?
1. Make sure you ran the SQL to verify email:
   ```sql
   UPDATE users SET is_email_verified = true WHERE email = 'test@example.com';
   ```
2. Check database:
   ```sql
   SELECT email, is_email_verified FROM users WHERE email = 'test@example.com';
   ```
   Should show: `is_email_verified = true`

### Account Locked?
If you tried wrong password 5 times:
```sql
UPDATE users 
SET locked_until = NULL, login_attempts = 0 
WHERE email = 'test@example.com';
```

### Port Already in Use?
- Backend (5000): Check `KILL_PORT.md` for instructions
- Frontend (3000): Change port in `frontend/vite.config.ts` or kill process

---

## 📊 Test Results

**Testing Date**: ___________  
**Tester**: ___________  

**Results**:
- Passed: ___ / 10
- Failed: ___ / 10
- Blocked: ___ / 10

**Overall Status**: ⬜ **PASS** / ⬜ **FAIL** / ⬜ **NEEDS FIXES**

**Issues Found**:
```
[Document any issues here]
```

---

## 🎯 Next Steps

After completing tests:

1. ✅ If all tests pass → **Phase 1 is working!**
2. ✅ Document any issues found
3. ✅ Proceed to Phase 2 testing (Employee Management)
4. ✅ Or do comprehensive Phase 1 testing (see `PHASE1_TESTING_GUIDE.md`)

---

**Ready to start? Open your browser and follow the steps above!** 🚀
