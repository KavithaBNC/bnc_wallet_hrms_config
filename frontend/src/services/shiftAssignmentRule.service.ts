import api from './api';

export interface ShiftAssignmentRule {
  id: string;
  organizationId: string;
  displayName: string;
  shiftId: string;
  paygroupId: string | null;
  departmentId: string | null;
  effectiveDate: string;
  priority: number | null;
  remarks: string | null;
  employeeIds: string[] | null;
  createdAt: string;
  updatedAt: string;
  shift?: { id: string; name: string; code?: string | null };
  paygroup?: { id: string; name: string; code?: string | null } | null;
  department?: { id: string; name: string; code?: string | null } | null;
}

export interface ShiftAssignmentRuleListParams {
  organizationId: string;
  page?: number;
  limit?: number;
  search?: string;
  remarksMarker?: string; // Filter by specific marker in remarks to identify sub-module type
  excludeAttendancePolicyRules?: boolean; // Exclude rules from attendance policy sub-modules (Holiday, Comp Off, OT, Week Off, Late & Others)
}

export interface ShiftAssignmentRuleListResponse {
  rules: ShiftAssignmentRule[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const shiftAssignmentRuleService = {
  getAll: async (params: ShiftAssignmentRuleListParams): Promise<ShiftAssignmentRuleListResponse> => {
    const { data } = await api.get<{ data: ShiftAssignmentRuleListResponse }>('/shift-assignment-rules', {
      params: {
        organizationId: params.organizationId,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        search: params.search || undefined,
        remarksMarker: params.remarksMarker || undefined,
        excludeAttendancePolicyRules: params.excludeAttendancePolicyRules ? 'true' : undefined,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<ShiftAssignmentRule> => {
    const { data } = await api.get<{ data: { rule: ShiftAssignmentRule } }>(`/shift-assignment-rules/${id}`);
    return data.data.rule;
  },

  create: async (body: {
    organizationId: string;
    displayName: string;
    shiftId: string;
    paygroupId?: string;
    departmentId?: string;
    effectiveDate: string;
    priority?: number;
    remarks?: string;
    employeeIds?: string[];
  }): Promise<ShiftAssignmentRule> => {
    const { data } = await api.post<{ data: { rule: ShiftAssignmentRule } }>('/shift-assignment-rules', body);
    return data.data.rule;
  },

  update: async (
    id: string,
    body: Partial<{
      displayName: string;
      shiftId: string;
      paygroupId: string;
      departmentId: string;
      effectiveDate: string;
      priority: number;
      remarks: string;
      employeeIds: string[];
    }>
  ): Promise<ShiftAssignmentRule> => {
    const { data } = await api.put<{ data: { rule: ShiftAssignmentRule } }>(`/shift-assignment-rules/${id}`, body);
    return data.data.rule;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/shift-assignment-rules/${id}`);
  },
};

export default shiftAssignmentRuleService;
