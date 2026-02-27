# How to Access Salary Structures in Frontend

## 🔐 Required Login Role

**You need to login as one of these roles:**
- **ORG_ADMIN** (Organization Admin)
- **HR_MANAGER** (HR Manager)

**❌ These roles CANNOT access:**
- EMPLOYEE
- MANAGER
- SUPER_ADMIN (unless they have employee profile)

## 🌐 How to Access

### Method 1: Direct URL (Easiest)

1. **Login** as ORG_ADMIN or HR_MANAGER
2. **Navigate directly** to:
   ```
   http://localhost:3000/salary-structures
   ```

### Method 2: From Dashboard

1. **Login** as ORG_ADMIN or HR_MANAGER
2. Go to **Dashboard** (`/dashboard`)
3. Click on **"Payroll"** module card
4. From Payroll page, you can access salary structures (if link exists) or use Method 1

### Method 3: Add Link to Dashboard (Recommended)

Add a "Salary Structures" module card to the dashboard for easier access.

## 📋 Step-by-Step Instructions

### Step 1: Login

1. Go to: `http://localhost:3000/login`
2. Use credentials for **ORG_ADMIN** or **HR_MANAGER**:
   - Email: (any user with ORG_ADMIN or HR_MANAGER role)
   - Password: `password123` (default password)

### Step 2: Access Salary Structures

**Option A: Direct URL**
- Type in browser: `http://localhost:3000/salary-structures`
- Press Enter

**Option B: Manual Navigation**
- After login, you'll be on Dashboard
- In the browser address bar, change URL to: `/salary-structures`
- Press Enter

### Step 3: Verify Access

You should see:
- ✅ List of salary structures (if any exist)
- ✅ "Create Salary Structure" button
- ✅ Ability to add/edit/delete structures

## 🚨 Troubleshooting

### Issue: "Access Denied" or Blank Page

**Cause:** Wrong role or no employee profile
**Solution:**
1. Check your user role (should be ORG_ADMIN or HR_MANAGER)
2. Ensure user has an employee profile linked
3. Verify employee has organizationId set

### Issue: "No data" or Empty List

**Cause:** No salary structures created yet
**Solution:**
1. Run seed script: `cd backend && npm run seed:payroll`
2. Or create a new salary structure using "Create" button

### Issue: Page Doesn't Load

**Cause:** Frontend not running or route not found
**Solution:**
1. Ensure frontend server is running: `cd frontend && npm run dev`
2. Check browser console for errors
3. Verify route exists in `App.tsx`

## ✅ Quick Test

1. **Login** as ORG_ADMIN/HR_MANAGER
2. **Navigate** to: `http://localhost:3000/salary-structures`
3. **Verify** you can see the page
4. **Click** "Create Salary Structure" button
5. **Fill** in the form and create a structure
6. **Verify** it appears in the list

## 📝 Notes

- The page is **protected** - requires authentication
- **Role-based access** - only ORG_ADMIN and HR_MANAGER can access
- The page checks `canManage` permission before loading data
- If you don't have the right role, the page will show an error or be blank

## 🔗 Related Pages

- **Payroll Page**: `/payroll` - For payroll cycles and payslips
- **Salary Structures**: `/salary-structures` - For managing salary structures
- **Dashboard**: `/dashboard` - Main dashboard with module cards
