/**
 * Biometric (eSSL) attendance sync: map device punch logs to HRMS AttendanceRecord.
 * Employee mapping: eSSL user ID / badge must match Employee.employeeCode for the organization.
 */

import { AttendanceStatus, CheckInMethod, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { fetchEsslAttendanceLogs, EsslPunchRecord } from './essl-cloud.service';
import { logger } from '../utils/logger';

export interface BiometricSyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { employeeCode: string; date: string; message: string }[];
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

async function isHoliday(date: Date, organizationId: string): Promise<boolean> {
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);
  const holiday = await prisma.holiday.findFirst({
    where: {
      organizationId,
      date: { gte: dateStart, lte: dateEnd },
    },
  });
  return !!holiday;
}

function workHours(checkIn: Date, checkOut: Date, breakHours: number = 0): number {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.max(0, diffHours - breakHours);
}

/**
 * Sync biometric attendance from eSSL Cloud into HRMS for an organization and date range.
 * Creates/updates AttendanceRecord with checkInMethod = BIOMETRIC.
 * Uses first IN as checkIn and last OUT as checkOut per employee per day.
 */
export async function syncBiometricFromEssl(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<BiometricSyncResult> {
  const result: BiometricSyncResult = { synced: 0, created: 0, updated: 0, skipped: 0, errors: [] };

  const punches = await fetchEsslAttendanceLogs(fromDate, toDate);
  if (punches.length === 0) {
    logger.info(`eSSL: no punch logs returned organizationId=${organizationId} fromDate=${fromDate} toDate=${toDate}`);
    return result;
  }

  // Group by (employeeCode, date)
  const byEmployeeAndDate = new Map<string, EsslPunchRecord[]>();
  for (const p of punches) {
    const key = `${p.employeeCode}|${toDateOnly(p.punchTime)}`;
    if (!byEmployeeAndDate.has(key)) byEmployeeAndDate.set(key, []);
    byEmployeeAndDate.get(key)!.push(p);
  }

  const employees = await prisma.employee.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, employeeCode: true, shiftId: true, shift: { select: { breakDuration: true } } },
  });
  const empByCode = new Map<string, (typeof employees)[0]>();
  for (const e of employees) empByCode.set(e.employeeCode, e);

  for (const [key, list] of byEmployeeAndDate) {
    const [employeeCode, dateStr] = key.split('|');
    const employee = empByCode.get(employeeCode);
    if (!employee) {
      result.skipped++;
      result.errors.push({
        employeeCode,
        date: dateStr,
        message: 'Employee not found for this organization (ensure eSSL user ID matches employee code)',
      });
      continue;
    }

    const ins = list.filter((p) => p.direction === 'IN').sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());
    const outs = list.filter((p) => p.direction === 'OUT').sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());
    const checkIn = ins[0]?.punchTime;
    const checkOut = outs.length ? outs[outs.length - 1].punchTime : null;

    if (!checkIn) {
      result.skipped++;
      continue;
    }

    const dateOnly = new Date(dateStr + 'T00:00:00.000Z');
    let status: AttendanceStatus = AttendanceStatus.PRESENT;
    if (isWeekend(dateOnly)) status = AttendanceStatus.WEEKEND;
    else if (await isHoliday(dateOnly, organizationId)) status = AttendanceStatus.HOLIDAY;

    const breakMins = employee.shift?.breakDuration ?? 0;
    const breakHours = breakMins / 60;
    const totalHours = checkOut ? workHours(checkIn, checkOut, breakHours) : 0;
    const workHoursVal = checkOut ? workHours(checkIn, checkOut, breakHours) : 0;

    try {
      const existing = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: { employeeId: employee.id, date: dateOnly },
        },
      });

      await prisma.attendanceRecord.upsert({
        where: {
          employeeId_date: { employeeId: employee.id, date: dateOnly },
        },
        create: {
          employeeId: employee.id,
          shiftId: employee.shiftId,
          date: dateOnly,
          checkIn,
          checkOut: checkOut ?? undefined,
          totalHours: new Prisma.Decimal(totalHours),
          breakHours: new Prisma.Decimal(breakHours),
          workHours: new Prisma.Decimal(workHoursVal),
          overtimeHours: new Prisma.Decimal(0),
          status,
          checkInMethod: CheckInMethod.BIOMETRIC,
          notes: 'Synced from eSSL biometric',
        },
        update: {
          checkIn,
          checkOut: checkOut ?? undefined,
          totalHours: new Prisma.Decimal(totalHours),
          breakHours: new Prisma.Decimal(breakHours),
          workHours: new Prisma.Decimal(workHoursVal),
          status,
          checkInMethod: CheckInMethod.BIOMETRIC,
          notes: existing?.notes ? undefined : 'Synced from eSSL biometric',
        },
      });

      result.synced++;
      if (existing) result.updated++;
      else result.created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push({ employeeCode, date: dateStr, message: msg });
      logger.warn(`Biometric sync record failed employeeCode=${employeeCode} date=${dateStr} - ${msg}`);
    }
  }

  logger.info(
    `eSSL biometric sync completed organizationId=${organizationId} fromDate=${fromDate} toDate=${toDate} synced=${result.synced} created=${result.created} updated=${result.updated} skipped=${result.skipped}`
  );
  return result;
}

export const biometricSyncService = {
  syncBiometricFromEssl,
};
