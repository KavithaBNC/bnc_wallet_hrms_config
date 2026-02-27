# How to Test Creating Default SUPER_ADMIN

## 🚀 Quick Test Steps

### Step 1: Navigate to Backend
```bash
cd backend
```

### Step 2: Run the Script
```bash
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts admin@hrms.com Admin@123456 Admin User
```

**Or using npm script:**
```bash
npm run create:super-admin admin@hrms.com Admin@123456 Admin User
```

---

## 📋 Command Format

```bash
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts <email> <password> [firstName] [lastName]
```

### Parameters:
- `email` - Email address (required)
- `password` - Password (required, must meet requirements)
- `firstName` - First name (optional, defaults to "Super")
- `lastName` - Last name (optional, defaults to "Admin")

### Password Requirements:
- ✅ Minimum 8 characters
- ✅ At least one uppercase letter (A-Z)
- ✅ At least one lowercase letter (a-z)
- ✅ At least one number (0-9)
- ✅ At least one special character (!@#$%^&*...)

---

## ✅ Example Commands

### Minimal (uses defaults for name):
```bash
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts admin@hrms.com Admin@123456
```

### Full (with name):
```bash
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts admin@hrms.com Admin@123456 John Admin
```

---

## 📊 Expected Output

### Success Output:
```
✅ SUPER_ADMIN user created successfully!
   Email: admin@hrms.com
   Name: Admin User
   Role: SUPER_ADMIN
   Employee Code: EMP1737744000000

🔐 You can now login with these credentials.
```

### If User Already Exists:
```
⚠️  User with email "admin@hrms.com" already exists
   Current role: EMPLOYEE

🔄 Upgrading user role to SUPER_ADMIN...
✅ User role upgraded to SUPER_ADMIN: admin@hrms.com
```

---

## 🧪 Testing After Creation

### 1. Test Login via API
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hrms.com",
    "password": "Admin@123456"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "...",
      "email": "admin@hrms.com",
      "role": "SUPER_ADMIN",
      ...
    },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    }
  }
}
```

### 2. Test Login via Frontend
1. Start frontend: `cd frontend && npm run dev`
2. Open: `http://localhost:5173/login`
3. Enter:
   - Email: `admin@hrms.com`
   - Password: `Admin@123456`
4. Click "Sign In"
5. Should redirect to dashboard

### 3. Test SUPER_ADMIN Access

**Get token from login response, then:**

```bash
# Set token variable
TOKEN="your-access-token-here"

# Test: View all organizations (SUPER_ADMIN only)
curl -X GET http://localhost:5000/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN"

# Test: View all employees (SUPER_ADMIN can see all orgs)
curl -X GET http://localhost:5000/api/v1/employees \
  -H "Authorization: Bearer $TOKEN"

# Test: Create organization
curl -X POST http://localhost:5000/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Organization",
    "industry": "Technology",
    "sizeRange": "11-50",
    "timezone": "UTC",
    "currency": "USD"
  }'
```

---

## 🔍 Verify in Database (Optional)

### Using psql:
```sql
-- Connect to database
psql -U your_username -d hrms_db

-- Check user
SELECT id, email, role, is_active, is_email_verified, created_at 
FROM users 
WHERE email = 'admin@hrms.com';

-- Check employee record
SELECT 
  e.id, 
  e.employee_code, 
  e.first_name, 
  e.last_name, 
  e.organization_id, 
  o.name as org_name,
  u.role
FROM employees e
JOIN users u ON e.user_id = u.id
JOIN organizations o ON e.organization_id = o.id
WHERE u.email = 'admin@hrms.com';
```

---

## ⚠️ Troubleshooting

### Error: "Cannot find module"
```bash
# Make sure you're in backend directory
cd backend

# Install dependencies
npm install
```

### Error: "Database connection failed"
- Check your `.env` file has correct `DATABASE_URL`
- Ensure PostgreSQL is running
- Verify database exists

### Error: "User already exists"
- Script will automatically upgrade existing user to SUPER_ADMIN
- Or use a different email address

### Error: "Password does not meet requirements"
- Ensure password has all required characters
- Example valid passwords:
  - `Admin@123456` ✅
  - `MyPass123!` ✅
  - `password` ❌ (no uppercase, no special char)
  - `PASSWORD123` ❌ (no lowercase, no special char)

---

## ✅ Verification Checklist

After running the script:

- [ ] Script runs without errors
- [ ] User created with role `SUPER_ADMIN`
- [ ] Employee record created
- [ ] Can login via API
- [ ] Can login via frontend
- [ ] Can view all organizations
- [ ] Can view all employees (across all orgs)
- [ ] Can create new organization
- [ ] Can create ORG_ADMIN user

---

## 🎯 Quick Test Command (Copy & Paste)

```bash
cd backend
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts admin@hrms.com Admin@123456 Admin User
```

Then test login:
```bash
curl -X POST http://localhost:5000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@hrms.com\",\"password\":\"Admin@123456\"}"
```

---

**Ready to test!** Run the command above and verify the output.
