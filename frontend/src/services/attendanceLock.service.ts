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

const attendanceLockService = {
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
};

export default attendanceLockService;
