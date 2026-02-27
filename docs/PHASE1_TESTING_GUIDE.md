# Phase 1: Authentication & User Management - Testing Guide

**Phase**: Authentication & User Management  
**Status**: ✅ Complete  
**Testing Date**: ___________  
**Tester**: ___________  

---

## 📋 Pre-Testing Checklist

Before starting, ensure you have:

- [ ] Backend server running on `http://localhost:5000`
- [ ] Frontend server running on `http://localhost:3000`
- [ ] Database (PostgreSQL) running and migrated
- [ ] Browser developer tools open (F12) - Network tab and Console tab
- [ ] Email service configured (or check backend logs for email tokens)

---

## 🚀 Step 1: Start the Application

### 1.1 Start Backend Server

```bash
cd backend
npm run dev
```

**Expected Output:**
```
Server running on port 5000
Database connected successfully
```

### 1.2 Start Frontend Server

```bash
cd frontend
npm run dev
```

**Expected Output:**
```
VITE ready in XXX ms
Local: http://localhost:3000
```

### 1.3 Verify Services

- [ ] Backend: Visit `http://localhost:5000/api/v1/health` (if available) or check terminal
- [ ] Frontend: Visit `http://localhost:3000` - should show home page

---

## 🧪 Test 1: User Registration

### Test 1.1: Successful Registration

**Steps:**
1. Navigate to `http://localhost:3000/register`
2. Fill in the registration form:
   - **First Name**: `John`
   - **Last Name**: `Doe`
   - **Email**: `john.doe@example.com` (use a unique email)
   - **Password**: `Test@1234` (must meet requirements)
   - **Confirm Password**: `Test@1234`
3. Click "Register" button

**Expected Results:**
- [ ] Success message displayed: "Registration successful! Please check your email to verify your account."
- [ ] Redirected to login page after 3 seconds
- [ ] Check backend terminal/logs for email verification token (in development)
- [ ] User created in database with `isEmailVerified: false`

**API Test (Optional):**
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "password": "Test@1234"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "...",
      "email": "jane.smith@example.com",
      "role": "EMPLOYEE",
      "isEmailVerified": false
    }
  }
}
```

---

### Test 1.2: Registration Validation - Invalid Email

**Steps:**
1. Navigate to `http://localhost:3000/register`
2. Enter invalid email: `invalid-email`
3. Try to submit

**Expected Results:**
- [ ] Error message: "Please enter a valid email address"
- [ ] Form does not submit
- [ ] Email field highlighted in red

---

### Test 1.3: Registration Validation - Weak Password

**Steps:**
1. Navigate to `http://localhost:3000/register`
2. Enter weak password: `1234`
3. Try to submit

**Expected Results:**
- [ ] Error message about password requirements
- [ ] Password requirements shown:
  - At least 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- [ ] Form does not submit

---

### Test 1.4: Registration Validation - Duplicate Email

**Steps:**
1. Try to register with an email that already exists
2. Submit the form

**Expected Results:**
- [ ] Error message: "Email already registered"
- [ ] Form does not submit

---

## 🔐 Test 2: User Login

### Test 2.1: Successful Login (Unverified Email)

**Steps:**
1. Navigate to `http://localhost:3000/login`
2. Enter credentials from Test 1.1 (before email verification)
3. Click "Login"

**Expected Results:**
- [ ] Error message: "Please verify your email before logging in"
- [ ] User remains on login page
- [ ] No tokens stored in localStorage

---

### Test 2.2: Email Verification

**Steps:**
1. Check backend logs/terminal for email verification token
2. Copy the token from logs
3. Use API to verify email:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/verify-email \
     -H "Content-Type: application/json" \
     -d '{
       "token": "YOUR_TOKEN_FROM_LOGS"
     }'
   ```
4. Or check database for `emailVerificationToken` and use it

**Expected Results:**
- [ ] Success response: "Email verified successfully"
- [ ] User's `isEmailVerified` set to `true` in database

---

### Test 2.3: Successful Login (After Verification)

**Steps:**
1. Navigate to `http://localhost:3000/login`
2. Enter verified email and password
3. Click "Login"

**Expected Results:**
- [ ] Redirected to `/dashboard`
- [ ] Access token stored in localStorage (check DevTools → Application → Local Storage)
- [ ] Refresh token stored in localStorage
- [ ] User information displayed on dashboard
- [ ] No error messages

**Verify in Browser DevTools:**
- [ ] Open Application/Storage → Local Storage → `http://localhost:3000`
- [ ] Check for `accessToken` and `refreshToken` keys
- [ ] Tokens should be present and valid JWT format

