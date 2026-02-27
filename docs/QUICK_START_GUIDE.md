# 🚀 Quick Start Guide - Test Attendance & Leave

## ✅ **Step-by-Step Instructions**

### **Step 1: Start Backend Server**

```bash
cd backend
npm run dev
```

**Wait for this message:**
```
🚀 Server running in development mode on port 5000
📍 Base URL: http://localhost:5000
🔗 Health check: http://localhost:5000/health
```

**Verify it's working:**
- Open browser: `http://localhost:5000/health`
- Should see: `{"status":"success","message":"HRMS API is running"}`

---

### **Step 2: Seed Test Data**

**In a NEW terminal window** (keep backend running):

```bash
cd backend

# Seed leave types, policies, and holidays
npm run seed:leave

# Seed shifts for attendance
npm run seed:attendance
```

**Expected output:**
```
✅ Created: Annual Leave (AL)
✅ Created: Sick Leave (SL)
✅ Created: Casual Leave (CL)
✅ Leave Management seed data created successfully!
```

---

### **Step 3: Start Frontend (If Not Running)**

**In another terminal:**

```bash
cd frontend
npm run dev
```

**Should start on:** `http://localhost:3000`

---

### **Step 4: Login as HR User**

1. Go to: `http://localhost:3000/login`
2. Login with your HR account
3. Verify your role is `HR_MANAGER`:
   - Check browser console or
   - Visit: `http://localhost:5000/api/v1/auth/me` (with your token)

---

### **Step 5: Test Attendance**

1. **Click "Attendance & Leave" card** on dashboard
2. **Click "Check In"** button
3. **Verify:**
   - ✅ Button changes to "Check Out"
   - ✅ Status shows "✅ Checked In"
   - ✅ Record appears in table

4. **Click "Check Out"** button
5. **Verify:**
   - ✅ Status updates
   - ✅ Work hours calculated
   - ✅ Record shows check-in and check-out times

---

### **Step 6: Test Leave Management**

1. **Navigate to Leave page:**
   - Click "Leave Management" button on Attendance page, OR
   - Go to: `http://localhost:3000/leave`

2. **Click "Apply for Leave"** button

3. **Fill the form:**
   - **Leave Type:** Should show dropdown with leave types (Annual, Sick, Casual, etc.)
   - **Start Date:** Select a future date
   - **End Date:** Select end date
   - **Reason:** Enter reason (min 10 characters)

4. **Submit the form**

5. **Verify:**
   - ✅ Leave request appears in the table
   - ✅ Status shows "PENDING"
   - ✅ You can see your leave request details

---

### **Step 7: Test HR Features (Approve Leave)**

**Via API (Postman/Thunder Client):**

1. **Get your access token:**
   - Check browser localStorage: `localStorage.getItem('accessToken')`
   - Or login via API and copy token

2. **Get leave request ID:**
   - From the leave requests table
   - Or via API: `GET /api/v1/leaves/requests`

3. **Approve the leave:**
```http
PUT http://localhost:5000/api/v1/leaves/requests/<REQUEST_ID>/approve
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "reviewComments": "Approved"
}
```

4. **Verify:**
   - ✅ Status changes to "APPROVED"
   - ✅ Leave balance is deducted

---

## 🧪 **Quick Test Checklist**

### **Attendance:**
- [ ] Server running on port 5000
- [ ] Can navigate to `/attendance` page
- [ ] Can check-in successfully
- [ ] Can check-out successfully
- [ ] Attendance records visible in table
- [ ] Work hours calculated correctly

### **Leave:**
- [ ] Leave types seeded (run `npm run seed:leave`)
- [ ] Can navigate to `/leave` page
- [ ] Leave types dropdown populated
- [ ] Can apply for leave
- [ ] Leave request appears in table
- [ ] Can approve leave (as HR)

---

## 🔍 **Troubleshooting**

### **Issue: "No leave types in dropdown"**

**Solution:**
```bash
cd backend
npm run seed:leave
```
Then refresh browser.

---

### **Issue: "Cannot check-in - Employee not found"**

**Solution:**
- Your user account must have an associated employee record
- Check: `GET /api/v1/auth/me` should include `employee` object
- If missing, create employee record for your user

---

### **Issue: "Port 5000 already in use"**

**Solution:**
```powershell
# Kill process using port 5000
Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Or use the script
cd backend
.\kill-port.ps1
```

---

### **Issue: "Network Error"**

**Solution:**
1. Verify backend is running: `http://localhost:5000/health`
2. Check CORS settings in backend
3. Verify frontend API URL: Should be `http://localhost:5000/api/v1`

---

## 📊 **Verify Everything Works**

### **1. Check Backend Health:**
```bash
curl http://localhost:5000/health
```

### **2. Check Leave Types:**
```bash
# Get your token first, then:
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/v1/leaves/types
```

### **3. Check Attendance Records:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/v1/attendance/records
```

---

## 🎯 **What You Should See**

### **Dashboard:**
- ✅ "Attendance & Leave" card is clickable
- ✅ Clicking navigates to `/attendance`

### **Attendance Page:**
- ✅ Check-in/Check-out buttons work
- ✅ Attendance records table shows data
- ✅ "Leave Management" button navigates to `/leave`

### **Leave Page:**
- ✅ "Apply for Leave" button works
- ✅ Leave types dropdown has options
- ✅ Can submit leave request
- ✅ Leave requests table shows your requests

---

## 🚀 **Next: Enhance Features**

Once basic functionality works:

1. **Add HR UI for:**
   - Create/Edit Leave Types
   - Approve/Reject Leave Requests
   - View Attendance Reports
   - Manage Shifts

2. **Add Employee Features:**
   - View own leave balance
   - View leave calendar
   - Request attendance regularization

3. **Add Manager Features:**
   - View team attendance
   - Approve team leave requests

---

## 📝 **Quick Commands Reference**

```bash
# Backend
cd backend
npm run dev                    # Start server
npm run seed:leave            # Seed leave data
npm run seed:attendance       # Seed attendance data

# Frontend
cd frontend
npm run dev                   # Start dev server

# Kill port (if needed)
cd backend
.\kill-port.ps1              # Kill processes on port 5000
```

---

## ✅ **Success Criteria**

You'll know everything is working when:

1. ✅ Backend server starts without errors
2. ✅ Can check-in/check-out successfully
3. ✅ Leave types appear in dropdown
4. ✅ Can apply for leave
5. ✅ Leave requests appear in table
6. ✅ Can approve leave (as HR)

---

**Ready? Start with Step 1: Start the backend server!** 🚀
