import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { employeeChangeRequestService } from '../services/employee-change-request.service';
import { userHasPermission } from '../utils/permission-cache';

export class EmployeeChangeRequestController {
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.rbac?.organizationId ?? req.body?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ status: 'fail', message: 'Organization context required.' });
      }
      const { employeeId, existingData, requestedData } = req.body;
      if (!employeeId || !existingData || !requestedData) {
        return res.status(400).json({
          status: 'fail',
          message: 'employeeId, existingData and requestedData are required.',
        });
      }
      // Users without employee edit permission can only submit change request for their own record
      const canEditEmployees = userHasPermission(req.user!.userId, '/employees', 'can_edit');
      if (!canEditEmployees) {
        const myEmployee = await prisma.employee.findUnique({
          where: { userId: req.user!.userId },
          select: { id: true },
        });
        if (!myEmployee || myEmployee.id !== employeeId) {
          return res.status(403).json({
            status: 'fail',
            message: 'You can only submit changes for your own profile.',
          });
        }
      }
      const request = await employeeChangeRequestService.submit({
        employeeId,
        submittedById: req.user!.userId,
        organizationId,
        existingData,
        requestedData,
      });
      return res.status(201).json({
        status: 'success',
        message: 'Changes submitted for approval.',
        data: { request },
      });
    } catch (error) {
      return next(error);
    }
  }

  async listPending(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.rbac?.organizationId ?? null;
      const list = await employeeChangeRequestService.listPending(organizationId);
      return res.status(200).json({ status: 'success', data: { list } });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.rbac?.organizationId ?? undefined;
      const request = await employeeChangeRequestService.getById(id, organizationId);
      return res.status(200).json({ status: 'success', data: { request } });
    } catch (error) {
      return next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.rbac?.organizationId ?? undefined;
      const request = await employeeChangeRequestService.approve(
        id,
        req.user!.userId,
        organizationId
      );
      return res.status(200).json({
        status: 'success',
        message: 'Changes approved and saved to employee record.',
        data: { request },
      });
    } catch (error) {
      return next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body || {};
      const organizationId = req.rbac?.organizationId ?? undefined;
      const request = await employeeChangeRequestService.reject(
        id,
        rejectionReason,
        organizationId
      );
      return res.status(200).json({
        status: 'success',
        message: 'Changes rejected.',
        data: { request },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const employeeChangeRequestController = new EmployeeChangeRequestController();
