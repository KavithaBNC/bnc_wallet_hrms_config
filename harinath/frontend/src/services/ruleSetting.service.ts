import api from './api';

export interface RuleSetting {
  id: string;
  organizationId: string;
  eventId?: string | null;
  eventType: string;
  displayName: string;
  associate: string | null;
  associateIds?: string[] | null;
  paygroupId: string | null;
  departmentId: string | null;
  priority: number;
  remarks?: string | null;
  eventRuleDefinition?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  attendanceComponent?: { id: string; shortName: string; eventName: string } | null;
  paygroup?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
}

export interface RuleSettingListParams {
  organizationId: string;
  eventId?: string;
  eventType?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface RuleSettingListResponse {
  items: RuleSetting[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const ruleSettingService = {
  getAll: async (params: RuleSettingListParams): Promise<RuleSettingListResponse> => {
    const { data } = await api.get<{ data: RuleSettingListResponse }>('/rule-settings', {
      params: {
        organizationId: params.organizationId,
        eventId: params.eventId || undefined,
        eventType: params.eventType || undefined,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        search: params.search || undefined,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<RuleSetting> => {
    const { data } = await api.get<{ data: { ruleSetting: RuleSetting } }>(`/rule-settings/${id}`);
    return data.data.ruleSetting;
  },

  create: async (body: Omit<RuleSetting, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleSetting> => {
    const { data } = await api.post<{ data: { ruleSetting: RuleSetting } }>('/rule-settings', body);
    return data.data.ruleSetting;
  },

  update: async (id: string, body: Partial<RuleSetting>): Promise<RuleSetting> => {
    const { data } = await api.put<{ data: { ruleSetting: RuleSetting } }>(`/rule-settings/${id}`, body);
    return data.data.ruleSetting;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/rule-settings/${id}`);
  },
};

export default ruleSettingService;
