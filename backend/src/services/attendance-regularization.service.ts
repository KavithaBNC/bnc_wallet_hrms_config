
import { AppError } from '../middlewares/errorHandler';
import { RegularizationStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { userHasPermission } from '../utils/permission-cache';
import { getDataScope } from '../utils/data-scope';
import {
  CreateRegularizationInput,
  ApproveRegularizationInput,
  RejectRegularizationInput,
} from '../utils/attendance.validation';

export class AttendanceRegularizationService {
  /**
   * Create regularization request
   */
  async create(employeeId: string, data: CreateRegularizationInput) {
    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0);

    // Check if regularization already exists for this date
    const existing = await prisma.attendanceRegularization.findFirst({
      where: {
        employeeId,
        date,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (existing) {
      throw new AppError('You already have a pending or approved regularization for this date', 400);
    }

    // Find or create attendance record
    let attendanceRecord = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date,
        },
      },
    });

    if (!attendanceRecord) {
      // Create attendance record if it doesn't exist
      attendanceRecord = await prisma.attendanceRecord.create({
        data: {
          employeeId,
          date,
          status: 'ABSENT',
        },
      });
    }

    // Parse requested times
    const requestedCheckIn = data.checkIn ? new Date(data.checkIn) : null;
    const requestedCheckOut = data.checkOut ? new Date(data.checkOut) : null;

    // Validate requested times are on the same date
    if (requestedCheckIn) {
      const checkInDate = new Date(requestedCheckIn);
      checkInDate.setHours(0, 0, 0, 0);
      if (checkInDate.getTime() !== date.getTime()) {
        throw new AppError('Requested check-in time must be on the same date', 400);
      }
    }

    if (requestedCheckOut) {
      const checkOutDate = new Date(requestedCheckOut);
      checkOutDate.setHours(0, 0, 0, 0);
      if (checkOutDate.getTime() !== date.getTime()) {
        throw new AppError('Requested check-out time must be on the same date', 400);
      }
    }

    // Validate check-out is after check-in
    if (requestedCheckIn && requestedCheckOut && requestedCheckOut <= requestedCheckIn) {
      throw new AppError('Check-out time must be after check-in time', 400);
    }

    const regularization = await prisma.attendanceRegularization.create({
      data: {
        employeeId,
        attendanceRecordId: attendanceRecord.id,
        date,
        requestedCheckIn,
        requestedCheckOut,
        reason: data.reason,
        supportingDocuments: data.supportingDocuments || undefined,
        status: RegularizationStatus.PENDING,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
        attendanceRecord: {
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            status: true,
          },
        },
      },
    });

    return regularization;
  }

  /**
   * Get all regularization requests
   * @param query - Query parameters
   * @param userId - User ID for role-based filtering
   * @param userRole - User role for RBAC filtering
   */
  async getAll(query: {
    employeeId?: string;
    status?: RegularizationStatus;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
    organizationId?: string;
  }, userId?: string, _userRole?: string) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceRegularizationWhereInput = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    } else if (userId) {
      // Get employee record
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, reportingManagerId: true, organizationId: true },
      });

      if (employee) {
        // Dynamic RBAC scoping via Config API permissions
        const scope = getDataScope(userId!, '/attendance');
        if (scope === 'org') {
          // can_edit on /attendance → org-wide access (HR/OrgAdmin level)
          if (query.organizationId || employee.organizationId) {
            where.employee = {
              organizationId: query.organizationId || employee.organizationId,
            };
          }
        } else if (scope === 'team') {
          // can_view on /attendance → team access (Manager level)
          where.employee = {
            reportingManagerId: employee.id,
            organizationId: query.organizationId || employee.organizationId,
          };
        } else {
          // No special permission → self-service only (Employee level)
          where.employeeId = employee.id;
        }
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.date.lte = new Date(query.endDate);
      }
    }

    const [regularizations, total] = await Promise.all([
      prisma.attendanceRegularization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appliedOn: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeCode: true,
            },
          },
          attendanceRecord: {
            select: {
              id: true,
              checkIn: true,
              checkOut: true,
              status: true,
            },
          },
        },
      }),
      prisma.attendanceRegularization.count({ where }),
    ]);

    return {
      regularizations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get regularization by ID
   */
  async getById(id: string) {
    const regularization = await prisma.attendanceRegularization.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
        attendanceRecord: {
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            status: true,
            workHours: true,
          },
        },
      },
    });

    if (!regularization) {
      throw new AppError('Regularization request not found', 404);
    }

    return regularization;
  }

  /**
   * Approve regularization
   * @param id - Regularization request ID
   * @param reviewerId - User ID of the reviewer
   * @param data - Approval data
   * @param reviewerRole - Role of the reviewer (for RBAC validation)
   */
  async approve(id: string, reviewerId: string, data: ApproveRegularizationInput, _reviewerRole?: string) {
    const regularization = await prisma.attendanceRegularization.findUnique({
      where: { id },
      include: {
        attendanceRecord: true,
        employee: {
          select: {
            id: true,
            reportingManagerId: true,
            organizationId: true,
          },
        },
      },
    });

    if (!regularization) {
      throw new AppError('Regularization request not found', 404);
    }

    if (regularization.status !== RegularizationStatus.PENDING) {
      throw new AppError(
        `Cannot approve regularization. Current status: ${regularization.status}`,
        400
      );
    }

    // RBAC: Users without org-wide edit access can only approve requests from their team
    if (!userHasPermission(reviewerId, '/attendance', 'can_edit')) {
      const reviewerEmployee = await prisma.employee.findUnique({
        where: { userId: reviewerId },
        select: { id: true },
      });

      if (!reviewerEmployee) {
        throw new AppError('Reviewer employee record not found', 404);
      }

      // Verify the regularization request is from an employee who reports to this reviewer
      if (regularization.employee.reportingManagerId !== reviewerEmployee.id) {
        throw new AppError(
          'Access denied. You can only approve regularization requests from employees in your team.',
          403
        );
      }
    }

    // Update regularization status
    const updated = await prisma.attendanceRegularization.update({
      where: { id },
      data: {
        status: RegularizationStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComments: data.reviewComments || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        attendanceRecord: true,
      },
    });

    // Update attendance record with requested times
    if (regularization.attendanceRecord) {
      const updateData: any = {
        approvedBy: reviewerId,
        approvedAt: new Date(),
      };

      if (regularization.requestedCheckIn) {
        updateData.checkIn = regularization.requestedCheckIn;
      }

      if (regularization.requestedCheckOut) {
        updateData.checkOut = regularization.requestedCheckOut;
      }

      // Recalculate work hours if both times are provided
      if (regularization.requestedCheckIn && regularization.requestedCheckOut) {
        const diffMs = regularization.requestedCheckOut.getTime() - regularization.requestedCheckIn.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        updateData.workHours = new Prisma.Decimal(Math.max(0, diffHours));
        updateData.status = 'PRESENT';
      }

      await prisma.attendanceRecord.update({
        where: { id: regularization.attendanceRecord.id },
        data: updateData,
      });
    }

    return updated;
  }

  /**
   * Reject regularization
   * @param id - Regularization request ID
   * @param reviewerId - User ID of the reviewer
   * @param data - Rejection data
   * @param reviewerRole - Role of the reviewer (for RBAC validation)
   */
  async reject(id: string, reviewerId: string, data: RejectRegularizationInput, _reviewerRole?: string) {
    const regularization = await prisma.attendanceRegularization.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            reportingManagerId: true,
            organizationId: true,
          },
        },
      },
    });

    if (!regularization) {
      throw new AppError('Regularization request not found', 404);
    }

    if (regularization.status !== RegularizationStatus.PENDING) {
      throw new AppError(
        `Cannot reject regularization. Current status: ${regularization.status}`,
        400
      );
    }

    // RBAC: Users without org-wide edit access can only reject requests from their team
    if (!userHasPermission(reviewerId, '/attendance', 'can_edit')) {
      const reviewerEmployee = await prisma.employee.findUnique({
        where: { userId: reviewerId },
        select: { id: true },
      });

      if (!reviewerEmployee) {
        throw new AppError('Reviewer employee record not found', 404);
      }

      // Verify the regularization request is from an employee who reports to this reviewer
      if (regularization.employee.reportingManagerId !== reviewerEmployee.id) {
        throw new AppError(
          'Access denied. You can only reject regularization requests from employees in your team.',
          403
        );
      }
    }

    const updated = await prisma.attendanceRegularization.update({
      where: { id },
      data: {
        status: RegularizationStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComments: data.reviewComments,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        attendanceRecord: {
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            status: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Cancel regularization (by employee)
   */
  async cancel(id: string, employeeId: string) {
    const regularization = await prisma.attendanceRegularization.findUnique({
      where: { id },
    });

    if (!regularization) {
      throw new AppError('Regularization request not found', 404);
    }

    if (regularization.employeeId !== employeeId) {
      throw new AppError('You can only cancel your own regularization requests', 403);
    }

    if (regularization.status !== RegularizationStatus.PENDING) {
      throw new AppError(
        `Cannot cancel regularization. Current status: ${regularization.status}`,
        400
      );
    }

    const updated = await prisma.attendanceRegularization.update({
      where: { id },
      data: {
        status: RegularizationStatus.CANCELLED,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        attendanceRecord: {
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            status: true,
          },
        },
      },
    });

    return updated;
  }
}

export const attendanceRegularizationService = new AttendanceRegularizationService();
