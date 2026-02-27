import { Request, Response } from 'express';
import { WorkflowMappingService } from '../services/workflow-mapping.service';
import { resolveWorkflowForEmployee } from '../services/workflow-resolution.service';
import { getFirstApprover } from '../services/approval-routing.service';
import { parseApprovalLevels } from '../services/approval-routing.service';

const workflowMappingService = new WorkflowMappingService();

export class WorkflowMappingController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId || req.query.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }

      const workflowMapping = await workflowMappingService.create({
        organizationId,
        displayName: req.body.displayName,
        associate: req.body.associate,
        associateIds: req.body.associateIds,
        paygroupId: req.body.paygroupId,
        paygroupIds: req.body.paygroupIds,
        departmentId: req.body.departmentId,
        departmentIds: req.body.departmentIds,
        priority: req.body.priority,
        remarks: req.body.remarks,
        entryRightsTemplate: req.body.entryRightsTemplate,
        approvalLevels: req.body.approvalLevels,
      });

      return res.status(201).json({
        message: 'Workflow mapping created successfully',
        data: { workflowMapping },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create workflow mapping';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }

      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;
      const workflowType = req.query.workflowType ? String(req.query.workflowType) : undefined;

      const result = await workflowMappingService.getAll({
        organizationId,
        page: page?.toString(),
        limit: limit?.toString(),
        search,
        workflowType,
      });

      return res.status(200).json({
        message: 'Workflow mappings retrieved successfully',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve workflow mappings';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  /**
   * Resolve workflow for an employee (rule-based match).
   * GET /workflow-mappings/resolve?employeeId=xxx
   */
  async resolve(req: Request, res: Response) {
    try {
      const employeeId = req.query.employeeId as string | undefined;
      const organizationId = req.query.organizationId as string | undefined;
      if (!employeeId || !organizationId) {
        return res.status(400).json({ message: 'employeeId and organizationId are required' });
      }

      const workflow = await resolveWorkflowForEmployee(employeeId, organizationId);
      const approvalLevels = parseApprovalLevels(workflow.approvalLevels);
      const firstApproverId = await getFirstApprover(
        employeeId,
        organizationId,
        approvalLevels
      );

      return res.status(200).json({
        message: 'Workflow resolved successfully',
        data: {
          workflow,
          firstApproverEmployeeId: firstApproverId,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to resolve workflow';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const workflowMapping = await workflowMappingService.getById(req.params.id);

      return res.status(200).json({
        message: 'Workflow mapping retrieved successfully',
        data: { workflowMapping },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve workflow mapping';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const workflowMapping = await workflowMappingService.update(req.params.id, {
        displayName: req.body.displayName,
        associate: req.body.associate,
        associateIds: req.body.associateIds,
        paygroupId: req.body.paygroupId,
        paygroupIds: req.body.paygroupIds,
        departmentId: req.body.departmentId,
        departmentIds: req.body.departmentIds,
        priority: req.body.priority,
        remarks: req.body.remarks,
        entryRightsTemplate: req.body.entryRightsTemplate,
        approvalLevels: req.body.approvalLevels,
      });

      return res.status(200).json({
        message: 'Workflow mapping updated successfully',
        data: { workflowMapping },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update workflow mapping';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await workflowMappingService.delete(req.params.id);

      return res.status(200).json({
        message: 'Workflow mapping deleted successfully',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete workflow mapping';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }
}
