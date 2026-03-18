/**
 * eSSL Cloud API client for biometric attendance.
 * Fetches punch logs from eSSL Cloud; adapt endpoint/response shape to your eSSL Cloud API version.
 *
 * Env: ESSL_CLOUD_API_URL, ESSL_CLOUD_API_KEY
 * Employee mapping: eSSL user ID / badge number must match Employee.employeeCode in HRMS.
 */

import { logger } from '../utils/logger';

export interface EsslPunchRecord {
  /** User identifier from device (must match Employee.employeeCode in HRMS) */
  employeeCode: string;
  /** Punch date-time in ISO string or Date */
  punchTime: Date;
  /** IN = check-in, OUT = check-out */
  direction: 'IN' | 'OUT';
  /** Optional device/serial for multi-device setups */
  deviceId?: string;
}

export interface EsslCloudConfig {
  baseUrl: string;
  apiKey: string;
  /** Optional: override path for attendance logs, e.g. "/api/v1/attendance/logs" */
  attendanceEndpoint?: string;
}

function getConfig(): EsslCloudConfig | null {
  const baseUrl = process.env.ESSL_CLOUD_API_URL?.trim();
  const apiKey = process.env.ESSL_CLOUD_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    attendanceEndpoint: process.env.ESSL_CLOUD_ATTENDANCE_ENDPOINT?.trim() || '/api/attendance/logs',
  };
}

/**
 * Fetch attendance logs from eSSL Cloud for a date range.
 * Adapt parseEsslResponse() if your API returns a different JSON structure.
 */
export async function fetchEsslAttendanceLogs(
  fromDate: string,
  toDate: string
): Promise<EsslPunchRecord[]> {
  const cfg = getConfig();
  if (!cfg) {
    logger.warn('eSSL Cloud not configured: ESSL_CLOUD_API_URL and ESSL_CLOUD_API_KEY required');
    return [];
  }

  const path = cfg.attendanceEndpoint ?? '/api/attendance/logs';
  const url = new URL(path, cfg.baseUrl);
  url.searchParams.set('fromDate', fromDate);
  url.searchParams.set('toDate', toDate);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      'X-API-Key': cfg.apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(`eSSL Cloud API error status=${res.status} body=${text}`);
    throw new Error(`eSSL Cloud API error: ${res.status} ${text}`);
  }

  const json = (await res.json()) as unknown;
  return parseEsslResponse(json);
}

/**
 * Parse eSSL Cloud API response into normalized punch records.
 * Override this or extend switch logic for your API response shape.
 *
 * Common shapes:
 * - { data: [ { userId, punchTime, direction } ] }
 * - { logs: [ { employeeCode, dateTime, inOut } ] }
 * - [ { userCode, timestamp, type: 'IN'|'OUT' } ]
 */
function parseEsslResponse(json: unknown): EsslPunchRecord[] {
  const out: EsslPunchRecord[] = [];
  const raw = extractRawLogs(json);

  for (const row of raw) {
    const employeeCode = String(
      row.userId ?? row.employeeCode ?? row.userCode ?? row.badgeId ?? row.empCode ?? ''
    ).trim();
    const rawTime =
      row.punchTime ?? row.dateTime ?? row.timestamp ?? row.punchDateTime ?? row.time ?? '';
    const dir = normalizeDirection(
      String(row.direction ?? row.inOut ?? row.type ?? row.punchType ?? row.io ?? '')
    );

    if (!employeeCode) continue;

    const punchTime = parsePunchTime(
      typeof rawTime === 'string' || typeof rawTime === 'number' || rawTime instanceof Date
        ? rawTime
        : String(rawTime)
    );
    if (!punchTime) continue;

    const deviceId =
      row.deviceId != null
        ? String(row.deviceId)
        : row.serialNumber != null
          ? String(row.serialNumber)
          : undefined;
    out.push({
      employeeCode,
      punchTime,
      direction: dir,
      deviceId,
    });
  }

  return out;
}

function extractRawLogs(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
    if (Array.isArray(o.logs)) return o.logs as Record<string, unknown>[];
    if (Array.isArray(o.attendance)) return o.attendance as Record<string, unknown>[];
    if (Array.isArray(o.records)) return o.records as Record<string, unknown>[];
  }
  return [];
}

function normalizeDirection(v: string): 'IN' | 'OUT' {
  const s = String(v).toUpperCase();
  if (s === 'OUT' || s === '0' || s === 'O' || s === 'CHECKOUT') return 'OUT';
  return 'IN';
}

function parsePunchTime(raw: string | number | Date): Date | null {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === 'number' && raw > 0) return new Date(raw);
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const esslCloudService = {
  getConfig,
  fetchAttendanceLogs: fetchEsslAttendanceLogs,
};
