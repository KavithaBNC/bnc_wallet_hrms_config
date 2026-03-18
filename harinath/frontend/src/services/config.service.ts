import api from './api';

export interface ApprovalLevelOption {
  id: string;
  name: string;
  workflowType: string;
}

export interface WorkflowApprovalOptions {
  hierarchyTypes: { id: string; name: string }[];
  approvalLevelTypes: ApprovalLevelOption[];
}

export interface WorkflowApprovalOptionsParams {
  organizationId?: string;
  /** For Leave workflows: only Manager, HR, Org Admin, Super Admin (no Employee Approval) */
  forLeave?: boolean;
  /** @deprecated Use forLeave */
  excludeEmployeeApproval?: boolean;
}

const configService = {
  getWorkflowApprovalOptions: async (
    params?: WorkflowApprovalOptionsParams
  ): Promise<WorkflowApprovalOptions> => {
    const { data } = await api.get<{ data: WorkflowApprovalOptions }>('/config/workflow-approval-options', {
      params: {
        ...(params?.organizationId ? { organizationId: params.organizationId } : {}),
        ...((params?.forLeave ?? params?.excludeEmployeeApproval) ? { forLeave: 'true' } : {}),
      },
    });
    return data.data;
  },
};

export default configService;
