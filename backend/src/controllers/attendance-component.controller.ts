import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { attendanceComponentService } from '../services/attendance-component.service';
import { getLeaveComponentToLeaveTypeMapping } from '../utils/event-config';

const prisma = new PrismaClient();

export class AttendanceComponentController {
  /**
   * Create new attendance component
   * POST /api/v1/attendance-components
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const component = await attendanceComponentService.create(req.body);

      return res.status(201).json({
        status: 'success',
        message: 'Attendance component created successfully',
        data: { component },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all attendance components
   * GET /api/v1/attendance-components
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, page, limit, search } = req.query;
      
      const result = await attendanceComponentService.getAll({
        organizationId: organizationId as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get mapping of Leave attendance component id -> leave type id for apply-event UI.
   * GET /api/v1/attendance-components/leave-type-mapping?organizationId=...
   */
  async getLeaveTypeMapping(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.query.organizationId as string;
      if (!organizationId) {
        return res.status(400).json({ status: 'error', message: 'organizationId is required' });
      }
      const mapping = await getLeaveComponentToLeaveTypeMapping(organizationId);
      return res.status(200).json({
        status: 'success',
        data: { mapping },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get Leave-category components that are not linked to any Leave Type.
   * GET /api/v1/attendance-components/unmapped-leave-components?organizationId=...
   */
  async getUnmappedLeaveComponents(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.query.organizationId as string;
      if (!organizationId) {
        return res.status(400).json({ status: 'error', message: 'organizationId is required' });
      }
      const [components, leaveTypes] = await Promise.all([
        prisma.attendanceComponent.findMany({
          where: { organizationId, eventCategory: 'Leave' },
          select: { id: true, shortName: true, eventName: true },
          orderBy: [{ shortName: 'asc' }],
        }),
        prisma.leaveType.findMany({
          where: { organizationId, isActive: true },
          select: { id: true, name: true, code: true },
        }),
      ]);
      const nameKey = (s: string | null) => (s ?? '').toLowerCase().trim();
      const unmapped = components.filter((c) => {
        const en = nameKey(c.eventName);
        const sn = nameKey(c.shortName);
        const matched = leaveTypes.find(
          (lt) =>
            (en && (nameKey(lt.name) === en || nameKey(lt.code) === en)) ||
            (sn && (nameKey(lt.code) === sn || nameKey(lt.name) === sn))
        );
        return !matched;
      });
      return res.status(200).json({
        status: 'success',
        data: { unmapped },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get attendance component by ID
   * GET /api/v1/attendance-components/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const component = await attendanceComponentService.getById(id);

      return res.status(200).json({
        status: 'success',
        data: { component },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update attendance component
   * PUT /api/v1/attendance-components/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const component = await attendanceComponentService.update(id, req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Attendance component updated successfully',
        data: { component },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete attendance component
   * DELETE /api/v1/attendance-components/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await attendanceComponentService.delete(id);

      return res.status(200).json({
        status: 'success',
        message: 'Attendance component deleted successfully',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const attendanceComponentController = new AttendanceComponentController();
