# Biometric Device Testing Guide (Live GET/POST)

How to test that your HRMS backend receives and processes punches from a live biometric device (eSSL/ZKTeco).

---

## 1. Prerequisites

- Backend running (e.g. `npm run dev` from project root, or `cd backend && npm run dev`)
- Device registered: run `npx ts-node -r tsconfig-paths/register src/scripts/seed-biometric-device.ts` with your device serial
- Employee N001 exists in the organization linked to the device's company, with `employeeCode = 'N001'`

---

## 2. Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/iclock/cdata` or `/iclock/cdata.aspx` | Handshake (device gets config) or punch via query params |
| POST | `/iclock/cdata` or `/iclock/cdata.aspx` | Device uploads punch data |
| GET | `/iclock/getrequest.aspx` | Device polls for server commands (e.g. "Upload ATTLOG") |

**Base URL:** `http://localhost:5001` (or your server URL)

---

## 3. Simulate GET (Handshake)

When the device first connects, it sends a GET with `SN` (serial number) in the query. The server responds with config (TransInterval, DateTime, etc.).

```bash
# Replace SERIAL with your device serial (e.g. CQZ7224460246)
curl -v "http://localhost:5001/iclock/cdata?SN=CQZ7224460246&options=all&language=69"
```

**Expected response (200):** Plain text config like:
```
GET OPTION FROM: CQZ7224460246
Stamp=0
OpStamp=0
TransInterval=1
...
DateTime=2026-03-03 12:30:45
TimeZone=330
```

---

## 4. Simulate POST (Punch Upload)

### Format A: eSSL tab-separated (ATTLOG)

eSSL devices often send tab-separated lines: `Pin\tDateTime\tStatus\t...`

```bash
# Single punch: N001, 2026-03-03 09:15:00, status 0 = IN
curl -X POST "http://localhost:5001/iclock/cdata.aspx?SN=CQZ7224460246&table=ATTLOG&Stamp=9999" \
  -H "Content-Type: text/plain" \
  -d "N001	2026-03-03 09:15:00	0	4	0			0	0"
```

**Alternative timestamp format (YYYYMMDDHHmmss):**
```bash
curl -X POST "http://localhost:5001/iclock/cdata.aspx?SN=CQZ7224460246&table=ATTLOG&Stamp=9999" \
  -H "Content-Type: text/plain" \
  -d "N001	20260303091500	0	4	0			0	0"
```

### Format B: Key=value (line-delimited)

```bash
curl -X POST "http://localhost:5001/iclock/cdata?SN=CQZ7224460246" \
  -H "Content-Type: text/plain" \
  -d "USERID=N001
TIMESTAMP=2026-03-03 09:15:00
STATUS=0
SERIALNO=CQZ7224460246"
```

**STATUS:** `0` = IN (check-in), `1` = OUT (check-out)

### Format C: Form-urlencoded

```bash
curl -X POST "http://localhost:5001/iclock/cdata?SN=CQZ7224460246" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "USERID=N001&TIMESTAMP=20260303091500&STATUS=0&SERIALNO=CQZ7224460246"
```

---

## 5. Simulate GET with punch in query

Some devices send punch via GET query params:

```bash
curl "http://localhost:5001/iclock/cdata?SN=CQZ7224460246&USERID=N001&TIMESTAMP=20260303091500&STATUS=0"
```

---

## 6. Simulate getrequest (device polls for commands)

```bash
curl "http://localhost:5001/iclock/getrequest.aspx?SN=CQZ7224460246"
```

**Expected response:** `C:Upload ATTLOG` (tells device to upload attendance log)

---

## 7. Verify in database

After a successful POST, check:

```sql
-- Latest attendance_logs
SELECT * FROM attendance_logs ORDER BY created_at DESC LIMIT 5;

-- Latest attendance_punches (only if employee N001 was resolved)
SELECT * FROM attendance_punches WHERE employee_id = (SELECT id FROM employees WHERE employee_code = 'N001') ORDER BY punch_time DESC LIMIT 5;
```

---

## 8. Using the built-in test script

```bash
cd backend
BIOMETRIC_DEVICE_SERIAL=CQZ7224460246 npm run test:iclock
```

Uses `EMP001` by default; ensure that employee exists or change the script to use `N001`.

---

## 9. Live device configuration

On the biometric device (eSSL/ZKTeco):

1. **Server URL:** `http://<your-server-ip>:5001/iclock/cdata`
2. **Communication:** TCP/IP
3. **Serial number:** Must match the device registered in `devices` table

The device will:
- **GET** `/iclock/cdata?SN=...` for handshake → receives config
- **POST** `/iclock/cdata.aspx?SN=...&table=ATTLOG&Stamp=9999` with tab-separated body when user punches

---

## 10. Troubleshooting

| Issue | Check |
|------|-------|
| Punch not in calendar | `employeeCode` in HRMS must match device `userId` (e.g. N001) |
| Device not found | Run `seed-biometric-device.ts` with correct serial; device must be `isActive=true` |
| 404 on /iclock/cdata.aspx | Ensure backend routes include `cdata.aspx` (they do) |
| Wrong timezone | Device may send UTC; backend has auto-correction for IST (5.5h offset) |
