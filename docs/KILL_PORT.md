# How to Fix "Port Already in Use" Error

## 🚨 Error: `EADDRINUSE` - Port 5000 is already in use

This happens when another process is already using port 5000.

---

## 🔧 **Quick Fix Methods**

### **Method 1: Kill the Process (Recommended)**

**Step 1: Find the process using port 5000**
```powershell
netstat -ano | findstr :5000
```

**Step 2: Kill the process**
```powershell
taskkill /PID <PID_NUMBER> /F
```

**Example:**
```powershell
taskkill /PID 20308 /F
```

---

### **Method 2: Use PowerShell (One Command)**

```powershell
Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

---

### **Method 3: Change the Port**

**Option A: Change in .env file**
```env
PORT=5001
```

**Option B: Change in code**
Edit `backend/src/config/config.ts` or set environment variable:
```powershell
$env:PORT=5001
npm run dev
```

---

## 🔍 **Find What's Using the Port**

### **Windows (PowerShell):**
```powershell
# Find process
Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess

# See process details
Get-Process -Id <PID>
```

### **Windows (CMD):**
```cmd
netstat -ano | findstr :5000
tasklist | findstr <PID>
```

---

## 🛠️ **Prevention: Better Error Handling**

I've updated `backend/src/server.ts` to show a helpful error message when the port is in use, including instructions on how to fix it.

---

## ✅ **After Killing the Process**

1. Wait a few seconds for the port to be released
2. Restart your server: `npm run dev`
3. The server should start successfully

---

## 📝 **Common Causes**

1. **Previous server instance still running** - Most common
2. **Another application using port 5000** - Check what's running
3. **Nodemon didn't stop properly** - Kill the process manually

---

## 💡 **Pro Tip: Create a Kill Script**

Create `backend/kill-port.ps1`:
```powershell
$port = 5000
$processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($processes) {
    $processes | ForEach-Object { Stop-Process -Id $_ -Force }
    Write-Host "✅ Killed processes using port $port"
} else {
    Write-Host "ℹ️  No processes found using port $port"
}
```

Then run: `.\kill-port.ps1`

---

## 🚀 **Quick Commands Reference**

```powershell
# Find process
netstat -ano | findstr :5000

# Kill by PID
taskkill /PID <PID> /F

# Kill all Node processes (use with caution!)
taskkill /IM node.exe /F

# PowerShell one-liner
Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```
