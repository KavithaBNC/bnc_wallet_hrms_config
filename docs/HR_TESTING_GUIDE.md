# HR Role Testing Guide - Attendance & Leave Management

## 🔐 HR_MANAGER Role Permissions

As an **HR_MANAGER**, you have the following permissions:

### ✅ **Attendance Management:**
- ✅ Check-in/Check-out (for yourself)
- ✅ View all attendance records (within your organization)
- ✅ View attendance reports
- ✅ Approve/reject attendance regularization requests
- ✅ View attendance summaries for any employee

### ✅ **Leave Management:**
- ✅ Apply for leave (for yourself)
- ✅ View all leave requests (within your organization)
- ✅ **Create/Update Leave Types** (e.g., Annual, Sick, Casual)
- ✅ **Create/Update Leave Policies**
- ✅ **Approve/Reject Leave Requests**
- ✅ View leave balances for any employee
- ✅ View leave calendar

---

## 🧪 Testing Steps

### **1. Test Attendance Check-in/Check-out**

#### **Via API (Postman/Thunder Client):**

**Check-in:**
```http
POST http://localhost:5000/api/v1/attendance/check-in
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "notes": "Checked in from office"
}
```

**Check-out:**
```http
POST http://localhost:5000/api/v1/attendance/check-out
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "notes": "Checked out"
}
```

**View Your Attendance Records:**
```http
GET http://localhost:5000/api/v1/attendance/records
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**View Attendance Report (HR Only):**
```http
GET http://localhost:5000/api/v1/attendance/reports?organizationId=YOUR_ORG_ID&startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

### **2. Test Leave Management**

#### **A. Create Leave Type (HR Only):**

```http
POST http://localhost:5000/api/v1/leaves/types
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Annual Leave",
  "code": "ANNUAL",
  "description": "Annual vacation leave",
  "isPaid": true,
  "defaultDaysPerYear": 15,
  "maxCarryForward": 5,
  "maxConsecutiveDays": 10,
  "requiresDocument": false,
  "requiresApproval": true,
  "canBeNegative": false,
  "accrualType": "ANNUALLY",
  "colorCode": "#3B82F6"
}
```

#### **B. Create Leave Policy (HR Only):**

```http
POST http://localhost:5000/api/v1/leaves/policies
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "organizationId": "YOUR_ORG_ID",
  "leaveTypeId": "LEAVE_TYPE_ID",
  "name": "Annual Leave Policy",
  "description": "Standard annual leave policy",
  "minServiceMonths": 0,
  "accrualType": "ANNUALLY",
  "accrualRate": 1.25,
  "requiresApproval": true,
  "autoApproveDays": 0,
  "minDaysPerRequest": 1,
  "maxDaysPerRequest": 10,
  "advanceNoticeDays": 3,
  "isActive": true
}
```

#### **C. Apply for Leave:**

```http
POST http://localhost:5000/api/v1/leaves/requests
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "leaveTypeId": "LEAVE_TYPE_ID",
  "startDate": "2026-02-01",
  "endDate": "2026-02-05",
  "reason": "Family vacation"
}
```

#### **D. View All Leave Requests:**

```http
GET http://localhost:5000/api/v1/leaves/requests
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### **E. Approve Leave Request (HR Only):**

```http
PUT http://localhost:5000/api/v1/leaves/requests/REQUEST_ID/approve
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "reviewComments": "Approved"
}
```

#### **F. View Leave Balance:**

```http
GET http://localhost:5000/api/v1/leaves/balance/EMPLOYEE_ID?year=2026
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## 🔍 **Troubleshooting**

### **Issue: "Cannot add attendance"**

**Possible Causes:**
1. **Not logged in** - Make sure you have a valid access token
2. **Employee profile missing** - Your user account must have an associated employee record
3. **Already checked in** - You can only check-in once per day

**Solution:**
1. Verify your token: `GET /api/v1/auth/me`
2. Check if employee exists: Your user should have an `employee` relation
3. If already checked in, you need to check-out first

### **Issue: "Cannot create leave type"**

**Possible Causes:**
1. **Wrong role** - Make sure your role is `HR_MANAGER`
2. **Missing organization** - Leave types require `organizationId`

**Solution:**
1. Check your role: `GET /api/v1/auth/me` - should show `role: "HR_MANAGER"`
2. Get your organization ID from your employee record
3. Include `organizationId` in the request

### **Issue: "Cannot approve leave"**

**Possible Causes:**
1. **Wrong role** - Need HR_MANAGER, ORG_ADMIN, or MANAGER
2. **Request not pending** - Can only approve PENDING requests
3. **Wrong organization** - Can only approve leaves from your organization

**Solution:**
1. Verify role and permissions
2. Check request status - must be `PENDING`
3. Ensure the leave request belongs to your organization

---

## 📋 **Quick Test Checklist**

### **Attendance:**
- [ ] Check-in successfully
- [ ] Check-out successfully
- [ ] View own attendance records
- [ ] View attendance report (HR only)
- [ ] Create attendance regularization request
- [ ] Approve regularization request (HR only)

### **Leave:**
- [ ] Create leave type (HR only)
- [ ] Create leave policy (HR only)
- [ ] Apply for leave
- [ ] View all leave requests
- [ ] Approve leave request (HR only)
- [ ] Reject leave request (HR only)
- [ ] View leave balance
- [ ] View leave calendar

---

## 🛠️ **Getting Your Access Token**

1. **Login:**
```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "your-hr-email@example.com",
  "password": "your-password"
}
```

2. **Copy the `accessToken` from response:**
```json
{
  "status": "success",
  "data": {
    "user": {...},
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "..."
    }
  }
}
```

3. **Use it in Authorization header:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📝 **Sample Test Data**

### **Create Leave Type First:**
```json
{
  "name": "Sick Leave",
  "code": "SICK",
  "description": "Medical leave",
  "isPaid": true,
  "defaultDaysPerYear": 10,
  "maxCarryForward": 0,
  "maxConsecutiveDays": 5,
  "requiresDocument": true,
  "requiresApproval": true,
  "canBeNegative": false,
  "accrualType": "ANNUALLY",
  "colorCode": "#EF4444"
}
```

### **Then Apply for Leave:**
```json
{
  "leaveTypeId": "LEAVE_TYPE_ID_FROM_ABOVE",
  "startDate": "2026-02-10",
  "endDate": "2026-02-12",
  "reason": "Medical appointment"
}
```

---

## 🚀 **Next Steps**

1. **Seed Test Data** (if not already done):
   ```bash
   cd backend
   npm run seed:leave
   npm run seed:attendance
   ```

2. **Test via Frontend:**
   - Navigate to Attendance section
   - Navigate to Leave Management section
   - Try creating leave types and policies
   - Apply for leave and approve requests

3. **Check Backend Logs:**
   - Monitor console for any errors
   - Check database for created records

---

## ⚠️ **Important Notes**

- **HR_MANAGER** can manage leave types and policies for their organization only
- **HR_MANAGER** can approve/reject leave requests from their organization
- **HR_MANAGER** can view attendance reports for their organization
- All operations are scoped to your organization (unless you're SUPER_ADMIN)

---

## 📞 **Need Help?**

If you're still having issues:
1. Check browser console for errors
2. Check backend logs for detailed error messages
3. Verify your role: `GET /api/v1/auth/me`
4. Verify employee record exists
5. Check database connection is working