---

### Test 2.4: Login Validation - Invalid Credentials

**Steps:**
1. Navigate to `http://localhost:3000/login`
2. Enter incorrect password
3. Click "Login"

**Expected Results:**
- [ ] Error message: "Invalid email or password"
- [ ] User remains on login page
- [ ] Login attempts incremented in database

---

### Test 2.5: Account Lockout (5 Failed Attempts)

**Steps:**
1. Try to login with wrong password 5 times
2. On 6th attempt, try with correct password

**Expected Results:**
- [ ] After 5 failed attempts: Account locked message
- [ ] Error: "Account is locked. Please try again in X minutes"
- [ ] Account locked for 30 minutes
- [ ] `lockedUntil` field set in database

**Wait 30 minutes or manually update database:**
```sql
UPDATE users SET locked_until = NULL, login_attempts = 0 WHERE email = 'john.doe@example.com';
```

---

### Test 2.6: Login with Inactive Account

**Steps:**
1. Deactivate user in database:
   ```sql
   UPDATE users SET is_active = false WHERE email = 'john.doe@example.com';
   ```
2. Try to login

**Expected Results:**
- [ ] Error message: "Your account has been deactivated"
- [ ] Login fails

**Reactivate:**
```sql
UPDATE users SET is_active = true WHERE email = 'john.doe@example.com';
```

---

## 🔄 Test 3: Token Refresh

### Test 3.1: Automatic Token Refresh

**Steps:**
1. Login successfully
2. Wait 15+ minutes (or manually expire token in database)
3. Make any API call (e.g., navigate to profile page)

**Expected Results:**
- [ ] Token automatically refreshed in background
- [ ] No interruption to user experience
- [ ] New access token stored in localStorage
- [ ] Check Network tab - should see `/refresh-token` request

---

### Test 3.2: Manual Token Refresh

**API Test:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN_FROM_LOCALSTORAGE"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

---

### Test 3.3: Expired Refresh Token

**Steps:**
1. Use an expired refresh token (7+ days old)
2. Try to refresh

**Expected Results:**
- [ ] Error: "Refresh token expired or invalid"
- [ ] User redirected to login page (frontend)
- [ ] Tokens cleared from localStorage

---

## 🔒 Test 4: Protected Routes & Authorization

### Test 4.1: Access Protected Route Without Login

**Steps:**
1. Logout (if logged in)
2. Try to access `http://localhost:3000/dashboard`
3. Try to access `http://localhost:3000/profile`

**Expected Results:**
- [ ] Automatically redirected to `/login`
- [ ] Cannot access protected pages
- [ ] URL shows `/login?redirect=/dashboard` (or similar)

---

### Test 4.2: Access Protected Route After Login

**Steps:**
1. Login successfully
2. Navigate to `/dashboard`
3. Navigate to `/profile`

**Expected Results:**
- [ ] Pages load successfully
- [ ] User information displayed
- [ ] No redirect to login

---

### Test 4.3: Access Auth Pages While Logged In

**Steps:**
1. Login successfully
2. Try to access `/login`
3. Try to access `/register`

**Expected Results:**
- [ ] Automatically redirected to `/dashboard`
- [ ] Cannot access login/register pages while authenticated

---

### Test 4.4: Protected API Endpoint

**API Test:**
```bash
# Without token
curl -X GET http://localhost:5000/api/v1/auth/me

# Expected: 401 Unauthorized
```

```bash
# With token
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "...",
      "email": "john.doe@example.com",
      "role": "EMPLOYEE",
      "employee": { ... }
    }
  }
}
```

---

## 🔑 Test 5: Password Reset Flow

### Test 5.1: Request Password Reset

**Steps:**
1. Navigate to `http://localhost:3000/forgot-password`
2. Enter registered email: `john.doe@example.com`
3. Click "Send Reset Link"

**Expected Results:**
- [ ] Success message: "If an account exists with this email, a password reset link has been sent."
- [ ] Check backend logs for reset token
- [ ] `passwordResetToken` and `passwordResetExpires` set in database

**API Test:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com"
  }'
```

---

### Test 5.2: Reset Password with Token

**Steps:**
1. Get reset token from backend logs or database
2. Navigate to reset password page (if frontend has it) or use API:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{
       "token": "YOUR_RESET_TOKEN",
       "password": "NewPassword@1234"
     }'
   ```

