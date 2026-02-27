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
  eligibleConversionMinutes?: number;
  remainingAfterEligibleConversionMinutes?: number;
  expiryDaysForWorkDay?: number;
}

export interface CompOffRequestItem {
  id: string;
  employeeId: string;
  organizationId: string;
  requestType: 'FULL_DAY' | 'HALF_DAY';
  requestDays: number | string;
  convertedDays: number;
  usedExcessMinutes: number;
  convertedMinutes: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string | null;
  reviewComments?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { id: string; name: string };
  };
  departmentName?: string | null;
  requestedOn?: string;
  totalExcessMinutes?: number;
  eligibleConversionDays?: number;
  remainingMinutes?: number;
}

export interface CompOffRequestDetails {
  request: CompOffRequestItem & {
    employeeName: string;
    departmentName?: string | null;
  };
  summary: CompOffSummary;
  conversionRules: {
    halfDayMinutes: number;
    fullDayMinutes: number;
    combineMultipleDays: boolean;
  };
  dailyBreakdown: Array<{
    date: string;
    excessMinutes: number;
    expiryDate: string | null;
  }>;
}

/** Daily summary for Validation Process calendar (system-calculated counts). */
export interface ValidationDaySummary {
  completed: number;
  approvalPending: number;
  late: number;
  earlyGoing: number;
  noOutPunch: number;
  shiftChange: number;
  absent: number;
  shortfall: number;
  overtime: number;
  onHold: number;
}

