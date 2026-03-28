import api from './api';

export interface LeaveType {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  description: string | null;
  isPaid: boolean;
  defaultDaysPerYear: number | null;
  maxCarryForward: number | null;
  maxConsecutiveDays: number | null;
  requiresDocument: boolean;
  requiresApproval: boolean;
  canBeNegative: boolean;
  accrualType: string | null;
  colorCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveTypeListResponse {
  leaveTypes: LeaveType[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateLeaveTypeInput {
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  isPaid?: boolean;
  defaultDaysPerYear?: number;
  maxCarryForward?: number;
  maxConsecutiveDays?: number;
  requiresDocument?: boolean;
  requiresApproval?: boolean;
  canBeNegative?: boolean;
  accrualType?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'NONE';
  colorCode?: string;
  isActive?: boolean;
}

const leaveTypeService = {
  getAll: async (params: {
    organizationId?: string;
    page?: number;
    limit?: number;
    isActive?: boolean;
  }): Promise<LeaveTypeListResponse> => {
    const { data } = await api.get<{ data: LeaveTypeListResponse }>('/leaves/types', {
      params: {
        organizationId: params.organizationId,
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        isActive: params.isActive,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<LeaveType> => {
    const { data } = await api.get<{ data: { leaveType: LeaveType } }>(`/leaves/types/${id}`);
    return data.data.leaveType;
  },

  create: async (body: CreateLeaveTypeInput): Promise<LeaveType> => {
    const { data } = await api.post<{ data: { leaveType: LeaveType } }>('/leaves/types', body);
    return data.data.leaveType;
  },

  update: async (id: string, body: Partial<CreateLeaveTypeInput>): Promise<LeaveType> => {
    const { data } = await api.put<{ data: { leaveType: LeaveType } }>(`/leaves/types/${id}`, body);
    return data.data.leaveType;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/leaves/types/${id}`);
  },
};

export default leaveTypeService;
