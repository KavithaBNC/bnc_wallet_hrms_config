import api from './api';

export interface ApprovalLevel {
  id: string;
  level: number;
  levelName: string;
  associate: string;
  hierarchy: string;
  paygroup: string;
  department: string;
  approvalLevel: string;
}

export interface WorkflowMapping {
  id: string;
  organizationId: string;
  displayName: string;
  associate: string | null;
  associateIds?: string[] | null;
  paygroupId: string | null;
  paygroupIds?: string[] | null;
  departmentId: string | null;
  departmentIds?: string[] | null;
  priority: number | null;
  remarks: string | null;
  entryRightsTemplate: string | null;
  approvalLevels: ApprovalLevel[] | null;
  createdAt: string;
  updatedAt: string;
  paygroup?: {
    id: string;
    name: string;
  } | null;
  department?: {
    id: string;
    name: string;
  } | null;
}

export interface WorkflowMappingListParams {
  organizationId: string;
  page?: number;
  limit?: number;
  search?: string;
  workflowType?: string;
}

export interface WorkflowMappingListResponse {
  items: WorkflowMapping[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateWorkflowMappingInput {
  organizationId: string;
  displayName: string;
  associate?: string;
  associateIds?: string[] | null;
  paygroupId?: string;
  paygroupIds?: string[] | null;
  departmentId?: string;
  departmentIds?: string[] | null;
  priority?: number;
  remarks?: string;
  entryRightsTemplate?: string;
  approvalLevels?: ApprovalLevel[];
}

const workflowMappingService = {
  getAll: async (params: WorkflowMappingListParams): Promise<WorkflowMappingListResponse> => {
    const { data } = await api.get<{ data: WorkflowMappingListResponse }>('/workflow-mappings', {
      params: {
        organizationId: params.organizationId,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        search: params.search || undefined,
        workflowType: params.workflowType || undefined,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<WorkflowMapping> => {
    const { data } = await api.get<{ data: { workflowMapping: WorkflowMapping } }>(`/workflow-mappings/${id}`);
    return data.data.workflowMapping;
  },

  create: async (body: CreateWorkflowMappingInput): Promise<WorkflowMapping> => {
    const { data } = await api.post<{ data: { workflowMapping: WorkflowMapping } }>('/workflow-mappings', body);
    return data.data.workflowMapping;
  },

  update: async (
    id: string,
    body: Partial<CreateWorkflowMappingInput>
  ): Promise<WorkflowMapping> => {
    const { data } = await api.put<{ data: { workflowMapping: WorkflowMapping } }>(`/workflow-mappings/${id}`, body);
    return data.data.workflowMapping;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/workflow-mappings/${id}`);
  },
};

export default workflowMappingService;
