# How to Test /iclock/cdata

Your device **CQZ7224460246** is already registered. **Start the backend** (`npm run dev` in the backend folder), then run these tests.

## 0. One-command test (recommended)

From the backend folder, with the backend running:

```bash
npm run test:iclock
```

This runs GET handshake, POSTs a sample punch (USERID=EMP001, SERIALNO=CQZ7224460246), and prints the latest `attendance_logs` row. No PowerShell or curl needed.

---

## 1. Test GET (handshake)

**PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/iclock/cdata" -UseBasicParsing | Select-Object StatusCode, Content
```

**Or curl (if installed):**
```bash
curl -s http://localhost:5000/iclock/cdata
```

**Expected:** StatusCode 200, Content `OK`.

---

## 2. Test POST (single punch)

Send one attendance record with your device serial **CQZ7224460246** and any UserID (e.g. employee code like EMP001).

**PowerShell:**
```powershell
$body = @{
  USERID     = "EMP001"
  TIMESTAMP  = "20260203120000"
  STATUS     = "0"
  SERIALNO   = "CQZ7224460246"
}
Invoke-WebRequest -Uri "http://localhost:5000/iclock/cdata" -Method POST -Body $body -UseBasicParsing | Select-Object StatusCode, Content
```

**Or curl:**
```bash
curl -s -X POST http://localhost:5000/iclock/cdata -d "USERID=EMP001" -d "TIMESTAMP=20260203120000" -d "STATUS=0" -d "SERIALNO=CQZ7224460246"
```

**Expected:** StatusCode 200, Content `SUCCESS`.

---

## 3. Check that the punch was stored

Query the database:

```sql
SELECT * FROM attendance_logs ORDER BY created_at DESC LIMIT 5;
```

You should see a row with `user_id = 'EMP001'`, `punch_timestamp`, and `device_id` pointing to your device.

---

## 4. Test with wrong serial (should skip, still return SUCCESS)

```powershell
$body = @{ USERID = "EMP002"; TIMESTAMP = "20260203120100"; STATUS = "1"; SERIALNO = "UNKNOWN_SERIAL" }
Invoke-WebRequest -Uri "http://localhost:5000/iclock/cdata" -Method POST -Body $body -UseBasicParsing | Select-Object StatusCode, Content
```

**Expected:** HTTP 200, body `SUCCESS`, but no new row in `attendance_logs` (device not in `devices` table).

---

## 5. Test from the real device

1. On the eSSL device, set **Server URL** to:  
   `http://<your-pc-ip>:5000/iclock/cdata`  
   (Use your machine’s LAN IP if the device is on the same network.)
2. Ensure the backend is running and reachable from the device (firewall/port 5000).
3. Do a test punch on the device; then check `attendance_logs` again.
