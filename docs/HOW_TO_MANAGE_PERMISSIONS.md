# How to Manage Permissions

## 📍 Where to Give Permissions

You can manage permissions in **two ways**:

---

## 🖥️ **Option 1: Frontend UI (Recommended)**

### Access the Permissions Page

1. **Login as HR_ADMIN or ORG_ADMIN**
   - Only these roles can manage permissions

2. **Go to Dashboard**
   - After login, you'll see the HRMS Dashboard

3. **Click on "Permissions" Module**
   - Look for the **🔐 Permissions** card in the modules grid
   - Click on it to open the Permissions Management page

4. **Or Navigate Directly**
   - Go to: `http://localhost:3000/permissions` (or your frontend URL)

### Using the Permissions Page

#### **View Permissions for a Role**
1. Select a role from the top (MANAGER or EMPLOYEE)
2. View all assigned permissions for that role
3. See which permissions are available but not assigned

#### **Assign Permissions to a Role**
1. Click **"Assign Permissions"** button
2. Select the role you want to assign permissions to
3. Check the permissions you want to assign
4. Click **"Assign Selected"** to add permissions
   - Or click **"Replace All"** to replace all existing permissions

#### **Remove Permissions from a Role**
1. View the role's permissions
2. Click the **✕** button next to any permission to remove it

#### **Filter Permissions**
- Use the module dropdown to filter permissions by module
- View permissions grouped by module (Employee Management, Leave Management, etc.)

---

## 🔧 **Option 2: API Endpoints (For Developers/Testing)**

### Using API Directly

#### **1. Get All Permissions**
```bash
GET /api/v1/permissions
Authorization: Bearer <your-token>
```

#### **2. Get Permissions for a Role**
```bash
GET /api/v1/permissions/role-permissions/MANAGER
Authorization: Bearer <your-token>
```

#### **3. Assign Permissions to a Role**
```bash
POST /api/v1/permissions/role-permissions/assign
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "role": "MANAGER",
  "permissionIds": [
    "permission-id-1",
    "permission-id-2",
    "permission-id-3"
  ]
}
```

#### **4. Remove Permission from Role**
```bash
DELETE /api/v1/permissions/role-permissions/remove
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "role": "MANAGER",
  "permissionId": "permission-id-1"
}
```

#### **5. Replace All Permissions for a Role**
```bash
PUT /api/v1/permissions/role-permissions/MANAGER/replace
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "permissionIds": [
    "permission-id-1",
    "permission-id-2"
  ]
}
```

#### **6. Get Your Own Permissions**
```bash
GET /api/v1/permissions/role-permissions/user/permissions
Authorization: Bearer <your-token>
```

---

## 📋 **Quick Start Guide**

### Example: Assign Basic Permissions to EMPLOYEE Role

1. **Login as HR_ADMIN or ORG_ADMIN**
2. **Go to Permissions Page** (`/permissions`)
3. **Select "EMPLOYEE" role**
4. **Click "Assign Permissions"**
5. **Select these permissions:**
   - `leaves.apply` - Apply for leave
   - `attendance.check_in` - Check in
   - `attendance.check_out` - Check out
   - `attendance.read` - View own attendance
   - `leaves.read` - View own leave requests
   - `leaves.cancel` - Cancel own leave requests
6. **Click "Assign Selected"**

### Example: Assign Permissions to MANAGER Role

1. **Select "MANAGER" role**
2. **Click "Assign Permissions"**
3. **Select these permissions:**
   - `leaves.approve` - Approve leave requests
   - `leaves.reject` - Reject leave requests
   - `attendance.view_all` - View team attendance
   - `leaves.view_all` - View team leave requests
   - `attendance.regularization.approve` - Approve attendance regularization
   - `attendance.regularization.reject` - Reject attendance regularization
4. **Click "Assign Selected"**

---

## 🔑 **Important Notes**

1. **HR_MANAGER and ORG_ADMIN** have all 48 permissions by default
   - No need to assign permissions to these roles
   - They can manage permissions for other roles

2. **MANAGER and EMPLOYEE** start with 0 permissions
   - You need to assign permissions to these roles
   - Use the Permissions page to assign them

3. **Permission Changes Take Effect Immediately**
   - No need to restart the server
   - Users may need to refresh their browser

4. **Organization-Specific Permissions**
   - You can assign permissions specific to an organization
   - Use the `organizationId` parameter in API calls

---

## 🎯 **Common Permission Assignments**

### EMPLOYEE Role (Self-Service)
- `leaves.apply`
- `attendance.check_in`
- `attendance.check_out`
- `attendance.read`
- `leaves.read`
- `leaves.cancel`

### MANAGER Role (Team Management)
- `leaves.approve`
- `leaves.reject`
- `attendance.view_all`
- `leaves.view_all`
- `attendance.regularization.approve`
- `attendance.regularization.reject`
- `employees.read` (to view team members)

---

**Need Help?** Check the Permissions page - it shows all available permissions organized by module!
