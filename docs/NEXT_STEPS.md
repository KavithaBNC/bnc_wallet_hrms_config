# Next Steps - Attendance & Leave Management

## ✅ **What's Been Completed**

1. ✅ Backend APIs fully implemented (Phase 3)
2. ✅ Frontend routes registered (`/attendance` and `/leave`)
3. ✅ Attendance page created and functional
4. ✅ Leave page created with apply form
5. ✅ All TypeScript errors fixed
6. ✅ Build successful

---

## 🚀 **Immediate Next Steps**

### **1. Start the Backend Server**

```bash
cd backend
npm run dev
```

**Verify it's running:**
- Check console for: `🚀 Server running in development mode on port 5000`
- Visit: `http://localhost:5000/health` (should return success)

---

### **2. Seed Test Data (If Not Done)**

```bash
cd backend

# Seed leave types, policies, and holidays
npm run seed:leave

# Seed shifts for attendance
npm run seed:attendance
```

**What this creates:**
- Default leave types (Annual, Sick, Casual, Maternity, Paternity)
- Sample leave policies
- Default shifts (Morning, Afternoon, Night)
- Sample holidays

---

### **3. Verify Your HR Account**

**Check your user role:**
```http
GET http://localhost:5000/api/v1/auth/me
Authorization: Bearer YOUR_TOKEN
```

**Should return:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "role": "HR_MANAGER",
      "employee": {
        "organizationId": "..."
      }
    }
  }
}
```

**If role is not HR_MANAGER:**
- Update your user role in the database, OR
- Create a new HR user account

---

### **4. Test Attendance Functionality**

#### **A. Via Frontend:**
1. Login as HR user
2. Click "Attendance & Leave" card on dashboard
3. Click "Check In" button
4. Verify check-in is recorded
5. Click "Check Out" button
6. View attendance records table

#### **B. Via API (Postman/Thunder Client):**

**Check-in:**
```http
POST http://localhost:5000/api/v1/attendance/check-in
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "notes": "Checked in from office"
}
```

**Check-out:**
```http
POST http://localhost:5000/api/v1/attendance/check-out
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "notes": "Checked out"
}
```

**View Records:**
```http
GET http://localhost:5000/api/v1/attendance/records
Authorization: Bearer YOUR_TOKEN
```

---

### **5. Test Leave Management**

#### **A. Create Leave Type (HR Only):**

```http
POST http://localhost:5000/api/v1/leaves/types
Authorization: Bearer YOUR_TOKEN
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

**Note:** You need to include `organizationId` in the request. Get it from your employee record.

#### **B. Apply for Leave (Via Frontend):**
1. Navigate to `/leave` page
2. Click "Apply for Leave" button
3. Fill in the form:
   - Select leave type
   - Choose start date
   - Choose end date
   - Enter reason
4. Submit the request

#### **C. View Leave Requests:**
- The leave page should automatically show all leave requests
- You can see status (PENDING, APPROVED, REJECTED)

#### **D. Approve Leave Request (HR Only):**

```http
PUT http://localhost:5000/api/v1/leaves/requests/REQUEST_ID/approve
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "reviewComments": "Approved"
}
```

---

## 🔧 **Potential Issues & Fixes**

### **Issue 1: "Cannot create leave type - Missing organizationId"**

**Solution:**
1. Get your organization ID:
   ```http
   GET http://localhost:5000/api/v1/auth/me
   ```
2. Add `organizationId` to leave type creation request

**Or update LeavePage to auto-include organizationId:**
- The frontend should automatically get organizationId from user profile
- Update the API call to include it

### **Issue 2: "No leave types available"**

**Solution:**
1. Run seed script: `npm run seed:leave`
2. Or create leave types via API first
3. Then apply for leave

### **Issue 3: "Employee profile not found"**

**Solution:**
- Your user account must have an associated employee record
- Check: `GET /api/v1/auth/me` should include `employee` object
- If missing, create employee record for your user

---

## 📋 **Enhancement Checklist**

### **Frontend Enhancements Needed:**

- [ ] **Auto-populate organizationId** in leave type creation
- [ ] **Add HR-specific features:**
  - [ ] Create/Edit Leave Types UI
  - [ ] Create/Edit Leave Policies UI
  - [ ] Approve/Reject Leave Requests UI
  - [ ] View Attendance Reports UI
  - [ ] Manage Shifts UI

