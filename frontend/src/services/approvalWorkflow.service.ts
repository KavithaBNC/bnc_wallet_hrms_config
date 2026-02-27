import api from './api';

export interface ApprovalWorkflow {
  id: string;
  organizationId: string;
  workflowType: string;
  shortName: string;
  longName: string;
  remarks: string | null;
  attendanceEvents: any | null;
  excessTimeEvents: any | null;
  requestTypeEvents: any | null;
  validationGroupEvents: any | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalWorkflowListParams {
  organizationId: string;
  workflowType?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ApprovalWorkflowListResponse {
  items: ApprovalWorkflow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateApprovalWorkflowInput {
  organizationId: string;
  workflowType: string;
  shortName: string;
  longName: string;
  remarks?: string;
  attendanceEvents?: any;
  excessTimeEvents?: any;
  requestTypeEvents?: any;
  validationGroupEvents?: any;
}

const approvalWorkflowService = {
  getAll: async (params: ApprovalWorkflowListParams): Promise<ApprovalWorkflowListResponse> => {
    const { data } = await api.get<{ data: ApprovalWorkflowListResponse }>('/approval-workflows', {
      params: {
        organizationId: params.organizationId,
        workflowType: params.workflowType || undefined,
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        search: params.search || undefined,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<ApprovalWorkflow> => {
    const { data } = await api.get<{ data: { approvalWorkflow: ApprovalWorkflow } }>(`/approval-workflows/${id}`);
    return data.data.approvalWorkflow;
  },

  create: async (body: CreateApprovalWorkflowInput): Promise<ApprovalWorkflow> => {
    const { data } = await api.post<{ data: { approvalWorkflow: ApprovalWorkflow } }>('/approval-workflows', body);
    return data.data.approvalWorkflow;
  },

  update: async (
    id: string,
    body: Partial<CreateApprovalWorkflowInput>
  ): Promise<ApprovalWorkflow> => {
    const { data } = await api.put<{ data: { approvalWorkflow: ApprovalWorkflow } }>(`/approval-workflows/${id}`, body);
    return data.data.approvalWorkflow;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/approval-workflows/${id}`);
  },
};

export default approvalWorkflowService;
