# How to Create Default SUPER_ADMIN - Testing Guide

## 🎯 Quick Start

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Run the Script
```bash
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts <email> <password> <firstName> <lastName>
```

### Example:
```bash
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts admin@hrms.com Admin@123456 Admin User
```

---

## 📋 Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `email` | Email address for SUPER_ADMIN | `admin@hrms.com` |
| `password` | Password (must meet requirements) | `Admin@123456` |
| `firstName` | First name | `Admin` |
| `lastName` | Last name | `User` |

### Password Requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

---

## ✅ Expected Output

### Success Output:
```
✅ SUPER_ADMIN user created successfully!
   Email: admin@hrms.com
   Name: Admin User
   Role: SUPER_ADMIN
   Employee Code: EMP00001

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

## 🧪 Testing Steps

### 1. Create SUPER_ADMIN
```bash
cd backend
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts admin@hrms.com Admin@123456 Admin User
```

### 2. Verify in Database (Optional)
```sql
-- Connect to PostgreSQL
psql -U your_username -d hrms_db

-- Check user
SELECT id, email, role, is_active, is_email_verified 
FROM users 
WHERE email = 'admin@hrms.com';

-- Check employee record
SELECT e.id, e.employee_code, e.first_name, e.last_name, e.organization_id, o.name as org_name
FROM employees e
JOIN users u ON e.user_id = u.id
JOIN organizations o ON e.organization_id = o.id
WHERE u.email = 'admin@hrms.com';
```

### 3. Test Login via API
```bash
# Using curl
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hrms.com",
    "password": "Admin@123456"
  }'
```

### 4. Test Login via Frontend
1. Start frontend: `cd frontend && npm run dev`
2. Navigate to: `http://localhost:5173/login`
3. Enter credentials:
   - Email: `admin@hrms.com`
   - Password: `Admin@123456`
4. Click "Sign In"
5. Should redirect to dashboard

### 5. Verify SUPER_ADMIN Access
```bash
# Get token from login response, then test access
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

## 🔧 Troubleshooting

### Error: "Cannot find module"
```bash
# Make sure you're in the backend directory
cd backend

# Install dependencies if needed
npm install
```

### Error: "Database connection failed"
```bash
# Check your .env file has correct DATABASE_URL
# Example: DATABASE_URL="postgresql://user:password@localhost:5432/hrms_db"
```

### Error: "User already exists"
- The script will automatically upgrade existing user to SUPER_ADMIN
- Or use a different email address

### Error: "Password does not meet requirements"
- Ensure password has:
  - At least 8 characters
  - Uppercase letter
  - Lowercase letter
  - Number
  - Special character

---

## 📝 What the Script Does

1. ✅ Checks if user already exists
   - If exists: Upgrades role to SUPER_ADMIN
   - If not: Creates new user

2. ✅ Creates/uses default organization
   - Uses organization ID: `00000000-0000-0000-0000-000000000001`
   - Creates if doesn't exist

3. ✅ Creates user with SUPER_ADMIN role
   - Email verified automatically
   - Active by default

4. ✅ Creates employee record
   - Links to default organization
   - Generates unique employee code
   - Sets status to ACTIVE

---

## 🎯 Quick Test Commands

### Windows (PowerShell):
```powershell
cd backend
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts admin@hrms.com Admin@123456 Admin User
```

### Linux/Mac:
```bash
cd backend
npx ts-node -r tsconfig-paths/register src/scripts/create-super-admin.ts admin@hrms.com Admin@123456 Admin User
```

---

## ✅ Verification Checklist

After running the script, verify:

- [ ] User created in database with role `SUPER_ADMIN`
- [ ] Employee record created and linked to organization
- [ ] Can login via API with credentials
- [ ] Can login via frontend
- [ ] Can view all organizations (GET /api/v1/organizations)
- [ ] Can view all employees (GET /api/v1/employees)
- [ ] Can create new organization (POST /api/v1/organizations)
- [ ] Can create ORG_ADMIN user (POST /api/v1/organizations/:id/admins)

---

## 🚀 Next Steps After Creating SUPER_ADMIN

1. **Login as SUPER_ADMIN**
2. **Create Organizations**
   ```bash
   POST /api/v1/organizations
   ```

3. **Create ORG_ADMIN for each organization**
   ```bash
   POST /api/v1/organizations/{org-id}/admins
   {
     "email": "orgadmin@company.com",
     "password": "SecurePassword@123",
     "firstName": "John",
     "lastName": "Admin"
   }
   ```

4. **ORG_ADMIN can then manage their organization**

---

**Ready to test!** Run the command above and follow the verification steps.