**Expected Results:**
- [ ] Success message: "Password reset successfully"
- [ ] Password updated in database
- [ ] Reset token invalidated
- [ ] Can login with new password

---

### Test 5.3: Reset Password - Invalid Token

**Steps:**
1. Use an invalid or expired token
2. Try to reset password

**Expected Results:**
- [ ] Error: "Invalid or expired reset token"
- [ ] Password not changed

---

### Test 5.4: Reset Password - Expired Token

**Steps:**
1. Wait 1+ hour after requesting reset (or manually expire token)
2. Try to reset password

**Expected Results:**
- [ ] Error: "Reset token has expired"
- [ ] Need to request new reset link

---

## 👤 Test 6: User Profile

### Test 6.1: View Profile

**Steps:**
1. Login successfully
2. Navigate to `http://localhost:3000/profile`

**Expected Results:**
- [ ] Profile page loads
- [ ] User information displayed:
  - Email
  - Role
  - Employee information (if linked)
  - Verification status badge
- [ ] "Verified" badge if email verified
- [ ] "Unverified" badge if email not verified

---

### Test 6.2: Get Current User (API)

**API Test:**
```bash
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "...",
      "email": "john.doe@example.com",
      "role": "EMPLOYEE",
      "isEmailVerified": true,
      "employee": {
        "id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "employeeCode": "..."
      }
    }
  }
}
```

---

## 🚪 Test 7: Logout

### Test 7.1: Logout from Frontend

**Steps:**
1. Login successfully
2. Click "Logout" button (usually in dashboard or profile)
3. Check localStorage

**Expected Results:**
- [ ] Redirected to login page
- [ ] `accessToken` removed from localStorage
- [ ] `refreshToken` removed from localStorage
- [ ] User state cleared
- [ ] Cannot access protected routes

---

### Test 7.2: Logout via API

**API Test:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

**Expected Results:**
- [ ] Success response: "Logged out successfully"
- [ ] Refresh token invalidated in database
- [ ] Cannot use same refresh token again

---

## 🛡️ Test 8: Role-Based Access Control (RBAC)

### Test 8.1: Verify User Roles

**Steps:**
1. Check database for user roles:
   ```sql
   SELECT id, email, role FROM users;
   ```

**Expected Roles:**
- `SUPER_ADMIN`
- `ORG_ADMIN`
- `HR_MANAGER`
- `MANAGER`
- `EMPLOYEE`

---

### Test 8.2: Test Role Authorization

**API Test (Protected Endpoint with Role Check):**
```bash
# Login as EMPLOYEE
# Try to access admin-only endpoint
curl -X GET http://localhost:5000/api/v1/admin/users \
  -H "Authorization: Bearer EMPLOYEE_TOKEN"
```

**Expected Results:**
- [ ] 403 Forbidden if role doesn't have permission
- [ ] Error message: "You do not have permission to access this resource"

---

## 📊 Test 9: Error Handling

### Test 9.1: Network Error Handling

**Steps:**
1. Stop backend server
2. Try to login from frontend

**Expected Results:**
- [ ] User-friendly error message: "Network error. Please check your connection."
- [ ] No technical error details exposed to user
- [ ] Error logged in console (for debugging)

---

### Test 9.2: Invalid Token Handling

**Steps:**
1. Manually set invalid token in localStorage
2. Try to access protected route

**Expected Results:**
- [ ] Automatically redirected to login
- [ ] Error handled gracefully
- [ ] No application crash

---

## ✅ Test 10: Form Validation

### Test 10.1: Frontend Validation

**Steps:**
1. Navigate to registration/login forms
2. Try to submit empty forms
3. Try invalid inputs

**Expected Results:**
- [ ] Real-time validation feedback
- [ ] Error messages under each field
- [ ] Submit button disabled until valid
- [ ] Clear, user-friendly error messages

---

### Test 10.2: Backend Validation

