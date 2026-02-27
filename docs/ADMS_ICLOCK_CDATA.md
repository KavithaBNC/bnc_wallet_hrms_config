# ADMS / iClock cdata – Biometric Push Protocol Listener

This document describes the **Biometric Push Protocol (ADMS) listener** that receives real-time attendance logs from eSSL/ZKTeco devices.

## Endpoint

| Method | Path        | Purpose                    |
|--------|-------------|----------------------------|
| GET    | `/iclock/cdata` | Initialization / handshake; device checks server is ready. |
| POST   | `/iclock/cdata` | Upload attendance logs (UserID, Timestamp, Status, Device Serial). |

Base URL example: `https://your-hrms-server.com/iclock/cdata`

No authentication is required for these endpoints (devices call without JWT). Add firewall or API key later if needed.

## GET /iclock/cdata (handshake)

- **Response:** `200 OK` with body `OK`.
- Use: Device initialization; server confirms it is ready so the device can proceed to POST data.

## POST /iclock/cdata (data upload)

### Request body formats

The listener accepts:

1. **Line-delimited key=value (text/plain)**

   ```
   USERID=123
   TIMESTAMP=20260203120000
   STATUS=0
   SERIALNO=DEVICE001
   ```

   Supported key names (case-insensitive):

   | Purpose   | Keys |
   |-----------|------|
   | User ID   | `USERID`, `USER_ID`, `EMPCODE` |
   | Timestamp | `TIMESTAMP`, `PUNCHTIME`, `DATETIME` |
   | Status    | `STATUS`, `INOUT`, `DIRECTION` (e.g. 0=IN, 1=OUT) |
   | Device    | `SERIALNO`, `SERIAL_NUMBER`, `DEVICEID`, `DEVICE_SN` |

   Timestamp can be `YYYYMMDDHHmmss` or ISO.

2. **Form-urlencoded or JSON**

   Same field names as above (e.g. `USERID`, `TIMESTAMP`, `STATUS`, `SERIALNO`).

### Device validation

- **Only records from known devices are processed.** The server looks up the device by **Serial Number** in the `devices` table.
- If the serial number is **not** found (or the device is inactive), the record is **skipped** and the server still returns `200 SUCCESS` so the device can clear its buffer. Skipped records are logged.

### Response

- **Success:** `200 OK` with body `SUCCESS` (or `OK`) so the device clears its internal buffer.
- **Error:** On server error, a non-2xx response may be returned; the device may retry.

## Database schema (three tables)

### 1. companies

Stores companies (can be linked to HRMS Organization).

| Column           | Type      | Notes                          |
|------------------|-----------|--------------------------------|
| id               | UUID      | Primary key                    |
| name             | VARCHAR   | Company name                   |
| organization_id  | UUID      | Optional FK to `organizations` |
| created_at       | TIMESTAMPTZ | |
| updated_at       | TIMESTAMPTZ | |

### 2. devices (linked to company)

Stores biometric devices; **only devices in this table are accepted** for POST /iclock/cdata.

| Column        | Type      | Notes                          |
|---------------|-----------|--------------------------------|
| id            | UUID      | Primary key                    |
| company_id    | UUID      | FK to `companies`              |
| serial_number | VARCHAR   | **Unique**; used for validation |
| name          | VARCHAR   | Optional                       |
| is_active     | BOOLEAN   | Default true; inactive = skipped |
| created_at    | TIMESTAMPTZ | |
| updated_at    | TIMESTAMPTZ | |

### 3. attendance_logs (linked to user and device)

Stores each punch from the device.

| Column          | Type      | Notes                          |
|-----------------|-----------|--------------------------------|
| id              | UUID      | Primary key                    |
| device_id       | UUID      | FK to `devices`                |
| user_id         | VARCHAR   | User ID from device            |
| punch_timestamp | TIMESTAMPTZ | Punch time                  |
| status          | VARCHAR   | e.g. 0/1 or IN/OUT             |
| employee_id     | UUID      | Optional FK to `employees` (resolved by employeeCode in same org) |
| created_at      | TIMESTAMPTZ | |

If the device’s company has an `organization_id`, the listener tries to resolve `user_id` to an HRMS employee by `Employee.employeeCode` in that organization and sets `employee_id` when found.

## Setup

1. **Create company and device**

   Insert a row in `companies` (and optionally link `organization_id` to your HRMS organization). Then insert a row in `devices` with the **exact serial number** that the eSSL/ZKTeco device reports (e.g. from device settings or sticker).

2. **Configure the device**

   In the device’s “Server” or “Push” settings, set:

   - **Server URL:** `https://your-hrms-server.com/iclock/cdata`
   - **Protocol:** HTTP GET (handshake) and HTTP POST (data), as per your device manual.

3. **Apply schema (if not using Prisma migrations)**

   Run the SQL in [database/adms_companies_devices_attendance_logs.sql](database/adms_companies_devices_attendance_logs.sql), or use `npx prisma db push` / `prisma migrate deploy` so that `companies`, `devices`, and `attendance_logs` exist.

## Files

| File | Purpose |
|------|--------|
| [backend/prisma/schema.prisma](backend/prisma/schema.prisma) | Models: Company, BiometricDevice, AttendanceLog |
| [backend/src/routes/iclock.routes.ts](backend/src/routes/iclock.routes.ts) | GET/POST /iclock/cdata |
| [backend/src/controllers/iclock.controller.ts](backend/src/controllers/iclock.controller.ts) | Handlers; respond OK/SUCCESS |
| [backend/src/services/iclock.service.ts](backend/src/services/iclock.service.ts) | Parse body, validate device by serial, insert attendance_logs |

## Device only sends GET (no POST)

If your terminal shows **only GET** to `/iclock/cdata.aspx` (e.g. `options=all&language=69&pushver=...`) and **no POST** when you punch:

1. **Backend:** GET cdata now accepts punch data in the **query string**. If the device ever sends a GET with `Pin`, `DateTime`, `Status`, and `SN` (e.g. `GET /iclock/cdata.aspx?SN=...&Pin=1&DateTime=20260203120000&Status=0`), the punch will be stored in `attendance_logs`.

2. **Device settings:** Many eSSL devices send attendance via **POST** only after you enable:
   - **Real-time upload** or **Push attendance**
   - **Upload interval** (e.g. 1 minute) so punches are sent soon after they occur  
   Check the device menu (Cloud Server / ADMS / Upload) and the device manual for “when does the device send attendance data”.
