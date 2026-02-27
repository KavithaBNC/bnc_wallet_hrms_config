import api from './api';

export interface Shift {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  description: string | null;
  startTime: string;
  endTime: string;
  firstHalfEnd?: string | null;
  secondHalfStart?: string | null;
  punchInTime?: string | null;
  punchOutTime?: string | null;
  flexiType?: string | null;
  breakDuration: number | null;
  workHours: number | string | null;
  isFlexible: boolean;
  gracePeriod: number | null;
  earlyLeaveAllowed: boolean;
  overtimeEnabled: boolean;
  overtimeThreshold: number | string | null;
  geofenceEnabled: boolean;
  geofenceRadius: number | string | null;
  geofenceLocation: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
  };
}

export interface ShiftListParams {
  organizationId: string;
  search?: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
}

export interface ShiftListResponse {
  shifts: Shift[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const shiftService = {
  getAll: async (params: ShiftListParams): Promise<ShiftListResponse> => {
    const { data } = await api.get<{ data: ShiftListResponse }>('/shifts', {
      params: {
        organizationId: params.organizationId,
        search: params.search || undefined,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        isActive: params.isActive,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<Shift> => {
    const { data } = await api.get<{ data?: { shift: Shift }; shift?: Shift }>(`/shifts/${id}`);
    return data.data?.shift ?? (data as unknown as { shift: Shift }).shift;
  },

  create: async (body: {
    organizationId: string;
    name: string;
    code?: string;
    description?: string;
    startTime: string;
    endTime: string;
    firstHalfEnd?: string;
    secondHalfStart?: string;
    punchInTime?: string;
    punchOutTime?: string;
    flexiType?: string;
    breakDuration?: number;
    workHours?: number;
    isFlexible?: boolean;
    gracePeriod?: number;
    earlyLeaveAllowed?: boolean;
    overtimeEnabled?: boolean;
    overtimeThreshold?: number;
    geofenceEnabled?: boolean;
    geofenceRadius?: number;
    geofenceLocation?: unknown;
    isActive?: boolean;
  }): Promise<Shift> => {
    const { data } = await api.post<{ data?: { shift: Shift }; shift?: Shift }>('/shifts', body);
    return data.data?.shift ?? (data as unknown as { shift: Shift }).shift;
  },

  update: async (
    id: string,
    body: Partial<{
      name: string;
      code: string;
      description: string;
      startTime: string;
      endTime: string;
      firstHalfEnd: string;
      secondHalfStart: string;
      punchInTime: string;
      punchOutTime: string;
      flexiType: string;
      breakDuration: number;
      workHours: number;
      isFlexible: boolean;
      gracePeriod: number;
      earlyLeaveAllowed: boolean;
      overtimeEnabled: boolean;
      overtimeThreshold: number;
      geofenceEnabled: boolean;
      geofenceRadius: number;
      geofenceLocation: unknown;
      isActive: boolean;
    }>
  ): Promise<Shift> => {
    const { data } = await api.put<{ data?: { shift: Shift }; shift?: Shift }>(`/shifts/${id}`, body);
    return data.data?.shift ?? (data as unknown as { shift: Shift }).shift;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/shifts/${id}`);
  },
};

export default shiftService;