**API Test:**
```bash
# Missing required fields
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Results:**
- [ ] 400 Bad Request
- [ ] Detailed validation errors:
  ```json
  {
    "status": "error",
    "message": "Validation failed",
    "errors": [
      {
        "field": "email",
        "message": "Email is required"
      },
      {
        "field": "password",
        "message": "Password is required"
      }
    ]
  }
  ```

---

## 📝 Test Results Summary

### Test Execution Checklist

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | Successful Registration | ⬜ Pass / ⬜ Fail | |
| 1.2 | Registration - Invalid Email | ⬜ Pass / ⬜ Fail | |
| 1.3 | Registration - Weak Password | ⬜ Pass / ⬜ Fail | |
| 1.4 | Registration - Duplicate Email | ⬜ Pass / ⬜ Fail | |
| 2.1 | Login - Unverified Email | ⬜ Pass / ⬜ Fail | |
| 2.2 | Email Verification | ⬜ Pass / ⬜ Fail | |
| 2.3 | Successful Login | ⬜ Pass / ⬜ Fail | |
| 2.4 | Login - Invalid Credentials | ⬜ Pass / ⬜ Fail | |
| 2.5 | Account Lockout | ⬜ Pass / ⬜ Fail | |
| 2.6 | Login - Inactive Account | ⬜ Pass / ⬜ Fail | |
| 3.1 | Automatic Token Refresh | ⬜ Pass / ⬜ Fail | |
| 3.2 | Manual Token Refresh | ⬜ Pass / ⬜ Fail | |
| 3.3 | Expired Refresh Token | ⬜ Pass / ⬜ Fail | |
| 4.1 | Protected Route - No Auth | ⬜ Pass / ⬜ Fail | |
| 4.2 | Protected Route - With Auth | ⬜ Pass / ⬜ Fail | |
| 4.3 | Auth Pages - While Logged In | ⬜ Pass / ⬜ Fail | |
| 4.4 | Protected API Endpoint | ⬜ Pass / ⬜ Fail | |
| 5.1 | Request Password Reset | ⬜ Pass / ⬜ Fail | |
| 5.2 | Reset Password | ⬜ Pass / ⬜ Fail | |
| 5.3 | Reset - Invalid Token | ⬜ Pass / ⬜ Fail | |
| 5.4 | Reset - Expired Token | ⬜ Pass / ⬜ Fail | |
| 6.1 | View Profile | ⬜ Pass / ⬜ Fail | |
| 6.2 | Get Current User API | ⬜ Pass / ⬜ Fail | |
| 7.1 | Logout Frontend | ⬜ Pass / ⬜ Fail | |
| 7.2 | Logout API | ⬜ Pass / ⬜ Fail | |
| 8.1 | Verify User Roles | ⬜ Pass / ⬜ Fail | |
| 8.2 | Role Authorization | ⬜ Pass / ⬜ Fail | |
| 9.1 | Network Error Handling | ⬜ Pass / ⬜ Fail | |
| 9.2 | Invalid Token Handling | ⬜ Pass / ⬜ Fail | |
| 10.1 | Frontend Validation | ⬜ Pass / ⬜ Fail | |
| 10.2 | Backend Validation | ⬜ Pass / ⬜ Fail | |

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: "Cannot connect to backend"
**Solution:**
- Check if backend is running on port 5000
- Check `backend/.env` for correct `PORT` configuration
- Check firewall/antivirus settings

### Issue 2: "Email verification token not found"
**Solution:**
- Check backend terminal logs for token
- Check database: `SELECT email_verification_token FROM users WHERE email = '...'`
- Token is in format: `email_verification_xxxxx`

### Issue 3: "Token expired" errors
**Solution:**
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Login again to get new tokens

### Issue 4: "Account locked" error
**Solution:**
- Wait 30 minutes, or
- Manually unlock in database:
  ```sql
  UPDATE users SET locked_until = NULL, login_attempts = 0 WHERE email = '...';
  ```

### Issue 5: CORS errors
**Solution:**
- Check `backend/src/server.ts` CORS configuration
- Ensure frontend URL is allowed
- Check browser console for specific CORS error

---

## 📸 Screenshots & Evidence

**Attach screenshots of:**
- [ ] Successful registration
- [ ] Email verification
- [ ] Successful login
- [ ] Dashboard after login
- [ ] Profile page
- [ ] Error messages (validation, locked account, etc.)
- [ ] Browser DevTools showing tokens in localStorage
- [ ] Network tab showing API calls

---

## ✅ Phase 1 Testing Completion

**Testing Completed By**: ___________  
**Date**: ___________  
**Total Tests**: 30  
**Passed**: ___ / 30  
**Failed**: ___ / 30  
**Blocked**: ___ / 30  

**Overall Status**: ⬜ **PASS** / ⬜ **FAIL** / ⬜ **NEEDS FIXES**

**Notes:**
```
[Add any additional notes, observations, or issues found during testing]
```

---

## 🚀 Next Steps

After completing Phase 1 testing:

1. **Fix any issues found** during testing
2. **Document bugs** in issue tracker
3. **Proceed to Phase 2 testing** (Employee Management)
4. **Update test results** in project documentation

---

**End of Phase 1 Testing Guide**
