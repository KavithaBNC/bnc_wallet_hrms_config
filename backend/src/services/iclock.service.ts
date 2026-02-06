/**
 * ADMS / iClock cdata: parse device payload, validate device by serial, store attendance_logs and attendance_punches.
 * eSSL/ZKTeco devices POST key=value lines (USERID, TIMESTAMP, STATUS, SERIALNO) or similar.
 * After storing a punch, we write to attendance_punches (so calendar punch list shows it) and sync attendance_record.
 */

import { AttendanceStatus, CheckInMethod, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { attendanceService } from './attendance.service';

export interface AdmsPunchRecord {
  userId: string;
  timestamp: string;
  status: string;
  serialNumber: string;
}

/**
 * Parse ADMS POST body. Common formats:
 * - Line-delimited key=value: USERID=123\nTIMESTAMP=20260203120000\nSTATUS=0\nSERIALNO=DEV1
 * - Tab-separated records: USERID\tTIMESTAMP\tSTATUS\tSERIALNO\n123\t...
 * - Multiple records separated by newlines (each record key=value lines)
 */
export function parseAdmsBody(body: string): AdmsPunchRecord[] {
  const records: AdmsPunchRecord[] = [];
  const text = (body || '').trim();
  if (!text) return records;

  // Normalize: replace \r\n with \n, split by double newline or tab for multiple records
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Try line-delimited key=value first (single or multi-record)
  const lines = normalized.split('\n').filter((l) => l.trim());
  const keyValue: Record<string, string> = {};
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim().toUpperCase();
      const v = line.slice(eq + 1).trim();
      keyValue[k] = v;
    }
  }

  // Single record from key=value (incl. eSSL Pin, DateTime)
  const userId = keyValue['USERID'] ?? keyValue['USER_ID'] ?? keyValue['EMPCODE'] ?? keyValue['PIN'] ?? '';
  const timestamp = keyValue['TIMESTAMP'] ?? keyValue['PUNCHTIME'] ?? keyValue['DATETIME'] ?? keyValue['TIME'] ?? '';
  const status = keyValue['STATUS'] ?? keyValue['INOUT'] ?? keyValue['DIRECTION'] ?? '0';
  const serialNumber = keyValue['SERIALNO'] ?? keyValue['SERIAL_NUMBER'] ?? keyValue['DEVICEID'] ?? keyValue['DEVICE_SN'] ?? '';

  if (userId && timestamp && serialNumber) {
    records.push({ userId, timestamp, status, serialNumber });
    return records;
  }

  // Try tab-separated: with header (USERID\tTIMESTAMP\tSTATUS\tSERIALNO) or ATTLOG header
  const tabLines = normalized.split('\n').filter((l) => l.includes('\t'));
  if (tabLines.length > 0) {
    const header = tabLines[0].toUpperCase().split('\t').map((h) => h.trim());
    const uidIdx = header.findIndex((h) => /USERID|USER_ID|EMPCODE|PIN/.test(h));
    const tsIdx = header.findIndex((h) => /TIMESTAMP|PUNCHTIME|DATETIME|TIME/.test(h));
    const stIdx = header.findIndex((h) => /STATUS|INOUT|DIRECTION/.test(h));
    const snIdx = header.findIndex((h) => /SERIALNO|SERIAL_NUMBER|DEVICEID/.test(h));
    if (uidIdx >= 0 && tsIdx >= 0 && (snIdx >= 0 || tabLines.length > 1)) {
      for (let i = 1; i < tabLines.length; i++) {
        const parts = tabLines[i].split('\t').map((p) => p.trim());
        const uid = parts[uidIdx] ?? '';
        const ts = parts[tsIdx] ?? '';
        const st = snIdx >= 0 ? (parts[stIdx] ?? '0') : (parts[2] ?? '0');
        const sn = snIdx >= 0 ? (parts[snIdx] ?? '') : '';
        if (uid && ts) records.push({ userId: uid, timestamp: ts, status: st, serialNumber: sn });
      }
      if (records.length > 0) return records;
    }
    // eSSL ATTLOG: no header, each line = Pin\tDateTime\tStatus (3+ columns)
    // DateTime can be YYYYMMDDHHmmss or "YYYY-MM-DD HH:mm:ss"
    const dataOnly = tabLines.every((line) => {
      const p = line.split('\t').map((x) => x.trim());
      const looksLikePin = p.length >= 3 && /^\d+$/.test(p[0]);
      const looksLikeTs = /^\d{8,14}$/.test(p[1]) || /\d{4}-\d{2}-\d{2}/.test(p[1]);
      return looksLikePin && looksLikeTs;
    });
    if (dataOnly && tabLines.length > 0) {
      for (const line of tabLines) {
        const parts = line.split('\t').map((x) => x.trim());
        if (parts.length >= 3 && parts[0] && parts[1]) {
          records.push({
            userId: parts[0],
            timestamp: parts[1].trim(),
            status: parts[2] ?? '0',
            serialNumber: '',
          });
        }
      }
      if (records.length > 0) return records;
    }
  }

  return records;
}