- [ ] **Improve Leave Page:**
  - [ ] Add filters (status, date range)
  - [ ] Add pagination
  - [ ] Add approve/reject buttons for HR
  - [ ] Show leave balance
  - [ ] Add leave calendar view

- [ ] **Improve Attendance Page:**
  - [ ] Add date filters
  - [ ] Add employee filter (for HR)
  - [ ] Add attendance reports section
  - [ ] Add regularization requests
  - [ ] Show shift information

### **Backend Enhancements:**

- [ ] **Add organizationId auto-detection** in leave type creation
- [ ] **Add more validation** for leave requests
- [ ] **Add email notifications** (if not already working)
- [ ] **Add leave balance calculation** on employee creation

---

## 🧪 **Testing Checklist**

### **Attendance:**
- [ ] Check-in successfully
- [ ] Check-out successfully
- [ ] View attendance records
- [ ] View attendance summary
- [ ] View attendance reports (HR only)
- [ ] Create regularization request
- [ ] Approve regularization (HR only)

### **Leave:**
- [ ] Create leave type (HR only)
- [ ] Create leave policy (HR only)
- [ ] Apply for leave
- [ ] View all leave requests
- [ ] Approve leave request (HR only)
- [ ] Reject leave request (HR only)
- [ ] Cancel leave request
- [ ] View leave balance
- [ ] View leave calendar

---

## 🎯 **Recommended Next Actions**

### **Priority 1: Make It Work End-to-End**
1. ✅ Start backend server
2. ✅ Seed test data
3. ✅ Test check-in/check-out
4. ✅ Create leave type via API
5. ✅ Apply for leave via frontend
6. ✅ Approve leave via API

### **Priority 2: Enhance Frontend for HR**
1. Add "Create Leave Type" form in frontend
2. Add "Approve/Reject" buttons in leave requests table
3. Add "Create Leave Policy" form
4. Add attendance reports view
5. Add shift management UI

### **Priority 3: Polish & UX**
1. Add loading states
2. Add success/error notifications
3. Add form validation
4. Add date pickers
5. Add filters and search

---

## 📝 **Quick Commands Reference**

```bash
# Backend
cd backend
npm run dev                    # Start server
npm run seed:leave            # Seed leave data
npm run seed:attendance       # Seed attendance data
npm run test:all              # Run all tests

# Frontend
cd frontend
npm run dev                   # Start dev server
npm run build                 # Build for production
```

---

## 🔗 **Useful Endpoints**

### **Attendance:**
- `POST /api/v1/attendance/check-in` - Check in
- `POST /api/v1/attendance/check-out` - Check out
- `GET /api/v1/attendance/records` - View records
- `GET /api/v1/attendance/reports` - View reports (HR only)

### **Leave:**
- `POST /api/v1/leaves/types` - Create leave type (HR only)
- `GET /api/v1/leaves/types` - List leave types
- `POST /api/v1/leaves/requests` - Apply for leave
- `GET /api/v1/leaves/requests` - List leave requests
- `PUT /api/v1/leaves/requests/:id/approve` - Approve (HR only)
- `PUT /api/v1/leaves/requests/:id/reject` - Reject (HR only)
- `GET /api/v1/leaves/balance/:employeeId` - View balance

---

## 💡 **Tips**

1. **Always check browser console** for errors
2. **Check backend logs** for API errors
3. **Use Postman/Thunder Client** to test APIs directly
4. **Verify your role** before testing HR features
5. **Check database** to see if records are created

---

## 🚨 **If Something Doesn't Work**

1. **Check backend is running** - `http://localhost:5000/health`
2. **Check frontend is running** - `http://localhost:3000`
3. **Check browser console** for errors
4. **Check network tab** for API call failures
5. **Verify authentication token** is valid
6. **Check user role** is HR_MANAGER
7. **Verify employee record** exists

---

## 📞 **Need Help?**

Refer to:
- `HR_TESTING_GUIDE.md` - Detailed testing guide
- `PHASE3_COMPLETE_SUMMARY.md` - Phase 3 implementation details
- Backend logs for detailed error messages

---

**Ready to test? Start with step 1: Start the backend server!** 🚀
