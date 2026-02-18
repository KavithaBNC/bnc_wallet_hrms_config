import api from './api';

export interface ValidationRuleLimit {
  id: string;
  validationProcessRuleId: string;
  periodicity: string;
  maxMinutes: number | null;
  count: number | null;
  applyAfterEveryCount: boolean;
  deductPriority: string | null;
  sortOrder: number;
}

export interface ValidationProcessAction {
  id: string;
  validationProcessRuleId: string;
  name: string;
  sortOrder: number;
  condition: string;
  correctionMethod: string;
  attendanceComponentId: string | null;
  autoApply: string;
  dayType: string;
  days: string;
  daysValue: string | number | null;
  attendanceComponent?: { id: string; eventName: string; shortName: string } | null;
}

export interface ValidationProcessRule {
  id: string;
  organizationId: string;
  displayName: string;
  effectiveDate: string;
  priority: number | null;
  remarks: string | null;
  autoCorrect: boolean;
  correctAfterDays: string | number | null;
  primaryAction: boolean;
  hasLimit: boolean;
  validationGrouping: string | null;
  employeeIds: string[] | null;
  shiftIds: string[] | null;
  paygroupIds: string[] | null;
  departmentIds: string[] | null;
  createdAt: string;
  updatedAt: string;
  limits: ValidationRuleLimit[];
  actions: ValidationProcessAction[];
}

export interface ValidationProcessRuleListParams {
  organizationId: string;
  page?: number;
  limit?: number;
  search?: string;
  validationGrouping?: string;
  effectiveOn?: string;
}

export interface ValidationProcessRuleListResponse {
  rules: ValidationProcessRule[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateValidationProcessRuleInput {
  organizationId: string;
  displayName: string;
  effectiveDate: string;
  priority?: number | string;
  remarks?: string;
  autoCorrect?: boolean;
  correctAfterDays?: string;
  primaryAction?: boolean;
  hasLimit?: boolean;
  validationGrouping?: string;
  employeeIds?: string[];
  shiftIds?: string[];
  paygroupIds?: string[];
  departmentIds?: string[];
  limits?: {
    periodicity: string;
    maxMinutes?: string | number;
    count?: string | number;
    applyAfterEveryCount?: boolean;
    deductPriority?: string;
  }[];
  actions?: {
    name: string;
    condition: string;
    correctionMethod: string;
    attendanceComponentId?: string;
    autoApply: string;
    dayType: string;
    days: string;
    daysValue?: string;
  }[];
}

const validationProcessRuleService = {
  getAll: async (params: ValidationProcessRuleListParams): Promise<ValidationProcessRuleListResponse> => {
    const { data } = await api.get<{ data: ValidationProcessRuleListResponse }>('/validation-process-rules', {
      params: {
        organizationId: params.organizationId,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        search: params.search || undefined,
        validationGrouping: params.validationGrouping || undefined,
        effectiveOn: params.effectiveOn || undefined,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<ValidationProcessRule> => {
    const { data } = await api.get<{ data: { rule: ValidationProcessRule } }>(`/validation-process-rules/${id}`);
    return data.data.rule;
  },

  create: async (body: CreateValidationProcessRuleInput): Promise<ValidationProcessRule> => {
    const payload = {
      ...body,
      limits: body.limits?.map((l) => ({
        ...l,
        maxMinutes: l.maxMinutes != null && l.maxMinutes !== '' ? Number(l.maxMinutes) : null,
        count: l.count != null && l.count !== '' ? Number(l.count) : null,
      })),
      actions: body.actions?.map((a) => ({
        ...a,
        attendanceComponentId: a.attendanceComponentId || null,
      })),
    };
    const { data } = await api.post<{ data: { rule: ValidationProcessRule } }>(
      '/validation-process-rules',
      payload
    );
    return data.data.rule;
  },

  update: async (
    id: string,
    body: Partial<CreateValidationProcessRuleInput>
  ): Promise<ValidationProcessRule> => {
    const payload = {
      ...body,
      limits: body.limits?.map((l) => ({
        ...l,
        maxMinutes: l.maxMinutes != null && l.maxMinutes !== '' ? Number(l.maxMinutes) : null,
        count: l.count != null && l.count !== '' ? Number(l.count) : null,
      })),
      actions: body.actions?.map((a) => ({
        ...a,
        attendanceComponentId: a.attendanceComponentId || null,
      })),
    };
    const { data } = await api.put<{ data: { rule: ValidationProcessRule } }>(
      `/validation-process-rules/${id}`,
      payload
    );
    return data.data.rule;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/validation-process-rules/${id}`);
  },
};

export default validationProcessRuleService;
