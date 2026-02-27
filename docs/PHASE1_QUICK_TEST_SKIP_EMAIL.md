# Phase 1: Quick Test Guide (Skip Email Verification)

**Time**: ~10-15 minutes  
**Purpose**: Fast testing of core authentication features without email verification

---

## ⚡ Super Quick Setup

### 1. Start Services
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend  
cd frontend && npm run dev
```

### 2. Open Browser
- Go to: `http://localhost:3000`
- Open DevTools (F12) → Application → Local Storage

---

## 🧪 Quick Test Flow (10 minutes)

### Step 1: Register User (2 min)
1. Go to `/register`
2. Fill form:
   - First Name: `Test`
   - Last Name: `User`
   - Email: `test@example.com`
   - Password: `Test@1234`
3. Submit → ✅ Success message

### Step 2: Skip Email Verification (30 sec)
**Run this SQL command:**
```sql
UPDATE users SET is_email_verified = true WHERE email = 'test@example.com';
```

**Or use database GUI:**
- Open your PostgreSQL client
- Find the `users` table
- Find the row with email `test@example.com`
- Set `is_email_verified` to `true`
- Save

### Step 3: Login (1 min)
1. Go to `/login`
2. Enter: `test@example.com` / `Test@1234`
3. Submit
4. ✅ Should redirect to `/dashboard`
5. ✅ Check localStorage has `accessToken` and `refreshToken`

### Step 4: Test Protected Routes (2 min)
1. ✅ Navigate to `/profile` → Should work
2. ✅ Navigate to `/dashboard` → Should work
3. Click Logout
4. Try to access `/dashboard` directly → ✅ Should redirect to `/login`

### Step 5: Test Validation (2 min)
1. Go to `/register`
2. Try to submit empty form → ✅ Shows validation errors
3. Try weak password: `1234` → ✅ Shows password requirements
4. Try invalid email: `invalid` → ✅ Shows email error

### Step 6: Test Error Handling (2 min)
1. Go to `/login`
2. Enter wrong password → ✅ Shows "Invalid email or password"
3. Enter non-existent email → ✅ Shows "Invalid email or password"

---

## ✅ Quick Checklist

- [ ] Registration works
- [ ] Email verification skipped (manually verified in DB)
- [ ] Login works
- [ ] Tokens stored in localStorage
- [ ] Protected routes work
- [ ] Logout works
- [ ] Validation works
- [ ] Error messages display correctly

---

## 🎯 What You've Tested

✅ **User Registration** - Form validation, duplicate email check  
✅ **User Login** - JWT token generation, localStorage storage  
✅ **Protected Routes** - Frontend route protection  
✅ **Logout** - Token removal, redirect to login  
✅ **Form Validation** - Frontend validation feedback  
✅ **Error Handling** - User-friendly error messages  

⏭️ **Skipped**: Email verification flow (can test later)

---

## 🚀 Next Steps

After quick test:
1. ✅ Mark checklist items
2. If all pass → **Phase 1 is working!**
3. Proceed to Phase 2 testing (Employee Management)
4. Or do full Phase 1 testing with email verification (see `PHASE1_TESTING_GUIDE.md`)

---

## 💡 Pro Tips

### Create Multiple Test Users
```sql
-- Create verified test users for different roles
INSERT INTO users (email, password_hash, role, is_email_verified, is_active)
VALUES 
  ('admin@test.com', '$2b$12$...', 'SUPER_ADMIN', true, true),
  ('hr@test.com', '$2b$12$...', 'HR_MANAGER', true, true),
  ('employee@test.com', '$2b$12$...', 'EMPLOYEE', true, true);
```

### Quick Database Queries
```sql
-- Check all users
SELECT email, role, is_email_verified, is_active FROM users;

-- Verify a user
UPDATE users SET is_email_verified = true WHERE email = 'test@example.com';

-- Unlock account
UPDATE users SET locked_until = NULL, login_attempts = 0 WHERE email = 'test@example.com';

-- Check tokens in database (if stored)
SELECT email, refresh_token FROM users WHERE email = 'test@example.com';
```

---

**Quick Test Status**: ⬜ **PASS** / ⬜ **FAIL**  
**Time Taken**: ___ minutes  
**Issues Found**: ___

---

**Ready for Phase 2?** Let's test Employee Management next! 🚀
