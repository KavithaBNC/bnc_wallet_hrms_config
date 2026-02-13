import { prisma } from '../utils/prisma';

/** Default hierarchy types for workflow approval levels */
const DEFAULT_HIERARCHY_TYPES = [
  { id: 'reporting_manager', name: 'Reporting Manager' },
  { id: 'department_head', name: 'Department Head' },
  { id: 'hr_manager', name: 'HR Manager' },
];

/** For Leave workflows: only these approval types are allowed (no Employee Approval) */
const LEAVE_ALLOWED_WORKFLOW_TYPES = ['Manager', 'HR', 'Org Admin', 'Super Admin'];

export class ConfigService {
  /**
   * Get workflow approval options for Approval Levels table:
   * - hierarchyTypes: static defaults for hierarchy dropdown
   * - approvalLevelTypes: dynamic from organization's Approval Workflows
   * - forLeave: when true, only return Manager/HR/Org Admin/Super Admin (used in Leave Workflow Mapping)
   * - excludeEmployeeApproval: deprecated in favor of forLeave; when true, same as forLeave for backward compat
   */
  async getWorkflowApprovalOptions(
    organizationId?: string,
    options?: { excludeEmployeeApproval?: boolean; forLeave?: boolean }
  ) {
    const hierarchyTypes = [...DEFAULT_HIERARCHY_TYPES];

    let approvalLevelTypes: { id: string; name: string; workflowType: string }[] = [];

    if (organizationId) {
      const forLeave = options?.forLeave ?? options?.excludeEmployeeApproval ?? false;
      const where: { organizationId: string; workflowType?: { in: string[] } } = { organizationId };
      if (forLeave) {
        where.workflowType = { in: LEAVE_ALLOWED_WORKFLOW_TYPES };
      }
      const workflows = await prisma.approvalWorkflow.findMany({
        where,
        select: { id: true, shortName: true, longName: true, workflowType: true },
        orderBy: [{ workflowType: 'asc' }, { shortName: 'asc' }],
      });
      approvalLevelTypes = workflows.map((w) => ({
        id: w.id,
        name: w.shortName || w.longName || w.id,
        workflowType: w.workflowType,
      }));
    }

    return {
      hierarchyTypes,
      approvalLevelTypes,
    };
  }
}
