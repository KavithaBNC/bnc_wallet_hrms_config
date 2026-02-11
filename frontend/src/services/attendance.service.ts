import api from './api';

export interface BiometricSyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { employeeCode: string; date: string; message: string }[];
}

export interface ShiftAssignmentInput {
  employeeId: string;
  date: string; // YYYY-MM-DD format
  shiftName: string;
}

export interface BulkShiftAssignmentsResult {
  results: Array<{
    employeeId: string;
    date: string;
    shiftName: string;
    status: 'success' | 'error' | 'skipped';
    message?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    skipped: number;
    errors: number;
  };
}

/** Single attendance record as returned by GET /attendance/records (for calendar/grid) */
export interface AttendanceRecordForGrid {
  employeeId: string;
  date: string; // ISO or YYYY-MM-DD
  shift?: { id: string; name: string; startTime: string; endTime: string } | null;
}

export interface CompOffSummary {
  employeeId: string;
  organizationId: string;
  totalExcessMinutes: number;
  usedExcessMinutes: number;
  pendingExcessMinutes: number;
  availableExcessMinutes: number;
  availableExcessMinutesForRequest: number;
  eligibleCompOffDays: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  conversionEnabled: boolean;
  combineMultipleDays: boolean;
}

export const attendanceService = {
  /**
   * Get attendance records for an employee in a date range (merged with shift rules).
   * Used by calendar and by Associate Shift Grid to pre-fill from current state.
   */
  getRecords: async (params: {
    employeeId: string;
    startDate: string;
    endDate: string;
    organizationId: string;
  }): Promise<AttendanceRecordForGrid[]> => {
    const { data } = await api.get<{ data: { records: AttendanceRecordForGrid[] } }>(
      '/attendance/records',
      { params: { ...params, page: 1, limit: 500 } }
    );
    return data?.data?.records ?? [];
  },

  /**
   * Sync attendance from eSSL biometric / eSSL Cloud API.
   * Requires HR_MANAGER, ORG_ADMIN, or SUPER_ADMIN.
   */
  syncBiometric: async (
    organizationId: string,
    fromDate: string,
    toDate: string
  ): Promise<BiometricSyncResult> => {
    const { data } = await api.post<{ data: BiometricSyncResult }>(
      '/attendance/sync/biometric',
      { organizationId, fromDate, toDate }
    );
    return data.data;
  },

  /**
   * Bulk update shift assignments for employees
   * Creates or updates attendance records with shiftId
   */
  bulkUpdateShiftAssignments: async (
    organizationId: string,
    assignments: ShiftAssignmentInput[]
  ): Promise<BulkShiftAssignmentsResult> => {
    const { data } = await api.post<{ data: BulkShiftAssignmentsResult }>(
      '/attendance/shift-assignments/bulk',
      { organizationId, assignments }
    );
    return data.data;
  },

  getCompOffSummary: async (organizationId: string, employeeId?: string): Promise<CompOffSummary> => {
    const { data } = await api.get<{ data: { summary: CompOffSummary } }>('/attendance/comp-off/summary', {
      params: { organizationId, employeeId },
    });
    return data.data.summary;
  },

  createCompOffRequest: async (
    organizationId: string,
    requestType: 'FULL_DAY' | 'HALF_DAY',
    reason?: string
  ) => {
    const { data } = await api.post<{ data: { request: unknown } }>('/attendance/comp-off/requests', {
      organizationId,
      requestType,
      reason,
    });
    return data.data.request;
  },
};
