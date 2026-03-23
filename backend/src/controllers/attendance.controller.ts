import { Request, Response, NextFunction } from 'express';
import { CompOffRequestStatus, Prisma } from '@prisma/client';
import { attendanceService } from '../services/attendance.service';
import { biometricSyncService } from '../services/biometric-sync.service';
import { compOffRequestService } from '../services/comp-off-request.service';
import { matchFace } from '../services/face.service';
import { prisma } from '../utils/prisma';
import { userHasPermission } from '../utils/permission-cache';
import { BulkShiftAssignmentsInput } from '../utils/attendance.validation';

export class AttendanceController {
  /**
   * Check-in
   * POST /api/v1/attendance/check-in
   */
  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required',
        });
      }

      // Get employee ID
      const employee = await prisma.employee.findUnique({
        where: { userId },
      });

      if (!employee) {
        return res.status(404).json({
          status: 'fail',
          message: 'Employee profile not found',
        });
      }

      const attendance = await attendanceService.checkIn(employee.id, req.body);

      return res.status(201).json({
        status: 'success',
        message: 'Checked in successfully',
        data: { attendance },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Check-out
   * POST /api/v1/attendance/check-out
   */
  async checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required',
        });
      }

      // Get employee ID
      const employee = await prisma.employee.findUnique({
        where: { userId },
      });

      if (!employee) {
        return res.status(404).json({
          status: 'fail',
          message: 'Employee profile not found',
        });
      }

      const attendance = await attendanceService.checkOut(employee.id, req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Checked out successfully',
        data: { attendance },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get attendance records
   * GET /api/v1/attendance/records
   */
  async getRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const result = await attendanceService.getRecords(req.query as any, userId, userRole);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all punches in a date range (for calendar – show every IN/OUT).
   * GET /api/v1/attendance/punches?startDate=yyyy-MM-dd&endDate=yyyy-MM-dd&employeeId= (optional)
   * RBAC: EMPLOYEE gets own; HR/Manager can pass employeeId for selected employee.
   */
  async getPunches(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const { startDate, endDate, employeeId: queryEmployeeId } = req.query as {
        startDate: string;
        endDate: string;
        employeeId?: string;
      };

      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'fail',
          message: 'startDate and endDate are required',
        });
      }

      const employee = userId
        ? await prisma.employee.findUnique({
            where: { userId },
            select: { id: true, organizationId: true, reportingManagerId: true },
          })
        : null;

      let employeeId: string | undefined;
      if (queryEmployeeId) {
        const canEdit = userId ? userHasPermission(userId, '/attendance', 'can_edit') : false;
        const canView = userId ? userHasPermission(userId, '/attendance', 'can_view') : false;
        if (canEdit) {
          employeeId = queryEmployeeId; // org-wide access
        } else if (canView && employee) {
          // team-level: verify the target is a direct report
          const sub = await prisma.employee.findFirst({
            where: { id: queryEmployeeId, reportingManagerId: employee.id },
            select: { id: true },
          });
          if (sub) employeeId = queryEmployeeId;
        } else {
          employeeId = employee?.id; // own only
        }
      }
      if (!employeeId && employee) employeeId = employee.id;
      if (!employeeId) {
        return res.status(400).json({
          status: 'fail',
          message: 'Could not resolve employee for punches',
        });
      }

      const punches = await attendanceService.getPunchesInRange(employeeId, startDate, endDate);
      return res.status(200).json({
        status: 'success',
        data: {
          punches: punches.map((p) => ({
            id: p.id,
            employeeId: p.employeeId,
            punchTime: p.punchTime.toISOString(),
            status: p.status,
            punchSource: p.punchSource,
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get total work hours for an employee for a specific day (from IN/OUT punches).
   * GET /api/v1/attendance/summary/:employeeId/work-hours?date=YYYY-MM-DD
   * Pairs each IN with the next OUT; if last punch is IN, counts time until now.
   */
  async getWorkHoursForDay(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params;
      const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);

      const punches = await attendanceService.getPunchesForDay(employeeId, date);
      const asOf = new Date();
      const result = await attendanceService.calculateWorkHoursFromPunches(employeeId, date, asOf);

      return res.status(200).json({
        status: 'success',
        data: {
          employeeId,
          date: dateStr,
          totalWorkHours: Math.round(result.totalWorkHours * 100) / 100,
          pairs: result.pairs.map((p) => ({
            in: p.in.toISOString(),
            out: p.out.toISOString(),
            hours: Math.round(p.hours * 100) / 100,
          })),
          lastPunchStatus: result.lastPunchStatus,
          punches: punches.map((p) => ({
            id: p.id,
            punchTime: p.punchTime.toISOString(),
            status: p.status,
            punchSource: p.punchSource,
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get attendance summary
   * GET /api/v1/attendance/summary/:employeeId
   */
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'fail',
          message: 'startDate and endDate are required',
        });
      }

      const result = await attendanceService.getSummary({
        employeeId,
        startDate: startDate as string,
        endDate: endDate as string,
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
   * Get comp off excess-time summary for logged-in employee.
   * GET /api/v1/attendance/comp-off/summary
   */
  async getCompOffSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentication required' });
      }

      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, organizationId: true, reportingManagerId: true },
      });
      if (!employee) {
        return res.status(404).json({ status: 'fail', message: 'Employee profile not found' });
      }

      const queryOrgId = (req.query.organizationId as string | undefined) || employee.organizationId;
      if (queryOrgId !== employee.organizationId) {
        return res.status(403).json({ status: 'fail', message: 'Organization mismatch' });
      }
      const queryCompanyId = req.query.companyId as string | undefined;
      if (queryCompanyId) {
        const company = await prisma.company.findUnique({
          where: { id: queryCompanyId },
          select: { id: true, organizationId: true },
        });
        if (!company || company.organizationId !== employee.organizationId) {
          return res.status(403).json({ status: 'fail', message: 'Company mismatch' });
        }
      }

      const queryEmployeeId = req.query.employeeId as string | undefined;
      let targetEmployeeId = employee.id;

      if (queryEmployeeId && queryEmployeeId !== employee.id) {
        const canEdit = userHasPermission(userId, '/attendance', 'can_edit');
        const canView = userHasPermission(userId, '/attendance', 'can_view');
        if (canEdit) {
          const targetEmployee = await prisma.employee.findUnique({
            where: { id: queryEmployeeId },
            select: { id: true, organizationId: true },
          });
          if (!targetEmployee || targetEmployee.organizationId !== employee.organizationId) {
            return res.status(403).json({ status: 'fail', message: 'Employee organization mismatch' });
          }
          targetEmployeeId = queryEmployeeId;
        } else if (canView) {
          const subordinate = await prisma.employee.findFirst({
            where: { id: queryEmployeeId, reportingManagerId: employee.id },
            select: { id: true },
          });
          if (!subordinate) {
            return res.status(403).json({ status: 'fail', message: 'Access denied for selected employee' });
          }
          targetEmployeeId = queryEmployeeId;
        } else {
          // own only
          targetEmployeeId = employee.id;
        }
      }

      const summary = await compOffRequestService.getSummary(targetEmployeeId, queryOrgId);
      return res.status(200).json({
        status: 'success',
        data: { summary },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getCompOffRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentication required' });
      }
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, organizationId: true, reportingManagerId: true },
      });
      if (!employee) {
        return res.status(404).json({ status: 'fail', message: 'Employee profile not found' });
      }

      const organizationId = (req.query.organizationId as string | undefined) || employee.organizationId;
      if (organizationId !== employee.organizationId) {
        return res.status(403).json({ status: 'fail', message: 'Organization mismatch' });
      }

      const canEdit = userHasPermission(userId, '/attendance', 'can_edit');
      const canView = userHasPermission(userId, '/attendance', 'can_view');

      const queryEmployeeId = req.query.employeeId as string | undefined;
      let targetEmployeeId: string | undefined = undefined;
      if (queryEmployeeId && queryEmployeeId !== employee.id) {
        if (canEdit) {
          const target = await prisma.employee.findUnique({
            where: { id: queryEmployeeId },
            select: { id: true, organizationId: true },
          });
          if (!target || target.organizationId !== employee.organizationId) {
            return res.status(403).json({ status: 'fail', message: 'Employee organization mismatch' });
          }
          targetEmployeeId = queryEmployeeId;
        } else if (canView) {
          const subordinate = await prisma.employee.findFirst({
            where: { id: queryEmployeeId, reportingManagerId: employee.id },
            select: { id: true },
          });
          if (!subordinate) {
            return res.status(403).json({ status: 'fail', message: 'Access denied for selected employee' });
          }
          targetEmployeeId = queryEmployeeId;
        }
      } else if (queryEmployeeId === employee.id) {
        targetEmployeeId = employee.id;
      } else if (!canEdit && !canView) {
        // own only: user has neither org-wide nor team-level access
        targetEmployeeId = employee.id;
      }

      const status = req.query.status as CompOffRequestStatus | undefined;
      const result = await compOffRequestService.listRequests(employee.id, organizationId, {
        status,
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
        targetEmployeeId,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        userId,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getCompOffRequestDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentication required' });
      }
      const requester = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, organizationId: true },
      });
      if (!requester) {
        return res.status(404).json({ status: 'fail', message: 'Employee profile not found' });
      }
      const organizationId = (req.query.organizationId as string | undefined) || requester.organizationId;
      if (organizationId !== requester.organizationId) {
        return res.status(403).json({ status: 'fail', message: 'Organization mismatch' });
      }
      const data = await compOffRequestService.getRequestDetails(
        req.params.id,
        organizationId,
        requester.id,
        userRole,
        userId
      );
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create comp off request for logged-in employee.
   * POST /api/v1/attendance/comp-off/requests
   */
  async createCompOffRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentication required' });
      }

      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, organizationId: true },
      });
      if (!employee) {
        return res.status(404).json({ status: 'fail', message: 'Employee profile not found' });
      }

      const bodyOrgId = (req.body.organizationId as string | undefined) || employee.organizationId;
      if (bodyOrgId !== employee.organizationId) {
        return res.status(403).json({ status: 'fail', message: 'Organization mismatch' });
      }
      const bodyCompanyId = req.body.companyId as string | undefined;
      if (bodyCompanyId) {
        const company = await prisma.company.findUnique({
          where: { id: bodyCompanyId },
          select: { id: true, organizationId: true },
        });
        if (!company || company.organizationId !== employee.organizationId) {
          return res.status(403).json({ status: 'fail', message: 'Company mismatch' });
        }
      }

      const request = await compOffRequestService.createRequest(employee.id, bodyOrgId, {
        requestType: req.body.requestType,
        reason: req.body.reason,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Comp Off request submitted successfully',
        data: { request },
      });
    } catch (error) {
      return next(error);
    }
  }

  async convertCompOffRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentication required' });
      }
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, organizationId: true },
      });
      if (!employee) {
        return res.status(404).json({ status: 'fail', message: 'Employee profile not found' });
      }
      const organizationId = (req.body.organizationId as string | undefined) || employee.organizationId;
      if (organizationId !== employee.organizationId) {
        return res.status(403).json({ status: 'fail', message: 'Organization mismatch' });
      }

      const queryEmployeeId = req.body.employeeId as string | undefined;
      let targetEmployeeId = employee.id;
      if (queryEmployeeId && queryEmployeeId !== employee.id) {
        const canEdit = userHasPermission(userId, '/attendance', 'can_edit');
        const canView = userHasPermission(userId, '/attendance', 'can_view');
        if (canEdit) {
          const targetEmployee = await prisma.employee.findUnique({
            where: { id: queryEmployeeId },
            select: { id: true, organizationId: true },
          });
          if (!targetEmployee || targetEmployee.organizationId !== employee.organizationId) {
            return res.status(403).json({ status: 'fail', message: 'Employee organization mismatch' });
          }
          targetEmployeeId = queryEmployeeId;
        } else if (canView) {
          const subordinate = await prisma.employee.findFirst({
            where: { id: queryEmployeeId, reportingManagerId: employee.id },
            select: { id: true },
          });
          if (!subordinate) {
            return res.status(403).json({ status: 'fail', message: 'Access denied for selected employee' });
          }
          targetEmployeeId = queryEmployeeId;
        }
      }

      const result = await compOffRequestService.createAutoConversionRequest(targetEmployeeId, organizationId, {
        reason: req.body.reason,
      });
      return res.status(201).json({
        status: 'success',
        message: 'Excess Time request submitted for conversion approval',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Approve comp off request.
   * PUT /api/v1/attendance/comp-off/requests/:id/approve
   */
  async approveCompOffRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentication required' });
      }

      const request = await compOffRequestService.approveRequest(
        req.params.id,
        userId,
        req.body.reviewComments,
        req.user?.role
      );

      return res.status(200).json({
        status: 'success',
        message: 'Comp Off request approved successfully',
        data: { request },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Reject comp off request.
   * PUT /api/v1/attendance/comp-off/requests/:id/reject
   */
  async rejectCompOffRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentication required' });
      }

      const request = await compOffRequestService.rejectRequest(
        req.params.id,
        userId,
        req.body.reviewComments,
        req.user?.role
      );

      return res.status(200).json({
        status: 'success',
        message: 'Comp Off request rejected',
        data: { request },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get attendance report
   * GET /api/v1/attendance/reports
   */
  async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, startDate, endDate, departmentId, employeeId } = req.query;

      if (!organizationId || !startDate || !endDate) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId, startDate, and endDate are required',
        });
      }

      const result = await attendanceService.getReport({
        organizationId: organizationId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        departmentId: departmentId as string | undefined,
        employeeId: employeeId as string | undefined,
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
   * Sync biometric (eSSL) attendance
   * POST /api/v1/attendance/sync/biometric
   */
  async syncBiometric(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, fromDate, toDate } = req.body as {
        organizationId: string;
        fromDate: string;
        toDate: string;
      };

      const result = await biometricSyncService.syncBiometricFromEssl(
        organizationId,
        fromDate,
        toDate
      );

      return res.status(200).json({
        status: 'success',
        message: 'Biometric sync completed',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Face punch: receive base64 image, match against employees with face_encoding, insert attendance_logs + record.
   * POST /api/v1/attendance/face-punch
   */
  async facePunch(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentication required' });
      }
      const { image_base64: imageBase64 } = req.body as { image_base64?: string };
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({
          status: 'fail',
          message: 'image_base64 is required (base64 string)',
        });
      }
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { employee: { select: { organizationId: true } } },
      });
      const organizationId =
        (req.body as { organizationId?: string }).organizationId ||
        currentUser?.employee?.organizationId;
      if (!organizationId) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId required (or user must belong to an organization)',
        });
      }
      const employeesWithFace = await prisma.employee.findMany({
        where: {
          organizationId,
          deletedAt: null,
          employeeStatus: 'ACTIVE',
          faceEncoding: { not: Prisma.JsonNull },
        },
        select: { id: true, employeeCode: true, faceEncoding: true },
      });
      if (employeesWithFace.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'No employees with face encoding in this organization',
        });
      }
      const storedEncodings = employeesWithFace
        .filter((e) => e.faceEncoding && Array.isArray(e.faceEncoding))
        .map((e) => ({
          employee_id: e.id,
          encoding: e.faceEncoding as number[],
        }));
      if (storedEncodings.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'No valid face encodings found',
        });
      }
      const matchResult = await matchFace(imageBase64, storedEncodings);
      if (matchResult.error) {
        return res.status(400).json({
          status: 'fail',
          message: matchResult.error,
        });
      }
      if (!matchResult.match || !matchResult.matched_employee_id) {
        return res.status(404).json({
          status: 'fail',
          message: 'Employee not registered',
          data: { distance: matchResult.distance },
        });
      }
      const employee = await prisma.employee.findUnique({
        where: { id: matchResult.matched_employee_id },
        select: { id: true, employeeCode: true },
      });
      if (!employee) {
        return res.status(500).json({ status: 'fail', message: 'Employee not found' });
      }

      const result = await attendanceService.processAttendancePunch(employee.id, 'FACE');

      return res.status(200).json({
        status: 'success',
        message: 'Face punch recorded',
        data: {
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          status: result.punch.status,
          punchTime: result.punch.punchTime.toISOString(),
          distance: matchResult.distance,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Manual punch: Admin/HR records IN/OUT for an employee at a given date/time.
   * POST /api/v1/attendance/manual
   */
  async manualPunch(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, date, time, punchAt } = req.body as { employeeId: string; date: string; time: string; punchAt?: string };
      const result = await attendanceService.processAttendancePunch(employeeId, 'MANUAL', date, time, punchAt);
      return res.status(201).json({
        status: 'success',
        message: 'Manual punch recorded',
        data: {
          employeeId,
          status: result.punch.status,
          punchTime: result.punch.punchTime.toISOString(),
          punchSource: 'MANUAL',
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Card punch: Biometric/kiosk records IN/OUT for an employee (current time).
   * POST /api/v1/attendance/card
   */
  async cardPunch(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.body as { employeeId: string };
      const result = await attendanceService.processAttendancePunch(employeeId, 'CARD');
      return res.status(201).json({
        status: 'success',
        message: 'Card punch recorded',
        data: {
          employeeId,
          status: result.punch.status,
          punchTime: result.punch.punchTime.toISOString(),
          punchSource: 'CARD',
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get monthly details for calendar sidebar (short fall, leave/onduty/permission/present from attendance components, late, early going).
   * GET /api/v1/attendance/monthly-details?organizationId=&employeeId=&year=&month=
   */
  async getMonthlyDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.query.organizationId as string;
      const employeeId = req.query.employeeId as string;
      const year = parseInt(req.query.year as string, 10);
      const month = parseInt(req.query.month as string, 10);
      if (!organizationId || !employeeId || !year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId, employeeId, year, and month (1-12) are required',
        });
      }
      const data = await attendanceService.getMonthlyDetails(organizationId, employeeId, year, month);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get validation process calendar summary from stored results.
   * GET /api/v1/attendance/validation-process/calendar-summary
   */
  async getValidationProcessCalendarSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, paygroupId, employeeId, fromDate, toDate } = req.query as {
        organizationId: string;
        paygroupId?: string | null;
        employeeId?: string | null;
        fromDate: string;
        toDate: string;
      };
      if (!organizationId || !fromDate || !toDate) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId, fromDate, and toDate are required',
        });
      }
      const result = await attendanceService.getValidationProcessCalendarSummary({
        organizationId,
        paygroupId: paygroupId ?? undefined,
        employeeId: employeeId ?? undefined,
        fromDate,
        toDate,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Run validation process: process attendance, store in validation_results, return aggregated.
   * POST /api/v1/attendance/validation-process/run
   */
  async runValidationProcess(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, paygroupId, employeeId, fromDate, toDate } = req.body as {
        organizationId: string;
        paygroupId?: string | null;
        employeeId?: string | null;
        fromDate: string;
        toDate: string;
      };
      if (!organizationId || !fromDate || !toDate) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId, fromDate, and toDate are required',
        });
      }
      const result = await attendanceService.runValidationProcess({
        organizationId,
        paygroupId: paygroupId ?? undefined,
        employeeId: employeeId ?? undefined,
        fromDate,
        toDate,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get aggregated late deductions per employee for a date range.
   * POST /api/v1/attendance/validation-process/late-deductions
   */
  async getValidationLateDeductions(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, paygroupId, employeeId, fromDate, toDate } = req.body as {
        organizationId: string;
        paygroupId?: string | null;
        employeeId?: string | null;
        fromDate: string;
        toDate: string;
      };
      if (!organizationId || !fromDate || !toDate) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId, fromDate, and toDate are required',
        });
      }
      const result = await attendanceService.getValidationLateDeductions({
        organizationId,
        paygroupId: paygroupId ?? undefined,
        employeeId: employeeId ?? undefined,
        fromDate,
        toDate,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get validation process employee list by type and date range.
   * GET /api/v1/attendance/validation-process/employee-list
   */
  async getValidationProcessEmployeeList(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, fromDate, toDate, type, paygroupId, employeeId } = req.query as {
        organizationId: string;
        fromDate: string;
        toDate: string;
        type: string;
        paygroupId?: string;
        employeeId?: string;
      };
      const result = await attendanceService.getValidationProcessEmployeeList({
        organizationId,
        fromDate,
        toDate,
        type,
        paygroupId: paygroupId || undefined,
        employeeId: employeeId || undefined,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Apply validation correction (leave deduction) for selected employees.
   * POST /api/v1/attendance/validation-process/apply-correction
   */
  async applyValidationCorrection(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, ruleId, directComponentId, type, selectedRows, remarks } = req.body as {
        organizationId: string;
        ruleId?: string;
        directComponentId?: string;
        type?: 'late' | 'earlyGoing' | 'noOutPunch' | 'shortfall' | 'absent' | 'approvalPending' | 'overtime' | 'shiftChange';
        selectedRows: { employeeId: string; date: string }[];
        remarks?: string;
      };
      const approverUserId = (req as any).user?.userId as string | undefined;
      const result = await attendanceService.applyValidationCorrection({
        organizationId,
        ruleId,
        directComponentId,
        type: type || 'late',
        selectedRows,
        remarks,
        approverUserId,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Revert validation correction for a date range.
   * POST /api/v1/attendance/validation-process/revert
   */
  async revertValidationCorrection(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, paygroupId, employeeId, fromDate, toDate, remarks } = req.body as {
        organizationId: string;
        paygroupId?: string | null;
        employeeId?: string | null;
        fromDate: string;
        toDate: string;
        remarks?: string;
      };
      const revertedByUserId = (req as any).user?.userId as string | undefined;
      const result = await attendanceService.revertValidationCorrection({
        organizationId,
        paygroupId,
        employeeId,
        fromDate,
        toDate,
        remarks,
        revertedByUserId,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Clear all validation results for a date range.
   * POST /api/v1/attendance/validation-process/clear
   */
  async clearValidationResults(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, paygroupId, employeeId, fromDate, toDate } = req.body as {
        organizationId: string;
        paygroupId?: string | null;
        employeeId?: string | null;
        fromDate: string;
        toDate: string;
      };
      const result = await attendanceService.clearValidationResults({
        organizationId,
        paygroupId,
        employeeId,
        fromDate,
        toDate,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get validation revert history.
   * GET /api/v1/attendance/validation-process/revert-history
   */
  async getValidationRevertHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, page, limit } = req.query as {
        organizationId: string;
        page?: string;
        limit?: string;
      };
      const result = await attendanceService.getValidationRevertHistory({
        organizationId,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get completed validation list for the Revert Process page.
   * GET /api/v1/attendance/validation-process/completed-list
   */
  async getCompletedList(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, fromDate, toDate, paygroupId, search, page, limit } = req.query as {
        organizationId: string;
        fromDate: string;
        toDate: string;
        paygroupId?: string;
        search?: string;
        page?: string;
        limit?: string;
      };
      const result = await attendanceService.getCompletedList({
        organizationId,
        fromDate,
        toDate,
        paygroupId,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Revert validation corrections for specific rows.
   * POST /api/v1/attendance/validation-process/revert-rows
   */
  async revertByRows(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, selectedRows, remarks } = req.body as {
        organizationId: string;
        selectedRows: { employeeId: string; date: string }[];
        remarks?: string;
      };
      const revertedByUserId = (req as any).user?.userId as string | undefined;
      const result = await attendanceService.revertByRows({
        organizationId,
        selectedRows,
        remarks,
        revertedByUserId,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Put selected validation rows on hold.
   * POST /api/v1/attendance/validation-process/on-hold
   */
  async putOnHold(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, selectedRows, holdAssociateCanModify, holdManagerCanModify, revertRegularization, reason } = req.body as {
        organizationId: string;
        selectedRows: { employeeId: string; date: string }[];
        holdAssociateCanModify?: boolean;
        holdManagerCanModify?: boolean;
        revertRegularization?: boolean;
        reason?: string;
      };
      const result = await attendanceService.putOnHold({
        organizationId,
        selectedRows,
        holdAssociateCanModify,
        holdManagerCanModify,
        revertRegularization,
        reason,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Release selected rows from hold.
   * POST /api/v1/attendance/validation-process/release-hold
   */
  async releaseHold(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, selectedRows } = req.body as {
        organizationId: string;
        selectedRows: { employeeId: string; date: string }[];
      };
      const result = await attendanceService.releaseHold({ organizationId, selectedRows });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Bulk update shift assignments
   * POST /api/v1/attendance/shift-assignments/bulk
   */
  async bulkUpdateShiftAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, assignments } = req.body as BulkShiftAssignmentsInput;

      const results = await attendanceService.bulkUpdateShiftAssignments(
        organizationId,
        assignments
      );

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;

      return res.status(200).json({
        status: 'success',
        message: `Shift assignments updated: ${successCount} successful, ${skippedCount} skipped, ${errorCount} errors`,
        data: {
          results,
          summary: {
            total: results.length,
            successful: successCount,
            skipped: skippedCount,
            errors: errorCount,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const attendanceController = new AttendanceController();
