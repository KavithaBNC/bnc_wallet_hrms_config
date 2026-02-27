import api from './api';

export interface EncashmentCarryForward {
  id: string;
  organizationId: string;
  displayName: string;
  associateId: string | null;
  paygroupIds: string[] | null;
  departmentIds: string[] | null;
  remarks: string | null;
  maxEncashmentDays: number;
  isEncashmentApplicable: boolean;
  maxCarryForwardDays: number;
  isCarryForwardApplicable: boolean;
  eventType: string;
  createdAt: string;
  updatedAt: string;
  associate?: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    employeeCode: string;
  } | null;
}

export interface EncashmentCarryForwardListParams {
  organizationId: string;
  page?: number;
  limit?: number;
  search?: string;
  eventType?: string;
}

export interface EncashmentCarryForwardListResponse {
  items: EncashmentCarryForward[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateEncashmentCarryForwardInput {
  organizationId: string;
  displayName: string;
  associateId?: string;
  paygroupIds?: string[];
  departmentIds?: string[];
  remarks?: string;
  maxEncashmentDays?: number;
  isEncashmentApplicable?: boolean;
  maxCarryForwardDays?: number;
  isCarryForwardApplicable?: boolean;
  eventType: string;
}

const encashmentCarryForwardService = {
  getAll: async (params: EncashmentCarryForwardListParams): Promise<EncashmentCarryForwardListResponse> => {
    const { data } = await api.get<{ data: EncashmentCarryForwardListResponse }>('/encashment-carry-forwards', {
      params: {
        organizationId: params.organizationId,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        search: params.search || undefined,
        eventType: params.eventType || undefined,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<EncashmentCarryForward> => {
    const { data } = await api.get<{ data: { rule: EncashmentCarryForward } }>(`/encashment-carry-forwards/${id}`);
    return data.data.rule;
  },

  create: async (body: CreateEncashmentCarryForwardInput): Promise<EncashmentCarryForward> => {
    const { data } = await api.post<{ data: { rule: EncashmentCarryForward } }>('/encashment-carry-forwards', body);
    return data.data.rule;
  },

  update: async (
    id: string,
    body: Partial<CreateEncashmentCarryForwardInput>
  ): Promise<EncashmentCarryForward> => {
    const { data } = await api.put<{ data: { rule: EncashmentCarryForward } }>(`/encashment-carry-forwards/${id}`, body);
    return data.data.rule;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/encashment-carry-forwards/${id}`);
  },
};

export default encashmentCarryForwardService;
