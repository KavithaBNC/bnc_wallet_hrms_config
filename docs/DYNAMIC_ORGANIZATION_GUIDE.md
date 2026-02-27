# Dynamic Organization Creation - Implementation Guide

## ✅ What Was Implemented

### Backend Changes

1. **Organization Service** (`backend/src/services/organization.service.ts`):
   - ✅ Added `create()` method - Creates new organizations dynamically
   - ✅ Added `getAll()` method - Lists all organizations (for Super Admin)

2. **Organization Controller** (`backend/src/controllers/organization.controller.ts`):
   - ✅ Added `create()` controller method
   - ✅ Added `getAll()` controller method

3. **Organization Routes** (`backend/src/routes/organization.routes.ts`):
   - ✅ Added `POST /api/v1/organizations` - Create organization (Public for registration)
   - ✅ Added `GET /api/v1/organizations` - List all organizations (Super Admin only)

4. **Organization Validation** (`backend/src/utils/organization.validation.ts`):
   - ✅ Added `createOrganizationSchema` for validation

5. **Registration Schema** (`backend/src/utils/validation.ts`):
   - ✅ Updated to accept `organizationId` (optional)
   - ✅ Updated to accept `createOrganization` object (optional)
   - ✅ Validation: Cannot provide both, but both can be omitted (backward compatible)

6. **Auth Service** (`backend/src/services/auth.service.ts`):
   - ✅ Removed hardcoded organization ID
   - ✅ Added dynamic organization handling:
     - If `organizationId` provided → Use existing organization
     - If `createOrganization` provided → Create new organization
     - If neither provided → Fallback to default (backward compatible)
   - ✅ Auto-assigns `ORG_ADMIN` role to user who creates organization

---

## 🎯 How It Works Now

### Option 1: Register with Existing Organization

**Request:**
```json
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "Password@123",
  "firstName": "John",
  "lastName": "Doe",
  "organizationId": "existing-org-uuid-here"
}
```

**Result:**
- User registered
- Employee created and linked to existing organization
- User role: `EMPLOYEE` (or specified role)

---

### Option 2: Register and Create New Organization

**Request:**
```json
POST /api/v1/auth/register
{
  "email": "admin@newcompany.com",
  "password": "Password@123",
  "firstName": "Jane",
  "lastName": "Smith",
  "createOrganization": {
    "name": "New Company Inc",
    "legalName": "New Company Inc",
    "industry": "Technology",
    "sizeRange": "11-50",
    "timezone": "America/New_York",
    "currency": "USD"
  }
}
```

**Result:**
- New organization created
- User registered
- Employee created and linked to new organization
- User role: `ORG_ADMIN` (automatically assigned)

---

### Option 3: Register Without Organization (Backward Compatible)

**Request:**
```json
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "Password@123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Result:**
- Uses default organization (creates if doesn't exist)
- User registered
- Employee created and linked to default organization
- User role: `EMPLOYEE`

---

## 📋 API Endpoints

### Create Organization (Standalone)

```http
POST /api/v1/organizations
Content-Type: application/json

{
  "name": "My Company",
  "legalName": "My Company LLC",
  "industry": "Technology",
  "sizeRange": "51-200",
  "timezone": "UTC",
  "currency": "USD"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Organization created successfully",
  "data": {
    "organization": {
      "id": "uuid-here",
      "name": "My Company",
      ...
    }
  }
}
```

### List All Organizations (Super Admin Only)

```http
GET /api/v1/organizations?page=1&limit=20&search=company
Authorization: Bearer <super-admin-token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "organizations": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "totalPages": 1
    }
  }
}
```

---

## 🔄 Registration Flow Options

### Flow 1: Organization-First (Recommended for Multi-Tenant)

1. **Super Admin creates organization** via `POST /api/v1/organizations`
2. **Get organization ID** from response
3. **Share organization ID** with users (via invite link, email, etc.)
4. **Users register** with `organizationId` in registration form

### Flow 2: User Creates Organization During Registration

1. **User registers** with `createOrganization` object
2. **System creates organization** automatically
3. **User becomes ORG_ADMIN** of that organization
4. **Subsequent users** can join using `organizationId`

### Flow 3: Default Organization (Backward Compatible)

1. **User registers** without organization info
2. **System uses/creates default organization**
3. **All users go to same organization** (single-tenant mode)

---

## 🎨 Frontend Integration (To Be Implemented)

### Registration Form Options

**Option A: Organization Selection**
```tsx
<select name="organizationId">
  <option value="">Select Organization</option>
  {organizations.map(org => (
    <option value={org.id}>{org.name}</option>
  ))}
</select>
```

**Option B: Create New Organization**
```tsx
<checkbox>Create new organization</checkbox>
{showCreateOrg && (
  <input name="createOrganization.name" />
  <input name="createOrganization.industry" />
  ...
)}
```

**Option C: Simple Registration (Default)**
- Just email, password, name
- Uses default organization automatically

---

## 🔐 Role Assignment Logic

- **If `createOrganization` provided** → User becomes `ORG_ADMIN`
- **If `organizationId` provided** → User becomes `EMPLOYEE` (or specified role)
- **If neither provided** → User becomes `EMPLOYEE` (default)

**Note:** Explicit `role` in registration overrides auto-assignment.

---

## ✅ Benefits

1. **Multi-Tenant Support**: Multiple organizations can exist
2. **Flexible Registration**: Users can join existing or create new
3. **Backward Compatible**: Old registration still works
4. **No Hardcoding**: Organizations created dynamically
5. **Proper Role Assignment**: Organization creators become admins

---

## 🚀 Next Steps

1. **Frontend**: Update registration form to support organization selection/creation
2. **Organization Management UI**: Add pages for creating/managing organizations
3. **Invite System**: Send organization invites with `organizationId`
4. **Organization Settings**: Allow ORG_ADMIN to manage their organization

---

**Status**: ✅ Backend implementation complete and ready to use!
