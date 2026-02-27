# Test eSSL Punch → attendance_logs

## 1. Backend is ready

- **GET** with punch params (`Pin`, `DateTime`, `Status`, `SN`) → stored in `attendance_logs`.
- **POST** with body (key=value or tab-separated) + query `SN` → stored.
- **GET** with `table=ATTLOG` and `content=Base64(...)` → decoded and stored.
- Every **POST** to cdata and **GET** with punch-related params are **logged** so you can see what the device sends.

## 2. How to test when you punch on the device

1. **Start backend** (if not running):
   ```bash
   cd backend && npm run dev
   ```

2. **Punch on the eSSL device** (one or two times).

3. **Watch the terminal** where the backend is running:
   - Look for lines starting with **`[iclock]`**:
     - **`[iclock] POST cdata.aspx query: ... body: ...`** → device sent a POST; body shows what we received.
     - **`[iclock] GET cdata.aspx query: ...`** (with `Pin`/`DateTime`/`table=ATTLOG`) → device sent punch data in GET.
     - **`[iclock] GET punch stored`** or **`[iclock] POST ... stored`** → a punch was saved.
   - If **no new `[iclock]` line** appears when you punch → the device is **not** sending punch data (only handshake). Then check device: **Real-time upload** / **Upload interval** (e.g. 1 min).

4. **Check that punches were stored**:
   ```bash
   cd backend && npm run check:attendance-log
   ```
   You should see the latest rows from `attendance_logs` (user_id, punch time, device).

## 3. Simulate a punch (backend only)

To confirm the backend stores punches without the device:

```bash
# From backend folder, with backend running:
# GET with punch params (replace DateTime with current time if needed):
# Browser or curl: http://localhost:5000/iclock/cdata.aspx?SN=CQZ7224460246&Pin=1&DateTime=20260203143000&Status=0

# Then check DB:
npm run check:attendance-log
```

Or run the full test (GET handshake + POST punch + DB check):

```bash
npm run test:iclock
```

## 4. If punch still not stored

- **No `[iclock]` log when you punch** → Device is not sending punch data. On the device: enable **Real-time upload** or set **Upload interval** to 1 minute; check ADMS/Cloud Server settings.
- **You see `[iclock] POST ... body: ...`** but no "stored" → Copy the **body** (and query) from the log and share it; we can add support for that format.
- **You see `[iclock] GET cdata.aspx query: ...`** with params but no "stored" → Copy the **full URL** from the log; we can add support for that query format.
