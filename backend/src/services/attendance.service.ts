
import { AppError } from '../middlewares/errorHandler';
import { AttendanceStatus, CheckInMethod, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { shiftService } from './shift.service';
import { shiftAssignmentRuleService } from './shift-assignment-rule.service';
import {
  CheckInInput,
  CheckOutInput,
  QueryAttendanceRecordsInput,
  QueryAttendanceSummaryInput,
  QueryAttendanceReportInput,
} from '../utils/attendance.validation';

export class AttendanceService {
  /**
   * Check if date is a weekend
   */
  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Check if date is a holiday
   */
  private async isHoliday(date: Date, organizationId: string): Promise<boolean> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const holiday = await prisma.holiday.findFirst({
      where: {
        organizationId,
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
    });

    return !!holiday;
  }

  /**
   * Calculate work hours
   */
  private calculateWorkHours(checkIn: Date, checkOut: Date, breakHours: number = 0): number {
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0, diffHours - breakHours);
  }

  /**
   * Get all punches for an employee on a given day (sorted by punch time).
   */
  async getPunchesForDay(employeeId: string, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return prisma.attendancePunch.findMany({
      where: {
        employeeId,
        punchTime: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { punchTime: 'asc' },
    });
  }

  /**
   * Universal Multi-Punch Engine: single logic for FACE, CARD, and MANUAL.
   * - Date: use manualDate + manualTime if provided, else now.
   * - Toggle: no punch → IN; last IN → OUT; last OUT → IN.
   * - Safety: for FACE/CARD, reject if last punch was within 2 minutes; skip for MANUAL.
   */
  async processAttendancePunch(
    employeeId: string,
    source: 'FACE' | 'CARD' | 'MANUAL',
    manualDate?: string,
    manualTime?: string,
    punchAtISO?: string
  ): Promise<{ punch: { id: string; punchTime: Date; status: string; punchSource: string }; dayStart: Date }> {
    let punchTimestamp: Date;
    if (punchAtISO) {
      // Frontend sends punchAt as ISO (built from user's local date+time) so 4:59 PM stays 4:59 PM
      punchTimestamp = new Date(punchAtISO);
    } else if (manualDate && manualTime) {
      // Fallback: manualDate = yyyy-MM-dd, manualTime = HH:mm or HH:mm:ss (treated as UTC for API-only callers)
      const [y, m, d] = manualDate.split('-').map(Number);
      const timeParts = manualTime.split(':').map(Number);
      const h = timeParts[0] ?? 0;
      const min = timeParts[1] ?? 0;
      const s = timeParts[2] ?? 0;
      punchTimestamp = new Date(Date.UTC(y, m - 1, d, h, min, s, 0));
    } else {
      punchTimestamp = new Date();
    }

    const dayStr = punchTimestamp.toISOString().slice(0, 10);
    const dayStart = new Date(dayStr + 'T00:00:00.000Z');
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const lastPunch = await prisma.attendancePunch.findFirst({
      where: {
        employeeId,
        punchTime: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { punchTime: 'desc' },
    });

    const DUPLICATE_PUNCH_WAIT_SECONDS = 120; // 2 minutes for FACE/CARD
    const lastPunchAgoMs = lastPunch ? punchTimestamp.getTime() - lastPunch.punchTime.getTime() : 0;
    if (source !== 'MANUAL' && lastPunch && lastPunchAgoMs < DUPLICATE_PUNCH_WAIT_SECONDS * 1000) {
      const retryAfter = Math.ceil((DUPLICATE_PUNCH_WAIT_SECONDS * 1000 - lastPunchAgoMs) / 1000);
      throw new AppError(
        `Duplicate punch detected. Please wait ${retryAfter} seconds between punches.`,
        400
      );
    }

    let newStatus: string;
    if (!lastPunch) {
      newStatus = 'IN';
    } else {
      const last = lastPunch.status?.toUpperCase() || '';
      newStatus = last === 'IN' ? 'OUT' : 'IN';
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeCode: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const punch = await prisma.attendancePunch.create({
      data: {
        employeeId,
        punchTime: punchTimestamp,
        status: newStatus,
        punchSource: source,
      },
    });

    await prisma.attendanceLog.create({
      data: {
        deviceId: null,
        userId: employee.employeeCode,
        punchTimestamp,
        status: newStatus === 'IN' ? '0' : '1',
        employeeId,
        punchSource: source,
      },
    });

    await this.syncAttendanceRecordFromPunches(employeeId, dayStart);

    return {
      punch: {
        id: punch.id,
        punchTime: punch.punchTime,
        status: punch.status,
        punchSource: punch.punchSource || source,
      },
      dayStart,
    };
  }

  /**
   * Get all punches for an employee in a date range (for calendar display of every IN/OUT).
   */
  async getPunchesInRange(employeeId: string, startDate: string, endDate: string) {
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');
    end.setUTCDate(end.getUTCDate() + 1);

    return prisma.attendancePunch.findMany({
      where: {
        employeeId,
        punchTime: { gte: start, lt: end },
      },
      orderBy: { punchTime: 'asc' },
    });
  }

  /**
   * Calculate total work hours from IN/OUT punch pairs for a day.
   */
  async calculateWorkHoursFromPunches(
    employeeId: string,
    date: Date,
    asOf?: Date
  ): Promise<{
    totalWorkHours: number;
    pairs: Array<{ in: Date; out: Date; hours: number }>;
    lastPunchStatus: 'IN' | 'OUT' | null;
  }> {
    const punches = await this.getPunchesForDay(employeeId, date);
    const pairs: Array<{ in: Date; out: Date; hours: number }> = [];
    let totalWorkHours = 0;
    let lastPunchStatus: 'IN' | 'OUT' | null = null;

    for (let i = 0; i < punches.length; i++) {
      const p = punches[i];
      const status = (p.status?.toUpperCase() === 'OUT' ? 'OUT' : 'IN') as 'IN' | 'OUT';
      lastPunchStatus = status;

      if (status === 'IN') {
        const nextOut = punches.slice(i + 1).find((x) => (x.status?.toUpperCase() || '') === 'OUT');
        const outTime = nextOut
          ? nextOut.punchTime
          : asOf
            ? new Date(asOf)
            : null;
        if (outTime) {
          const hours = (outTime.getTime() - p.punchTime.getTime()) / (1000 * 60 * 60);
          pairs.push({ in: p.punchTime, out: outTime, hours: Math.max(0, hours) });
          totalWorkHours += Math.max(0, hours);
        }
      }
    }

    return { totalWorkHours, pairs, lastPunchStatus };
  }

  /**
   * Sync attendance record for a day from punch data: first IN → checkIn,
   * last OUT → checkOut, total work hours from IN/OUT pairs.
   */
  async syncAttendanceRecordFromPunches(employeeId: string, date: Date) {
    const punches = await this.getPunchesForDay(employeeId, date);
    if (punches.length === 0) return null;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shift: true },
    });
    if (!employee) return null;

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const { totalWorkHours } = await this.calculateWorkHoursFromPunches(employeeId, date, new Date());

    const firstIn = punches.find((p) => (p.status?.toUpperCase() || '') === 'IN');
    const outPunches = punches.filter((p) => (p.status?.toUpperCase() || '') === 'OUT');
    const lastOut = outPunches.length > 0 ? outPunches[outPunches.length - 1].punchTime : null;

    let status: AttendanceStatus = AttendanceStatus.PRESENT;
    if (this.isWeekend(dayStart)) status = AttendanceStatus.WEEKEND;
    else if (await this.isHoliday(dayStart, employee.organizationId)) status = AttendanceStatus.HOLIDAY;

    return prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: { employeeId, date: dayStart },
      },
      create: {
        employeeId,
        shiftId: employee.shiftId || null,
        date: dayStart,
        checkIn: firstIn?.punchTime ?? null,
        checkOut: lastOut ?? null,
        workHours: new Prisma.Decimal(Math.round(totalWorkHours * 100) / 100),
        status,
      },
      update: {
        checkIn: firstIn?.punchTime ?? null,
        checkOut: lastOut ?? null,
        workHours: new Prisma.Decimal(Math.round(totalWorkHours * 100) / 100),
        status,
      },
    });
  }

  /**
   * Parse time string (HH:MM) to hours as decimal
   */
  private parseTimeToHours(timeStr: string): number {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0] || '0', 10);
    const minutes = parseInt(parts[1] || '0', 10);
    return hours + minutes / 60;
  }

  /**
   * Get shift start/end time with grace period
   */
  private getShiftTimeWithGrace(
    shiftTime: Date,
    graceTimeStr: string | undefined,
    isStart: boolean
  ): Date {
    if (!graceTimeStr) return shiftTime;
    const graceHours = this.parseTimeToHours(graceTimeStr);
    const graceMs = graceHours * 60 * 60 * 1000;
    return new Date(shiftTime.getTime() + (isStart ? graceMs : -graceMs));
  }

  /**
   * Check if check-in is late based on policy rules
   */
  private isLateCheckIn(
    checkInTime: Date,
    shiftStartTime: Date | null,
    policyRules: Record<string, any> | null
  ): boolean {
    if (!shiftStartTime || !policyRules) return false;
    if (!policyRules.considerLateFromGraceTime) return false;

    const graceTime = policyRules.shiftStartGraceTime || '00:00';
    const graceEndTime = this.getShiftTimeWithGrace(shiftStartTime, graceTime, true);
    return checkInTime > graceEndTime;
  }

  /**
   * Check if check-out is early based on policy rules
   */
  private isEarlyCheckOut(
    checkOutTime: Date,
    shiftEndTime: Date | null,
    policyRules: Record<string, any> | null
  ): boolean {
    if (!shiftEndTime || !policyRules) return false;
    if (!policyRules.considerEarlyGoingFromGraceTime) return false;

    const graceTime = policyRules.shiftEndGraceTime || '00:00';
    const graceStartTime = this.getShiftTimeWithGrace(shiftEndTime, graceTime, false);
    return checkOutTime < graceStartTime;
  }

  /**
   * Check-in with geofence validation and shift support
   */
  async checkIn(employeeId: string, data: CheckInInput) {
    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        shift: true,
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    if (existing && existing.checkIn) {
      throw new AppError('You have already checked in today', 400);
    }

    // Validate geofence if shift has geofencing enabled (optional - skip if not configured)
    if (employee.shift?.geofenceEnabled && data.location) {
      if (employee.shift.geofenceLocation && employee.shift.geofenceRadius) {
        const isValid = shiftService.validateGeofence(
          data.location as { latitude: number; longitude: number },
          employee.shift.geofenceLocation as { latitude: number; longitude: number },
          parseFloat(employee.shift.geofenceRadius.toString())
        );

        if (!isValid) {
          throw new AppError(
            `You are outside the allowed geofence area. Please check in from the designated location.`,
            400
          );
        }
      }
      // If geofence is enabled but not configured, skip validation (allow check-in)
    }

    const now = new Date();

    // Get policy rules for this shift if available
    let policyRules: Record<string, any> | null = null;
    if (employee.shiftId) {
      try {
        policyRules = await shiftAssignmentRuleService.getApplicablePolicyRules(
          employee.shiftId,
          employeeId,
          today,
          employee.organizationId
        );
      } catch (error) {
        // If policy rules fetch fails, continue without them
        console.warn('Failed to fetch policy rules:', error);
      }
    }

    // Determine status
    let status: AttendanceStatus = AttendanceStatus.PRESENT;
    if (this.isWeekend(today)) {
      status = AttendanceStatus.WEEKEND;
    } else if (await this.isHoliday(today, employee.organizationId)) {
      status = AttendanceStatus.HOLIDAY;
    } else if (employee.shift?.startTime && policyRules) {
      // Check if check-in is late based on policy rules
      const shiftStart = new Date(today);
      const [startHours, startMinutes] = (employee.shift.startTime as any).split(':').map(Number);
      shiftStart.setHours(startHours, startMinutes, 0, 0);
      
      if (this.isLateCheckIn(now, shiftStart, policyRules)) {
        // Late check-in - status remains PRESENT but can be tracked via notes or separate field
        // For now, we keep PRESENT status but could add a late flag if needed
      }
    }

    // Determine check-in method: explicit (e.g. FACE), or from location
    let checkInMethod: CheckInMethod =
      (data.checkInMethod as CheckInMethod) ?? CheckInMethod.WEB;
    if (checkInMethod === CheckInMethod.WEB && data.location) {
      checkInMethod = employee.shift?.geofenceEnabled ? CheckInMethod.GEOFENCE : CheckInMethod.MOBILE;
    }

    // Create or update attendance record
    const attendance = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      create: {
        employeeId,
        shiftId: employee.shiftId || null,
        date: today,
        checkIn: now,
        status,
        location: data.location || undefined,
        checkInMethod,
        notes: data.notes || null,
      },
      update: {
        checkIn: now,
        shiftId: employee.shiftId || null,
        status,
        location: data.location || undefined,
        checkInMethod,
        notes: data.notes || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    return attendance;
  }

  /**
   * Check-out with shift support
   */
  async checkOut(employeeId: string, data: CheckOutInput) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get employee with shift info
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        shift: true,
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // Find today's attendance record
    const attendance = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    if (!attendance) {
      throw new AppError('You have not checked in today', 400);
    }

    if (attendance.checkOut) {
      throw new AppError('You have already checked out today', 400);
    }

    if (!attendance.checkIn) {
      throw new AppError('You have not checked in today', 400);
    }

    // Validate geofence if shift has geofencing enabled (optional - skip if not configured)
    if (employee.shift?.geofenceEnabled && data.location) {
      if (employee.shift.geofenceLocation && employee.shift.geofenceRadius) {
        const isValid = shiftService.validateGeofence(
          data.location as { latitude: number; longitude: number },
          employee.shift.geofenceLocation as { latitude: number; longitude: number },
          parseFloat(employee.shift.geofenceRadius.toString())
        );

        if (!isValid) {
          throw new AppError(
            `You are outside the allowed geofence area. Please check out from the designated location.`,
            400
          );
        }
      }
      // If geofence is enabled but not configured, skip validation (allow check-out)
    }

    const now = new Date();
    const checkIn = attendance.checkIn;
    const totalHours = this.calculateWorkHours(checkIn, now);
    
    // Use shift break duration if available, otherwise use attendance record's break hours
    const breakHours = attendance.breakHours 
      ? parseFloat(attendance.breakHours.toString()) 
      : (employee.shift?.breakDuration ? employee.shift.breakDuration / 60 : 0);
    
    const workHours = this.calculateWorkHours(checkIn, now, breakHours);

    // Get policy rules for this shift if available
    let policyRules: Record<string, any> | null = null;
    if (attendance.shiftId) {
      try {
        policyRules = await shiftAssignmentRuleService.getApplicablePolicyRules(
          attendance.shiftId,
          employeeId,
          today,
          employee.organizationId
        );
      } catch (error) {
        // If policy rules fetch fails, continue without them
        console.warn('Failed to fetch policy rules:', error);
      }
    }

    // Calculate overtime based on policy rules or shift configuration
    let overtimeHours = 0;
    if (policyRules) {
      // Policy-based overtime calculation
      const shiftEndTime = employee.shift?.endTime 
        ? (() => {
            const end = new Date(today);
            const [endHours, endMinutes] = (employee.shift!.endTime as any).split(':').map(Number);
            end.setHours(endHours, endMinutes, 0, 0);
            return end;
          })()
        : null;

      if (policyRules.excessStayConsideredAsOT && shiftEndTime) {
        // OT starts after shift end + grace period
        const otStartGrace = policyRules.otStartsAfterShiftEnd || '00:00';
        const otStartTime = this.getShiftTimeWithGrace(shiftEndTime, otStartGrace, true);
        
        if (now > otStartTime) {
          const otHours = this.calculateWorkHours(otStartTime, now);
          const minOTHours = policyRules.minOTHoursPerDay 
            ? this.parseTimeToHours(policyRules.minOTHoursPerDay) 
            : 0;
          const maxOTHours = policyRules.maxOTHoursPerDay 
            ? this.parseTimeToHours(policyRules.maxOTHoursPerDay) 
            : Infinity;
          
          overtimeHours = Math.max(0, Math.min(otHours, maxOTHours));
          // Apply minimum OT threshold
          if (overtimeHours < minOTHours) {
            overtimeHours = 0;
          }
        }
      }

      // Check early coming as OT
      if (policyRules.earlyComingConsideredAsOT && employee.shift?.startTime) {
        const shiftStart = new Date(today);
        const [startHours, startMinutes] = (employee.shift.startTime as any).split(':').map(Number);
        shiftStart.setHours(startHours, startMinutes, 0, 0);
        
        if (checkIn < shiftStart) {
          const earlyHours = this.calculateWorkHours(checkIn, shiftStart);
          overtimeHours += earlyHours;
        }
      }
    } else if (employee.shift?.overtimeEnabled) {
      // Fallback to shift-based overtime calculation
      const standardHours = employee.shift.workHours 
        ? parseFloat(employee.shift.workHours.toString()) 
        : 8;
      const threshold = employee.shift.overtimeThreshold 
        ? parseFloat(employee.shift.overtimeThreshold.toString()) 
        : standardHours;
      
      if (workHours > threshold) {
        overtimeHours = workHours - threshold;
      }
    } else {
      // Default calculation if no shift
      const standardWorkHours = 8;
      overtimeHours = Math.max(0, workHours - standardWorkHours);
    }

    // Round off overtime if policy specifies
    if (policyRules?.roundOffOption && overtimeHours > 0) {
      overtimeHours = Math.round(overtimeHours);
    }

    // Detect early going based on policy rules
    let isEarlyGoing = false;
    let updatedNotes = data.notes || attendance.notes || '';
    
    if (policyRules && employee.shift?.endTime) {
      const shiftEnd = new Date(today);
      const [endHours, endMinutes] = (employee.shift.endTime as any).split(':').map(Number);
      shiftEnd.setHours(endHours, endMinutes, 0, 0);
      
      isEarlyGoing = this.isEarlyCheckOut(now, shiftEnd, policyRules);
      
      if (isEarlyGoing && policyRules.considerEarlyGoingAsShortfall) {
        // Could mark as HALF_DAY or add note - for now, add note
        const earlyMinutes = Math.round((shiftEnd.getTime() - now.getTime()) / (1000 * 60));
        if (updatedNotes) {
          updatedNotes += ` | Early going by ${earlyMinutes} minutes`;
        } else {
          updatedNotes = `Early going by ${earlyMinutes} minutes`;
        }
      }
    }

    // Detect late check-in if not already noted
    if (policyRules && employee.shift?.startTime && checkIn) {
      const shiftStart = new Date(today);
      const [startHours, startMinutes] = (employee.shift.startTime as any).split(':').map(Number);
      shiftStart.setHours(startHours, startMinutes, 0, 0);
      
      if (this.isLateCheckIn(checkIn, shiftStart, policyRules)) {
        const lateMinutes = Math.round((checkIn.getTime() - shiftStart.getTime()) / (1000 * 60));
        if (updatedNotes) {
          updatedNotes += ` | Late check-in by ${lateMinutes} minutes`;
        } else {
          updatedNotes = `Late check-in by ${lateMinutes} minutes`;
        }
      }
    }

    // Determine check-in method based on location
    let checkInMethod = attendance.checkInMethod || CheckInMethod.WEB;
    if (data.location) {
      checkInMethod = employee.shift?.geofenceEnabled ? CheckInMethod.GEOFENCE : CheckInMethod.MOBILE;
    }

    // Update attendance record
    const updated = await prisma.attendanceRecord.update({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      data: {
        checkOut: now,
        totalHours: new Prisma.Decimal(totalHours),
        workHours: new Prisma.Decimal(workHours),
        overtimeHours: new Prisma.Decimal(overtimeHours),
        location: data.location || (attendance.location ? attendance.location : undefined),
        checkInMethod: checkInMethod,
        notes: updatedNotes || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Get attendance records
   * @param query - Query parameters
   * @param userId - User ID for role-based filtering
   * @param userRole - User role for RBAC filtering
   */
  async getRecords(query: QueryAttendanceRecordsInput, userId?: string, userRole?: string) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceRecordWhereInput = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    } else if (userId) {
      // Get employee record
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, reportingManagerId: true, organizationId: true },
      });

      if (employee) {
        // RBAC: EMPLOYEE can only see their own records (self-service)
        if (userRole === 'EMPLOYEE') {
          where.employeeId = employee.id;
        }
        // RBAC: MANAGER can only see records from their team (subordinates)
        else if (userRole === 'MANAGER') {
          where.employee = {
            reportingManagerId: employee.id, // Only show records from employees who report to this manager
            organizationId: query.organizationId || employee.organizationId,
          };
        }
        // HR_MANAGER and ORG_ADMIN can see all records in their organization
        else if (userRole === 'HR_MANAGER' || userRole === 'ORG_ADMIN') {
          if (query.organizationId || employee.organizationId) {
            where.employee = {
              organizationId: query.organizationId || employee.organizationId,
            };
          }
        }
      }
    }

    if (query.startDate) {
      where.date = { gte: new Date(query.startDate) };
    }

    if (query.endDate) {
      where.date = {
        ...(where.date as any),
        lte: new Date(query.endDate),
      };
    }

    if (query.status) {
      where.status = query.status;
    }

    // Merge organizationId filter if provided and not already set by RBAC
    // RBAC filtering already sets organizationId for MANAGER, HR_MANAGER, ORG_ADMIN
    // Only apply if not already filtered by role-based logic
    if (query.organizationId && !where.employee && !where.employeeId) {
      where.employee = {
        organizationId: query.organizationId,
      };
    } else if (query.organizationId && where.employee && !where.employee.organizationId) {
      // Merge organizationId into existing employee filter
      where.employee.organizationId = query.organizationId;
    }

    const [records, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'date']: query.sortOrder || 'desc',
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
          shift: {
            select: {
              id: true,
              name: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      }),
      prisma.attendanceRecord.count({ where }),
    ]);

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get attendance summary for employee
   */
  async getSummary(query: QueryAttendanceSummaryInput) {
    const { employeeId, startDate, endDate } = query;

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    // Calculate statistics
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalHalfDay = 0;
    let totalHolidays = 0;
    let totalWeekends = 0;
    let totalWorkHours = 0;
    let totalOvertimeHours = 0;

    records.forEach((record) => {
      if (record.status === AttendanceStatus.PRESENT) {
        totalPresent++;
      } else if (record.status === AttendanceStatus.ABSENT) {
        totalAbsent++;
      } else if (record.status === AttendanceStatus.HALF_DAY) {
        totalHalfDay++;
      } else if (record.status === AttendanceStatus.HOLIDAY) {
        totalHolidays++;
      } else if (record.status === AttendanceStatus.WEEKEND) {
        totalWeekends++;
      }

      if (record.workHours) {
        totalWorkHours += parseFloat(record.workHours.toString());
      }

      if (record.overtimeHours) {
        totalOvertimeHours += parseFloat(record.overtimeHours.toString());
      }
    });

    return {
      employeeId,
      startDate: start,
      endDate: end,
      summary: {
        totalDays: records.length,
        present: totalPresent,
        absent: totalAbsent,
        halfDay: totalHalfDay,
        holidays: totalHolidays,
        weekends: totalWeekends,
        totalWorkHours: Math.round(totalWorkHours * 100) / 100,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        attendancePercentage: records.length > 0
          ? Math.round((totalPresent / records.length) * 100)
          : 0,
      },
    };
  }

  /**
   * Get attendance report
   */
  async getReport(query: QueryAttendanceReportInput) {
    const { organizationId, startDate, endDate, departmentId, employeeId } = query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    const where: Prisma.AttendanceRecordWhereInput = {
      employee: {
        organizationId,
        ...(departmentId && { departmentId }),
        ...(employeeId && { id: employeeId }),
      },
      date: {
        gte: start,
        lte: end,
      },
    };

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Calculate summary statistics
    const summary = {
      totalRecords: records.length,
      present: records.filter(r => r.status === AttendanceStatus.PRESENT).length,
      absent: records.filter(r => r.status === AttendanceStatus.ABSENT).length,
      halfDay: records.filter(r => r.status === AttendanceStatus.HALF_DAY).length,
      holidays: records.filter(r => r.status === AttendanceStatus.HOLIDAY).length,
    };

    return {
      startDate: start,
      endDate: end,
      organizationId,
      summary,
      records,
    };
  }

  /**
   * Recalculate attendance record based on new shift assignment
   * This is called when a shift assignment is changed after punch-in/out
   */
  private async recalculateAttendanceForShiftChange(
    attendanceRecordId: string,
    newShiftId: string,
    employeeId: string,
    organizationId: string
  ): Promise<void> {
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceRecordId },
      include: {
        employee: {
          include: {
            shift: true,
          },
        },
      },
    });

    if (!record || !record.checkIn) {
      return; // Can't recalculate without check-in
    }

    // Get the new shift
    const newShift = await prisma.shift.findUnique({
      where: { id: newShiftId },
    });

    if (!newShift) {
      return;
    }

    // Get policy rules for the new shift
    let policyRules: Record<string, any> | null = null;
    try {
      policyRules = await shiftAssignmentRuleService.getApplicablePolicyRules(
        newShiftId,
        employeeId,
        record.date,
        organizationId
      );
    } catch (error) {
      console.warn('Failed to fetch policy rules for recalculation:', error);
    }

    const checkIn = record.checkIn;
    const checkOut = record.checkOut || new Date(); // Use current time if not checked out yet
    
    // Recalculate work hours
    const breakHours = record.breakHours 
      ? parseFloat(record.breakHours.toString()) 
      : (newShift.breakDuration ? newShift.breakDuration / 60 : 0);
    
    const totalHours = this.calculateWorkHours(checkIn, checkOut);
    const workHours = this.calculateWorkHours(checkIn, checkOut, breakHours);

    // Recalculate overtime based on new shift and policy rules
    let overtimeHours = 0;
    if (policyRules) {
      // Policy-based overtime calculation
      const shiftEndTime = newShift.endTime 
        ? (() => {
            const end = new Date(record.date);
            const [endHours, endMinutes] = (newShift.endTime as any).split(':').map(Number);
            end.setHours(endHours, endMinutes, 0, 0);
            return end;
          })()
        : null;

      if (policyRules.excessStayConsideredAsOT && shiftEndTime) {
        const otStartGrace = policyRules.otStartsAfterShiftEnd || '00:00';
        const otStartTime = this.getShiftTimeWithGrace(shiftEndTime, otStartGrace, true);
        
        if (checkOut > otStartTime) {
          const otHours = this.calculateWorkHours(otStartTime, checkOut);
          const minOTHours = policyRules.minOTHoursPerDay 
            ? this.parseTimeToHours(policyRules.minOTHoursPerDay) 
            : 0;
          const maxOTHours = policyRules.maxOTHoursPerDay 
            ? this.parseTimeToHours(policyRules.maxOTHoursPerDay) 
            : Infinity;
          
          overtimeHours = Math.max(0, Math.min(otHours, maxOTHours));
          if (overtimeHours < minOTHours) {
            overtimeHours = 0;
          }
        }
      }

      // Check early coming as OT
      if (policyRules.earlyComingConsideredAsOT && newShift.startTime) {
        const shiftStart = new Date(record.date);
        const [startHours, startMinutes] = (newShift.startTime as any).split(':').map(Number);
        shiftStart.setHours(startHours, startMinutes, 0, 0);
        
        if (checkIn < shiftStart) {
          const earlyHours = this.calculateWorkHours(checkIn, shiftStart);
          overtimeHours += earlyHours;
        }
      }
    } else if (newShift.overtimeEnabled) {
      // Fallback to shift-based overtime calculation
      const standardHours = newShift.workHours 
        ? parseFloat(newShift.workHours.toString()) 
        : 8;
      const threshold = newShift.overtimeThreshold 
        ? parseFloat(newShift.overtimeThreshold.toString()) 
        : standardHours;
      
      if (workHours > threshold) {
        overtimeHours = workHours - threshold;
      }
    }

    // Round off overtime if policy specifies
    if (policyRules?.roundOffOption && overtimeHours > 0) {
      overtimeHours = Math.round(overtimeHours);
    }

    // Update notes with late/early information based on new shift
    const notesParts: string[] = [];
    
    if (policyRules && newShift.startTime) {
      const shiftStart = new Date(record.date);
      const [startHours, startMinutes] = (newShift.startTime as any).split(':').map(Number);
      shiftStart.setHours(startHours, startMinutes, 0, 0);
      
      if (this.isLateCheckIn(checkIn, shiftStart, policyRules)) {
        const lateMinutes = Math.round((checkIn.getTime() - shiftStart.getTime()) / (1000 * 60));
        notesParts.push(`Late check-in: ${lateMinutes} min`);
      }
    }

    if (policyRules && newShift.endTime && record.checkOut) {
      const shiftEnd = new Date(record.date);
      const [endHours, endMinutes] = (newShift.endTime as any).split(':').map(Number);
      shiftEnd.setHours(endHours, endMinutes, 0, 0);
      
      if (this.isEarlyCheckOut(record.checkOut, shiftEnd, policyRules)) {
        const earlyMinutes = Math.round((shiftEnd.getTime() - record.checkOut.getTime()) / (1000 * 60));
        notesParts.push(`Early going: ${earlyMinutes} min`);
      }
    }

    // Update the record with recalculated values
    await prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: {
        totalHours: new Prisma.Decimal(totalHours),
        workHours: new Prisma.Decimal(workHours),
        overtimeHours: new Prisma.Decimal(overtimeHours),
        notes: notesParts.length > 0 ? notesParts.join(' | ') : null,
      },
    });
  }

  /**
   * Bulk update shift assignments for employees
   * Creates or updates attendance records with shiftId
   * Recalculates attendance if records already have punch-in/out times
   */
  async bulkUpdateShiftAssignments(
    organizationId: string,
    assignments: Array<{
      employeeId: string;
      date: string; // YYYY-MM-DD format
      shiftName: string; // Shift name from Shift Master
    }>
  ) {
    // Get all shifts to map shift names to IDs
    const shifts = await prisma.shift.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true },
    });

    const shiftMap = new Map<string, string>();
    shifts.forEach(shift => {
      shiftMap.set(shift.name, shift.id);
    });

    const results = [];

    for (const assignment of assignments) {
      try {
        const { employeeId, date, shiftName } = assignment;
        
        // Skip "W" (Week Off) - don't create attendance record for week offs
        if (shiftName === 'W' || shiftName === 'Weekoff') {
          // Remove shiftId from existing attendance record if it exists
          await prisma.attendanceRecord.updateMany({
            where: {
              employeeId,
              date: new Date(date),
            },
            data: {
              shiftId: null,
            },
          });
          results.push({ employeeId, date, shiftName, status: 'skipped' });
          continue;
        }

        const shiftId = shiftMap.get(shiftName);
        if (!shiftId) {
          results.push({ 
            employeeId, 
            date, 
            shiftName, 
            status: 'error', 
            message: `Shift "${shiftName}" not found in Shift Master` 
          });
          continue;
        }

        // Verify employee belongs to organization
        const employee = await prisma.employee.findFirst({
          where: {
            id: employeeId,
            organizationId,
          },
        });

        if (!employee) {
          results.push({ 
            employeeId, 
            date, 
            shiftName, 
            status: 'error', 
            message: 'Employee not found in this organization' 
          });
          continue;
        }

        // Upsert attendance record with shiftId
        const attendanceRecord = await prisma.attendanceRecord.upsert({
          where: {
            employeeId_date: {
              employeeId,
              date: new Date(date),
            },
          },
          create: {
            employeeId,
            date: new Date(date),
            shiftId,
          },
          update: {
            shiftId,
          },
        });

        // If the record has check-in/out times, recalculate attendance based on new shift
        if (attendanceRecord.checkIn) {
          try {
            await this.recalculateAttendanceForShiftChange(
              attendanceRecord.id,
              shiftId,
              employeeId,
              organizationId
            );
          } catch (recalcError) {
            // Log error but don't fail the assignment update
            console.error('Error recalculating attendance for shift change:', recalcError);
          }
        }

        results.push({ employeeId, date, shiftName, status: 'success' });
      } catch (error: any) {
        // Catch any unexpected database errors
        results.push({
          employeeId: assignment.employeeId,
          date: assignment.date,
          shiftName: assignment.shiftName,
          status: 'error',
          message: error?.message || 'Database error occurred',
        });
      }
    }

    return results;
  }
}

export const attendanceService = new AttendanceService();
