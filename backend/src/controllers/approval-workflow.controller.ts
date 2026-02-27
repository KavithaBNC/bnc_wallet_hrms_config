import { Request, Response } from 'express';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';

const approvalWorkflowService = new ApprovalWorkflowService();

export class ApprovalWorkflowController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId || req.query.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }

      const approvalWorkflow = await approvalWorkflowService.create({
        organizationId,
        workflowType: req.body.workflowType,
        shortName: req.body.shortName,
        longName: req.body.longName,
        remarks: req.body.remarks,
        attendanceEvents: req.body.attendanceEvents,
        excessTimeEvents: req.body.excessTimeEvents,
        requestTypeEvents: req.body.requestTypeEvents,
        validationGroupEvents: req.body.validationGroupEvents,
      });

      return res.status(201).json({
        message: 'Approval workflow created successfully',
        data: { approvalWorkflow },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create approval workflow';
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

      const result = await approvalWorkflowService.getAll({
        organizationId,
        workflowType,
        page: page?.toString(),
        limit: limit?.toString(),
        search,
      });

      return res.status(200).json({
        message: 'Approval workflows retrieved successfully',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve approval workflows';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const approvalWorkflow = await approvalWorkflowService.getById(req.params.id);

      return res.status(200).json({
        message: 'Approval workflow retrieved successfully',
        data: { approvalWorkflow },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve approval workflow';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const approvalWorkflow = await approvalWorkflowService.update(req.params.id, {
        workflowType: req.body.workflowType,
        shortName: req.body.shortName,
        longName: req.body.longName,
        remarks: req.body.remarks,
        attendanceEvents: req.body.attendanceEvents,
        excessTimeEvents: req.body.excessTimeEvents,
        requestTypeEvents: req.body.requestTypeEvents,
        validationGroupEvents: req.body.validationGroupEvents,
      });

      return res.status(200).json({
        message: 'Approval workflow updated successfully',
        data: { approvalWorkflow },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update approval workflow';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await approvalWorkflowService.delete(req.params.id);

      return res.status(200).json({
        message: 'Approval workflow deleted successfully',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete approval workflow';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }
}
