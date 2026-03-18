import api from './api';

export interface MonthlyAttendanceLock {
  id: string;
  organizationId: string;
  year: number;
  month: number;
  lockedAt: string;
  lockedById?: string;
  remarks?: string | null;
}

export interface BuildMonthResult {
  message: string;
  totalEmployees: number;
  successCount: number;
  failedCount: number;
  results: Array<{ employeeId: string; summaryId?: string; error?: string }>;
}

const attendanceLockService = {
  buildMonth: async (
    organizationId: string,
    year: number,
    month: number
  ): Promise<BuildMonthResult> => {
    const response = await api.post(
      '/monthly-attendance-summary/build-month',
      { organizationId, year, month },
      { timeout: 120000 }
    );
    return response.data.data ?? response.data;
  },

  getSummariesForMonth: async (
    organizationId: string,
    year: number,
    month: number,
    status?: string
  ): Promise<{ data: unknown[]; total: number }> => {
    const params: Record<string, string | number> = { organizationId, year, month };
    if (status) params.status = status;
    const response = await api.get('/monthly-attendance-summary', { params });
    const data = response.data?.data ?? [];
    const total = response.data?.pagination?.total ?? (Array.isArray(data) ? data.length : 0);
    return { data: Array.isArray(data) ? data : [], total };
  },

  getMonthLock: async (
    organizationId: string,
    year: number,
    month: number
  ): Promise<MonthlyAttendanceLock | null> => {
    const response = await api.get('/monthly-attendance-summary/lock', {
      params: { organizationId, year, month },
    });
    return response.data.data ?? null;
  },

  lockMonth: async (
    organizationId: string,
    year: number,
    month: number,
    remarks?: string
  ): Promise<MonthlyAttendanceLock> => {
    const response = await api.post('/monthly-attendance-summary/lock-month', {
      organizationId,
      year,
      month,
      remarks,
    });
    return response.data.data;
  },

  unlockMonth: async (
    organizationId: string,
    year: number,
    month: number,
    remarks?: string
  ): Promise<void> => {
    await api.post('/monthly-attendance-summary/unlock-month', {
      organizationId,
      year,
      month,
      remarks,
    });
  },
};

export default attendanceLockService;
