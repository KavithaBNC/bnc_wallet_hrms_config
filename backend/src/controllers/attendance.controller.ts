import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { attendanceService } from '../services/attendance.service';
import { biometricSyncService } from '../services/biometric-sync.service';
import { matchFace } from '../services/face.service';
import { prisma } from '../utils/prisma';
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
      const userRole = req.user?.role;
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
        if (userRole === 'EMPLOYEE') employeeId = employee?.id; // EMPLOYEE can only see own
        else if (userRole === 'MANAGER' && employee) {
          const sub = await prisma.employee.findFirst({
            where: { id: queryEmployeeId, reportingManagerId: employee.id },
            select: { id: true },
          });
          if (sub) employeeId = queryEmployeeId;
        } else if (userRole === 'HR_MANAGER' || userRole === 'ORG_ADMIN' || userRole === 'SUPER_ADMIN') {
          employeeId = queryEmployeeId;
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