/**
 * Normalize device timestamp to "YYYY-MM-DD HH:mm:ss" for literal DB storage.
 * Prisma converts DateTime to UTC before write; we store the device string via raw SQL.
 */
function toLiteralTimestamp(ts: string): string | null {
  const s = (ts || '').trim();
  if (!s) return null;
  // Already "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19);
  // YYYYMMDDHHmmss
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
  return null;
}

/**
 * Parse timestamp from device for validation only; actual storage uses literal string.
 */
function parsePunchTimestamp(ts: string): Date | null {
  const literal = toLiteralTimestamp(ts);
  if (!literal) return null;
  const d = new Date(literal.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Validate device by serial number. Only process if device exists (and optionally is active).
 */
export async function getDeviceBySerial(serialNumber: string) {
  return prisma.biometricDevice.findFirst({
    where: { serialNumber: serialNumber.trim(), isActive: true },
    include: { company: true },
  });
}

/**
 * Resolve userId (device user id) to Employee in the same company's organization (if company has organizationId).
 */
async function resolveEmployeeId(userId: string, companyId: string): Promise<string | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { organizationId: true },
  });
  if (!company?.organizationId) return null;
  const emp = await prisma.employee.findFirst({
    where: {
      organizationId: company.organizationId,
      employeeCode: userId.trim(),
      deletedAt: null,
    },
    select: { id: true },
  });
  return emp?.id ?? null;
}

/** Treat device status as IN (check-in) or OUT (check-out). Common: 0/in/IN = in, 1/out/OUT = out. */
function isPunchIn(status: string): boolean {
  const s = (status || '').trim().toLowerCase();
  return s === '0' || s === 'in' || s === 'checkin' || s === 'punchin' || s === 'entry';
}

function isPunchOut(status: string): boolean {
  const s = (status || '').trim().toLowerCase();
  return s === '1' || s === 'out' || s === 'checkout' || s === 'punchout' || s === 'exit';
}

/**
 * Sync attendance_records for an employee on a given date from attendance_logs.
 * Uses first IN punch as checkIn and last OUT punch as checkOut so calendar shows the data.
 */
