import api from './api';

export interface AutoCreditSetting {
  id: string;
  organizationId: string;
  eventType: string;
  displayName: string;
  associate: string | null;
  associateIds?: string[] | null;
  paygroupId: string | null;
  paygroupIds?: string[] | null;
  departmentId: string | null;
  departmentIds?: string[] | null;
  condition: string | null;
  effectiveDate: string;
  effectiveTo?: string | null;
  priority: number;
  remarks?: string | null;
  autoCreditRule?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  paygroup?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
}

export interface AutoCreditSettingListParams {
  organizationId: string;
  eventType?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface AutoCreditSettingListResponse {
  items: AutoCreditSetting[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const autoCreditSettingService = {
  getAll: async (params: AutoCreditSettingListParams): Promise<AutoCreditSettingListResponse> => {
    const { data } = await api.get<{ data: AutoCreditSettingListResponse }>('/auto-credit-settings', {
      params: {
        organizationId: params.organizationId,
        eventType: params.eventType || undefined,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        search: params.search || undefined,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<AutoCreditSetting> => {
    const { data } = await api.get<{ data: { autoCreditSetting: AutoCreditSetting } }>(`/auto-credit-settings/${id}`);
    return data.data.autoCreditSetting;
  },

  create: async (body: Omit<AutoCreditSetting, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutoCreditSetting> => {
    const { data } = await api.post<{ data: { autoCreditSetting: AutoCreditSetting } }>('/auto-credit-settings', body);
    return data.data.autoCreditSetting;
  },

  update: async (id: string, body: Partial<AutoCreditSetting>): Promise<AutoCreditSetting> => {
    const { data } = await api.put<{ data: { autoCreditSetting: AutoCreditSetting } }>(`/auto-credit-settings/${id}`, body);
    return data.data.autoCreditSetting;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/auto-credit-settings/${id}`);
  },
};

export default autoCreditSettingService;
