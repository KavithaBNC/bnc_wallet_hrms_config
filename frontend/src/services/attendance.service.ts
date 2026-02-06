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

export const attendanceService = {
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
};