async function syncAttendanceRecordFromLogs(employeeId: string, punchDate: Date): Promise<void> {
  const dateStart = new Date(punchDate);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(punchDate);
  dateEnd.setHours(23, 59, 59, 999);

  const logs = await prisma.attendanceLog.findMany({
    where: {
      employeeId,
      punchTimestamp: { gte: dateStart, lte: dateEnd },
    },
    orderBy: { punchTimestamp: 'asc' },
  });

  const ins = logs.filter((l) => isPunchIn(l.status));
  const outs = logs.filter((l) => isPunchOut(l.status));
  const checkIn = ins[0]?.punchTimestamp ?? null;
  const checkOut = outs.length > 0 ? outs[outs.length - 1].punchTimestamp : null;

  if (!checkIn) return;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { organizationId: true, shiftId: true, shift: { select: { breakDuration: true } } },
  });
  if (!employee) return;

  const isWeekend = (d: Date) => {
    const day = d.getDay();
    return day === 0 || day === 6;
  };
  let status: AttendanceStatus = AttendanceStatus.PRESENT;
  if (isWeekend(dateStart)) status = AttendanceStatus.WEEKEND;
  else {
    const holiday = await prisma.holiday.findFirst({
      where: {
        organizationId: employee.organizationId,
        date: { gte: dateStart, lte: dateEnd },
      },
    });
    if (holiday) status = AttendanceStatus.HOLIDAY;
  }

  const breakMins = employee.shift?.breakDuration ?? 0;
  const breakHours = breakMins / 60;
  const totalHours = checkOut ? (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) : 0;
  const workHoursVal = checkOut ? Math.max(0, totalHours - breakHours) : 0;
  const standardHours = 8;
  const overtimeHours = Math.max(0, workHoursVal - standardHours);

  await prisma.attendanceRecord.upsert({
    where: {
      employeeId_date: { employeeId, date: dateStart },
    },
    create: {
      employeeId,
      shiftId: employee.shiftId,
      date: dateStart,
      checkIn,
      checkOut: checkOut ?? undefined,
      totalHours: new Prisma.Decimal(totalHours),
      breakHours: new Prisma.Decimal(breakHours),
      workHours: new Prisma.Decimal(workHoursVal),
      overtimeHours: new Prisma.Decimal(overtimeHours),
      status,
      checkInMethod: CheckInMethod.BIOMETRIC,
      notes: 'From biometric device punch',
    },
    update: {
      checkIn,
      checkOut: checkOut ?? undefined,
      totalHours: new Prisma.Decimal(totalHours),
      breakHours: new Prisma.Decimal(breakHours),
      workHours: new Prisma.Decimal(workHoursVal),
      overtimeHours: new Prisma.Decimal(overtimeHours),
      status,
      checkInMethod: CheckInMethod.BIOMETRIC,
      notes: 'From biometric device punch',
    },
  });
  logger.info(`[iclock] Synced attendance_record for employee=${employeeId} date=${dateStart.toISOString().slice(0, 10)}`);
}

/**
 * Process parsed ADMS records: validate device by serial, insert into attendance_logs, respond so device clears buffer.
 */
