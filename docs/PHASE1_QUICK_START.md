# Phase 1: Authentication & User Management - Quick Start Testing

## 🚀 Quick Setup (5 minutes)

### 1. Start Backend
```bash
cd backend
npm run dev
```
✅ Should see: `Server running on port 5000`

### 2. Start Frontend
```bash
cd frontend
npm run dev
```
✅ Should see: `Local: http://localhost:3000`

### 3. Open Browser
- Open: `http://localhost:3000`
- Open DevTools (F12) → Application → Local Storage (to check tokens)

---

## 🧪 Essential Tests (15 minutes) - SKIP EMAIL VERIFICATION

### ✅ Test 1: Register a New User
1. Go to `/register`
2. Fill form:
   - **First Name**: `Test`
   - **Last Name**: `User`
   - **Email**: `test@example.com` (use unique email)
   - **Password**: `Test@1234`
3. Submit
4. ✅ Check: Success message + redirected to login

### ✅ Test 1.5: Skip Email Verification (Quick Method)
**Option A: Manually verify in database (FASTEST)**
```sql
-- Connect to your database and run:
UPDATE users SET is_email_verified = true WHERE email = 'test@example.com';
```

**Option B: Use API with token from backend logs**
1. Check backend terminal for email verification token
2. Use API:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/verify-email \
     -H "Content-Type: application/json" \
     -d '{"token": "YOUR_TOKEN_FROM_LOGS"}'
   ```

**Option C: Use existing verified test user**
- If you have seed data, use an existing verified user
- Check database: `SELECT email, is_email_verified FROM users WHERE is_email_verified = true;`

### ✅ Test 2: Login
1. Go to `/login`
2. Enter: `test@example.com` / `Test@1234`
3. Submit
4. ✅ Check: Redirected to `/dashboard` + tokens in localStorage

### ✅ Test 3: View Profile
1. Navigate to `/profile`
2. ✅ Check: User info displayed correctly

### ✅ Test 4: Logout
1. Click logout button
2. ✅ Check: Redirected to login + tokens removed

### ✅ Test 5: Protected Route
1. Logout
2. Try to access `/dashboard` directly
3. ✅ Check: Redirected to `/login`

### ✅ Test 6: Password Reset (Optional - Skip if short on time)
1. Go to `/forgot-password`
2. Enter email: `test@example.com`
3. Check backend logs for reset token
4. Use API to reset:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{"token": "TOKEN_FROM_LOGS", "password": "NewPass@1234"}'
   ```
5. Login with new password

---

## 🔍 Quick Verification Checklist

| Feature | Status | Notes |
|---------|--------|-------|
| Registration works | ⬜ | |
| ~~Email verification~~ | ⏭️ **SKIPPED** | Manually verified in DB |
| Login works | ⬜ | |
| Tokens stored in localStorage | ⬜ | |
| Protected routes work | ⬜ | |
| Logout works | ⬜ | |
| Password validation works | ⬜ | |
| Error messages display | ⬜ | |

---

## 🐛 Quick Fixes

### Skip Email Verification (For Quick Testing)
```sql
-- Run this after registration to skip email verification:
UPDATE users SET is_email_verified = true WHERE email = 'test@example.com';
```

### Account locked?
```sql
UPDATE users SET locked_until = NULL, login_attempts = 0 WHERE email = 'test@example.com';
```

### Token expired?
- Just login again to get new tokens

### Can't login after registration?
- Make sure you ran the SQL to verify email (see above)
- Check: `SELECT email, is_email_verified FROM users WHERE email = 'test@example.com';`

---

## 📚 Full Testing Guide

For comprehensive testing, see: **`PHASE1_TESTING_GUIDE.md`**

---

**Quick Test Status**: ⬜ **PASS** / ⬜ **FAIL**
