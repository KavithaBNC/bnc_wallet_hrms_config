import { Request, Response } from 'express';
import { ConfigService } from '../services/config.service';

const configService = new ConfigService();

export class ConfigController {
  /**
   * GET /config/workflow-approval-options
   * Query: organizationId (optional) - when provided, merges org's ApprovalWorkflows into approvalLevelTypes
   */
  async getWorkflowApprovalOptions(req: Request, res: Response) {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      const forLeave = req.query.forLeave === 'true' || req.query.excludeEmployeeApproval === 'true';
      const result = await configService.getWorkflowApprovalOptions(organizationId, { forLeave });

      return res.status(200).json({
        message: 'Workflow approval options retrieved successfully',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve workflow approval options';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }
}
