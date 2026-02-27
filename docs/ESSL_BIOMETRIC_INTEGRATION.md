# eSSL Biometric Device Integration

This HRMS integrates with **eSSL biometric devices** in two ways:

1. **ADMS / iClock Push (recommended for new devices)** – Devices POST attendance logs to our listener at **GET/POST `/iclock/cdata`**. Data is validated by device serial (must exist in `devices` table) and stored in `attendance_logs`. See [ADMS_ICLOCK_CDATA.md](ADMS_ICLOCK_CDATA.md) for schema (companies, devices, attendance_logs) and setup.
2. **eSSL Cloud API (pull)** – The backend can also pull logs from an external eSSL Cloud API and sync into attendance records (below).

## How It Works

1. **eSSL Cloud API** – The backend calls your eSSL Cloud API to fetch attendance logs for a date range.
2. **Employee mapping** – Each punch is matched to an HRMS employee by **employee code**. The user ID / badge number in the eSSL device or cloud must match `Employee.employeeCode` in this HRMS for the same organization.
3. **Attendance records** – For each employee and date, the first **IN** punch is stored as check-in and the last **OUT** punch as check-out. Records are saved with `checkInMethod: BIOMETRIC` and appear in the normal attendance reports.

## Configuration

### Environment variables (backend)

Add to `.env` in the backend:

```env
# eSSL Cloud API
ESSL_CLOUD_API_URL=https://your-essl-cloud-base-url.com
ESSL_CLOUD_API_KEY=your-api-key

# Optional: if your API uses a different path for attendance logs
ESSL_CLOUD_ATTENDANCE_ENDPOINT=/api/attendance/logs
```

- **ESSL_CLOUD_API_URL** – Base URL of your eSSL Cloud API (no trailing slash).
- **ESSL_CLOUD_API_KEY** – API key or token used for authentication (sent as `Authorization: Bearer` and `X-API-Key`).
- **ESSL_CLOUD_ATTENDANCE_ENDPOINT** – Path to the attendance logs endpoint. Default: `/api/attendance/logs`. The client calls `GET {baseUrl}{endpoint}?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`.

If `ESSL_CLOUD_API_URL` or `ESSL_CLOUD_API_KEY` is missing, the sync feature is disabled (sync returns no data from eSSL).

### eSSL Cloud API response shape

The integration expects the API to return a list of punch records. It supports several common JSON shapes:

- **Array at top level:** `[ { userId, punchTime, direction } ]`
- **Wrapped in `data`:** `{ data: [ { ... } ] }`
- **Wrapped in `logs` / `attendance` / `records`:** same idea

Each punch object can use any of these field names (case-insensitive where we check):

| Purpose       | Supported field names                          |
|---------------|-------------------------------------------------|
| User ID       | `userId`, `employeeCode`, `userCode`, `badgeId`, `empCode` |
| Punch time    | `punchTime`, `dateTime`, `timestamp`, `punchDateTime`, `time` |
| Direction     | `direction`, `inOut`, `type`, `punchType`, `io` (values: IN/OUT or 0/1, etc.) |

If your API uses different names, you can extend `parseEsslResponse()` in `backend/src/services/essl-cloud.service.ts`.

## Syncing Attendance

### API (HR / Admin only)

Only **SUPER_ADMIN**, **ORG_ADMIN**, and **HR_MANAGER** can trigger a sync.

**Endpoint:** `POST /api/v1/attendance/sync/biometric`

**Headers:**  
`Authorization: Bearer <access_token>`

**Body:**

```json
{
  "organizationId": "uuid-of-organization",
  "fromDate": "2026-02-01",
  "toDate": "2026-02-03"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Biometric sync completed",
  "data": {
    "synced": 15,
    "created": 12,
    "updated": 3,
    "skipped": 1,
    "errors": [
      {
        "employeeCode": "UNKNOWN01",
        "date": "2026-02-01",
        "message": "Employee not found for this organization (ensure eSSL user ID matches employee code)"
      }
    ]
  }
}
```

- **synced** – Total records created or updated.
- **created** – New attendance records.
- **updated** – Existing records updated with biometric data.
- **skipped** – Employee codes with no matching HRMS employee or no check-in.
- **errors** – Per-employee/per-date errors (e.g. unknown employee code, DB errors).

### Employee code alignment

- In eSSL devices / eSSL Cloud, set each user’s **user ID** or **badge number** to the same value as that person’s **Employee.employeeCode** in this HRMS (for the correct organization).
- If they don’t match, those punches will be skipped and listed in `errors` with “Employee not found…”.

## Frontend (optional)

You can add an “Sync eSSL attendance” (or “Sync biometric”) button that calls:

```ts
POST /api/v1/attendance/sync/biometric
Body: { organizationId, fromDate, toDate }
```

Use the same auth token and organization context as the rest of the app. Only HR/Admin roles will be allowed by the backend.

## Files involved

| File | Purpose |
|------|--------|
| `backend/src/services/essl-cloud.service.ts` | eSSL Cloud API client; fetches and normalizes punch logs. |
| `backend/src/services/biometric-sync.service.ts` | Maps punches to employees, upserts `AttendanceRecord` with BIOMETRIC. |
| `backend/src/utils/attendance.validation.ts` | Validation schema for sync body (`syncBiometricSchema`). |
| `backend/src/controllers/attendance.controller.ts` | `syncBiometric` handler. |
| `backend/src/routes/attendance.routes.ts` | `POST /sync/biometric` route and auth. |

## Troubleshooting

- **“eSSL Cloud not configured”** – Set `ESSL_CLOUD_API_URL` and `ESSL_CLOUD_API_KEY` in `.env`.
- **“Employee not found”** – Ensure the eSSL user ID matches `Employee.employeeCode` for that organization.
- **Empty or wrong punches** – Check `ESSL_CLOUD_ATTENDANCE_ENDPOINT` and the query params (`fromDate`, `toDate`). If your API uses different field names, update `parseEsslResponse()` in `essl-cloud.service.ts`.
- **401/403 from eSSL** – Verify `ESSL_CLOUD_API_KEY` and that the key has permission to read attendance logs.