export interface CompletedListRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  date: string;
  isCompleted: boolean;
  isOnHold: boolean;
  holdReason: string | null;
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

  getCompOffRequests: async (params: {
    organizationId: string;
    employeeId?: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get<{
      data: {
        requests: CompOffRequestItem[];
        summary: CompOffSummary;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>('/attendance/comp-off/requests', { params });
    return data.data;
  },

  getCompOffRequestDetails: async (requestId: string, organizationId: string): Promise<CompOffRequestDetails> => {
    const { data } = await api.get<{ data: CompOffRequestDetails }>(`/attendance/comp-off/requests/${requestId}`, {
      params: { organizationId },
    });
    return data.data;
  },

  approveCompOffRequest: async (requestId: string, reviewComments?: string) => {
    const { data } = await api.put<{ data: { request: CompOffRequestItem } }>(
      `/attendance/comp-off/requests/${requestId}/approve`,
      { reviewComments }
    );
    return data.data.request;
  },

  rejectCompOffRequest: async (requestId: string, reviewComments: string) => {
    const { data } = await api.put<{ data: { request: CompOffRequestItem } }>(
      `/attendance/comp-off/requests/${requestId}/reject`,
      { reviewComments }
    );
    return data.data.request;
  },

  convertExcessTimeToCompOff: async (organizationId: string, reason?: string, employeeId?: string) => {
    const { data } = await api.post<{
      data: {
        request: CompOffRequestItem;
        conversion: {
          availableExcessMinutesForRequest: number;
          eligibleCompOffDays: number;
          convertedMinutes: number;
          remainingMinutes: number;
        };
      };
    }>('/attendance/comp-off/requests/convert', {
      organizationId,
      reason,
      employeeId,
    });
    return data.data;
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

  /**
   * Get validation process calendar summary from stored results.
   */
  getValidationProcessCalendarSummary: async (params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
  }): Promise<{ daily: Record<string, ValidationDaySummary> }> => {
    const { data } = await api.get<{ data: { daily: Record<string, ValidationDaySummary> } }>(
      '/attendance/validation-process/calendar-summary',
      { params }
    );
    return data.data;
  },

  /**
   * Run validation process: process attendance, store results, return aggregated day-wise counts.
   * Call when user clicks Process button.
   */
  runValidationProcess: async (params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
  }): Promise<{ daily: Record<string, ValidationDaySummary> }> => {
    const { data } = await api.post<{ data: { daily: Record<string, ValidationDaySummary> } }>(
      '/attendance/validation-process/run',
      params
    );
    return data.data;
  },

  getValidationLateDeductions: async (params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
  }): Promise<LateDeductionResult> => {
    const { data } = await api.post<{ data: LateDeductionResult }>(
      '/attendance/validation-process/late-deductions',
      params
    );
    return data.data;
  },

  /** Get validation process employee list for the grid (by type and date range). */
  getValidationProcessEmployeeList: async (params: {
    organizationId: string;
    fromDate: string;
    toDate: string;
    type: string;
    paygroupId?: string;
    employeeId?: string;
  }): Promise<{ rows: ValidationProcessEmployeeRow[] }> => {
    const { data } = await api.get<{ data: { rows: ValidationProcessEmployeeRow[] } }>(
      '/attendance/validation-process/employee-list',
      { params }
    );
    return data.data;
  },

  /** Revert HR validation corrections for a date range. Removes HR-created leaves and restores balances. */
  revertValidationCorrection: async (params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
    remarks?: string;
  }): Promise<{ reverted: number; leaveRequestsDeleted: number; balancesRestored: number; errors: { employeeId: string; date: string; message: string }[] }> => {
    const { data } = await api.post<{ data: { reverted: number; leaveRequestsDeleted: number; balancesRestored: number; errors: { employeeId: string; date: string; message: string }[] } }>(
      '/attendance/validation-process/revert',
      params
    );
    return data.data;
  },

  /** Clear all validation results for a date range (deletes lock so events can be applied). */
  clearValidationResults: async (params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
  }): Promise<{ deleted: number }> => {
    const { data } = await api.post<{ data: { deleted: number } }>(
      '/attendance/validation-process/clear',
      params
    );
    return data.data;
  },

  /** Get validation revert history (audit log). */
  getValidationRevertHistory: async (params: {
    organizationId: string;
    page?: number;
    limit?: number;
  }): Promise<{
    history: ValidationRevertHistoryEntry[];
    total: number;
  }> => {
    const { data } = await api.get<{ data: { history: ValidationRevertHistoryEntry[]; total: number } }>(
      '/attendance/validation-process/revert-history',
      { params }
    );
    return data.data;
  },

  /** Get completed/on-hold validation rows for Revert Process page. */
  getCompletedList: async (params: {
    organizationId: string;
    fromDate: string;
    toDate: string;
    paygroupId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ rows: CompletedListRow[]; total: number; page: number; limit: number }> => {
    const { data } = await api.get<{ data: { rows: CompletedListRow[]; total: number; page: number; limit: number } }>(
      '/attendance/validation-process/completed-list',
      { params }
    );
    return data.data;
  },

  /** Revert specific employee+date rows. */
  revertByRows: async (params: {
    organizationId: string;
    selectedRows: { employeeId: string; date: string }[];
    remarks?: string;
  }): Promise<{ reverted: number; leaveRequestsDeleted: number; balancesRestored: number; errors: { employeeId: string; date: string; message: string }[] }> => {
    const { data } = await api.post<{ data: { reverted: number; leaveRequestsDeleted: number; balancesRestored: number; errors: { employeeId: string; date: string; message: string }[] } }>(
      '/attendance/validation-process/revert-rows',
      params
    );
    return data.data;
  },

  /** Put selected rows on hold. */
  putOnHold: async (params: {
    organizationId: string;
    selectedRows: { employeeId: string; date: string }[];
    holdAssociateCanModify?: boolean;
    holdManagerCanModify?: boolean;
    revertRegularization?: boolean;
    reason?: string;
  }): Promise<{ updated: number; errors: { employeeId: string; date: string; message: string }[] }> => {
    const { data } = await api.post<{ data: { updated: number; errors: { employeeId: string; date: string; message: string }[] } }>(
      '/attendance/validation-process/on-hold',
      params
    );
    return data.data;
  },

  /** Release selected rows from hold. */
  releaseHold: async (params: {
    organizationId: string;
    selectedRows: { employeeId: string; date: string }[];
  }): Promise<{ released: number; errors: { employeeId: string; date: string; message: string }[] }> => {
    const { data } = await api.post<{ data: { released: number; errors: { employeeId: string; date: string; message: string }[] } }>(
      '/attendance/validation-process/release-hold',
      params
    );
    return data.data;
  },

  /** Apply validation correction (leave deduction) for selected employees based on rule or direct component. */
  applyValidationCorrection: async (params: {
    organizationId: string;
    ruleId?: string;
    directComponentId?: string;
    type?: string;
    selectedRows: { employeeId: string; date: string }[];
    remarks?: string;
  }): Promise<{ applied: number; errors: { employeeId: string; date: string; message: string }[]; skipped?: { employeeId: string; date: string; message: string }[] }> => {
    const { data } = await api.post<{
      data: { applied: number; errors: { employeeId: string; date: string; message: string }[]; skipped?: { employeeId: string; date: string; message: string }[] };
    }>('/attendance/validation-process/apply-correction', params);
    return data.data;
  },
};

export interface LateDeductionEmployee {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  lateCount: number;
  totalLateMinutes: number;
  totalLateHours: number;
  actionName: string;
  deductionType: string;
  deductionDays: number;
  permissionExhausted: boolean;
}

export interface LateDeductionResult {
  employees: LateDeductionEmployee[];
  totals: {
    totalEmployees: number;
    totalLateCount: number;
    totalLateMinutes: number;
  };
}

export interface ValidationRevertHistoryEntry {
  id: string;
  fromDate: string;
  toDate: string;
  employeeCount: number;
  dayCount: number;
  leaveRequestsDeleted: number;
  balancesRestored: number;
  remarks: string | null;
  revertedByUserId: string;
  revertDetails: unknown;
  createdAt: string;
}

export interface ValidationProcessEmployeeRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  date: string;
  shiftName: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  firstInPunch: string | null;
  lastOutPunch: string | null;
  presentFirstHalf: string | null;
  presentSecondHalf: string | null;
  leaveFirstHalf: string | null;
  leaveSecondHalf: string | null;
}