export async function processAdmsRecords(records: AdmsPunchRecord[]): Promise<{ processed: number; skipped: number; errors: string[] }> {
  const result = { processed: 0, skipped: 0, errors: [] as string[] };
  console.log('Attempting to insert into DB:', records);

  // Must loop: device can send up to MaxLogCount (e.g. 50) records in one POST
  for (const rec of records) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/40a87c8f-5aae-4e89-ab91-22bf9e52eb76', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'iclock.service.ts:processAdmsRecords', message: 'record from device', data: { recTimestamp: rec.timestamp, userId: rec.userId }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'B' }) }).catch(() => { });
    // #endregion
    let device = await getDeviceBySerial(rec.serialNumber);

    // Auto-create device if not found (fixes issue after DB reset)
    if (!device) {
      logger.info(`[iclock] New device detected: ${rec.serialNumber}, creating entry...`);
      // Need a company to attach to. Find first company or create a default "Unknown" company.
      let defaultCompany = await prisma.company.findFirst();
      if (!defaultCompany) {
        // Create a default organization and company if completely empty
        const org = await prisma.organization.create({ data: { name: 'Default Org', timezone: 'Asia/Kolkata', currency: 'INR' } });
        defaultCompany = await prisma.company.create({ data: { name: 'Default Company', organizationId: org.id } });
      }

      device = await prisma.biometricDevice.create({
        data: {
          serialNumber: rec.serialNumber,
          name: `Auto-Detected ${rec.serialNumber}`,
          companyId: defaultCompany.id,
          isActive: true
        },
        include: { company: true }
      });
    }

    if (!device) {
      // Should not happen after creation attempt
      result.skipped++;
      result.errors.push(`Device creation failed: ${rec.serialNumber}`);
      continue;
    }

    const punchTime = parsePunchTimestamp(rec.timestamp);
    let literalTs = toLiteralTimestamp(rec.timestamp);

    // Auto-correction: If device sends UTC (approx 5.5h behind server time), fix it to IST.
    // This handles devices that ignore the TimeZone handshake or revert to UTC internally.
    if (punchTime) {
      const serverTime = new Date();
      // Calculate difference in hours
      const diffHours = (serverTime.getTime() - punchTime.getTime()) / (1000 * 60 * 60);

      // If punch is roughly 5.5 hours behind (allowing margin e.g. 5.0 to 6.0 hours)
      // AND exact minutes match the offset (UTC vs IST minutes might differ, but generally check if removing 5.5h sets it to near future or past)
      // Simpler check: If punch is > 5 hours old instantly? No, punches can be old.
      // Better check: Compare punchTime to expected time. If user punched "now" and we see "5.5h ago", correct it.
      // Since we process real-time events, "now" is a good proxy.

      // Check if punch is roughly 5 hours and 30 minutes behind "now" (tolerance +/- 10 mins)
      if (diffHours > 5.3 && diffHours < 5.7) {
        // Add 5.5 hours to the punch time
        const correctedTime = new Date(punchTime.getTime() + (5.5 * 60 * 60 * 1000));
        // Use Sweden locale trick again to get YYYY-MM-DD HH:mm:ss in Local Time
        literalTs = correctedTime.toLocaleString('sv-SE').replace('T', ' ');
        logger.info(`[iclock] Auto-corrected timestamp from ${rec.timestamp} to ${literalTs} (detected UTC)`);
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/40a87c8f-5aae-4e89-ab91-22bf9e52eb76', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'iclock.service.ts:processAdmsRecords', message: 'literal timestamp for DB', data: { recTimestamp: rec.timestamp, literalTs }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'D', runId: 'post-fix' }) }).catch(() => { });
    // #endregion
    if (!literalTs) {
      result.skipped++;
      result.errors.push(`Invalid timestamp: ${rec.timestamp}`);
      continue;
    }

    const employeeId = await resolveEmployeeId(rec.userId, device.companyId);

    try {
      // Store punch_timestamp as literal string so DB has exact device date/time (Prisma would convert to UTC)
      // Also store created_at in Local Time (IST) explicitly
      const createdAtLiteral = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');

      await prisma.$executeRaw`
        INSERT INTO attendance_logs (device_id, user_id, punch_timestamp, status, employee_id, punch_source, created_at)
        VALUES (${device.id}::uuid, ${rec.userId.trim()}, ${literalTs}::timestamp, ${rec.status.trim()}, ${employeeId ?? null}::uuid, 'BIOMETRIC', ${createdAtLiteral}::timestamp)
      `;
      result.processed++;

      // Also insert into attendance_punches so calendar (and universal punch list) shows the device punch
      if (employeeId && literalTs) {
        // Interpret device timestamp as IST so DB stores correct UTC regardless of server timezone
        const punchTimestampForPunch = new Date(literalTs.replace(' ', 'T') + '+05:30');
        const statusPunch = isPunchIn(rec.status) ? 'IN' : isPunchOut(rec.status) ? 'OUT' : 'IN';
        try {
          await prisma.attendancePunch.create({
            data: {
              employeeId,
              punchTime: punchTimestampForPunch,
              status: statusPunch,
              punchSource: 'CARD',
            },
          });
          const dayStart = new Date(punchTimestampForPunch);
          dayStart.setHours(0, 0, 0, 0);
          await attendanceService.syncAttendanceRecordFromPunches(employeeId, dayStart);
        } catch (err) {
          logger.warn(`[iclock] attendance_punch create/sync failed employeeId=${employeeId} - ${err instanceof Error ? err.message : String(err)}`);
          // Fallback: sync record from logs so at least First In/Last Out show
          const dayStart = new Date(punchTimestampForPunch);
          dayStart.setHours(0, 0, 0, 0);
          syncAttendanceRecordFromLogs(employeeId, dayStart).catch(() => {});
        }
      } else if (!employeeId) {
        logger.warn(
          `[iclock] Punch NOT shown in calendar: device userId="${rec.userId}" could not be matched to an employee. ` +
            `Ensure employeeCode in HRMS matches the device user id. Device companyId=${device.companyId}`
        );
      }
    } catch (err) {
      result.skipped++;
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`iclock/cdata: insert failed userId=${rec.userId} serialNumber=${rec.serialNumber} - ${errMsg}`);
    }
  }

  return result;
}
