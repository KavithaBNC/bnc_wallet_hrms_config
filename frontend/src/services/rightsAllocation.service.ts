import api from './api';

export interface RightsAllocation {
  id: string;
  organizationId: string;
  shortName: string;
  longName: string;
  remarks: string | null;
  shiftId: string | null;
  maxExcessTimeRequestDays: number;
  monthlyRegularizationCount: number | null;
  attendanceEvents: any | null;
  excessTimeEvents: any | null;
  requestTypeEvents: any | null;
  regularizationElements: any | null;
  createdAt: string;
  updatedAt: string;
  shift?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
}

export interface RightsAllocationListParams {
  organizationId: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface RightsAllocationListResponse {
  items: RightsAllocation[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateRightsAllocationInput {
  organizationId: string;
  shortName: string;
  longName: string;
  remarks?: string;
  shiftId?: string;
  maxExcessTimeRequestDays?: number;
  monthlyRegularizationCount?: number;
  attendanceEvents?: any;
  excessTimeEvents?: any;
  requestTypeEvents?: any;
  regularizationElements?: any;
}

const rightsAllocationService = {
  getAll: async (params: RightsAllocationListParams): Promise<RightsAllocationListResponse> => {
    const { data } = await api.get<{ data: RightsAllocationListResponse }>('/rights-allocations', {
      params: {
        organizationId: params.organizationId,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        search: params.search || undefined,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<RightsAllocation> => {
    const { data } = await api.get<{ data: { rightsAllocation: RightsAllocation } }>(`/rights-allocations/${id}`);
    return data.data.rightsAllocation;
  },

  create: async (body: CreateRightsAllocationInput): Promise<RightsAllocation> => {
    const { data } = await api.post<{ data: { rightsAllocation: RightsAllocation } }>('/rights-allocations', body);
    return data.data.rightsAllocation;
  },

  update: async (
    id: string,
    body: Partial<CreateRightsAllocationInput>
  ): Promise<RightsAllocation> => {
    const { data } = await api.put<{ data: { rightsAllocation: RightsAllocation } }>(`/rights-allocations/${id}`, body);
    return data.data.rightsAllocation;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/rights-allocations/${id}`);
  },
};

export default rightsAllocationService;
