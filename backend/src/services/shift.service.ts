
import * as fs from 'fs';
import * as path from 'path';
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

const DEBUG_LOG = path.join(__dirname, '..', '..', '..', '.cursor', 'debug.log');
const dbg = (msg: string, d: Record<string, unknown>, h: string) => {
  try { fs.appendFileSync(DEBUG_LOG, JSON.stringify({message:msg,data:d,hypothesisId:h,timestamp:Date.now()})+'\n'); } catch (_) { /* ignore debug log write failures */ }
};

export class ShiftService {
  /**
   * Create new shift
   */
  async create(data: {
    organizationId: string;
    name: string;
    code?: string;
    description?: string;
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
    firstHalfEnd?: string;
    secondHalfStart?: string;
    punchInTime?: string;
    punchOutTime?: string;
    flexiType?: string;
    breakDuration?: number; // minutes
    workHours?: number;
    isFlexible?: boolean;
    gracePeriod?: number; // minutes
    earlyLeaveAllowed?: boolean;
    overtimeEnabled?: boolean;
    overtimeThreshold?: number; // hours
    geofenceEnabled?: boolean;
    geofenceRadius?: number; // meters
    geofenceLocation?: any; // {lat, lng, address}
    isActive?: boolean;
  }) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const validateTime = (v: string | undefined, name: string) => {
      if (!v) return;
      if (!timeRegex.test(v)) throw new AppError(`Invalid ${name}. Use HH:mm format`, 400);
    };

    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Check code uniqueness within organization
    if (data.code) {
      const existing = await prisma.shift.findFirst({
        where: {
          organizationId: data.organizationId,
          code: data.code,
        },
      });

      if (existing) {
        throw new AppError('Shift code already exists in this organization', 400);
      }
    }

    validateTime(data.startTime, 'From Time');
    validateTime(data.endTime, 'To Time');

    const isFlexible = data.flexiType === 'FULL_FLEXI' || data.isFlexible === true;

    // Calculate work hours if not provided
    let workHours = data.workHours;
    if (!workHours) {
      const [startHour, startMin] = data.startTime.split(':').map(Number);
      const [endHour, endMin] = data.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const totalMinutes = endMinutes > startMinutes 
        ? endMinutes - startMinutes 
        : (24 * 60) - startMinutes + endMinutes; // Handle overnight shifts
      const breakMins = data.breakDuration || 0;
      workHours = (totalMinutes - breakMins) / 60;
    }

    validateTime(data.firstHalfEnd, 'First Half End');
    validateTime(data.secondHalfStart, 'Second Half Start');
    validateTime(data.punchInTime, 'PunchIn Time');
    validateTime(data.punchOutTime, 'PunchOut Time');

    // #region agent log
    dbg('shift.create entry',{organizationId:data.organizationId,code:data.code},'H1');
    // Auto-fix: remove global unique on code only (exclude pk), add per-org composite
    const oldIndexes = await prisma.$queryRawUnsafe<{indexname:string}[]>(`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'shifts'
        AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%(code)%'
        AND indexdef NOT LIKE '%organization_id%'
        AND indexname NOT LIKE '%pkey%'
        AND indexname != 'shifts_organization_id_code_key'
    `);
    dbg('old code-only indexes',{names:oldIndexes?.map(i=>i.indexname)},'H2');
    for (const row of oldIndexes || []) {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS public.` + row.indexname + `;`);
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE "shifts" DROP CONSTRAINT IF EXISTS "shifts_code_key";`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "shifts_organization_id_code_key" ON "shifts"("organization_id", "code");`);
    dbg('auto-fix applied',{dropped:oldIndexes?.map(i=>i.indexname)},'H1');
    // #endregion

    let shift;
    try {
      shift = await prisma.shift.create({
        data: {
          organizationId: data.organizationId,
          name: data.name,
          code: data.code || null,
          description: data.description || null,
          startTime: data.startTime,
          endTime: data.endTime,
          firstHalfEnd: data.firstHalfEnd || null,
          secondHalfStart: data.secondHalfStart || null,
          punchInTime: data.punchInTime || null,
          punchOutTime: data.punchOutTime || null,
          flexiType: data.flexiType || null,
          breakDuration: data.breakDuration || null,
          workHours: new Prisma.Decimal(workHours),
          isFlexible,
          gracePeriod: data.gracePeriod || null,
          earlyLeaveAllowed: data.earlyLeaveAllowed || false,
          overtimeEnabled: data.overtimeEnabled !== undefined ? data.overtimeEnabled : true,
          overtimeThreshold: data.overtimeThreshold ? new Prisma.Decimal(data.overtimeThreshold) : null,
          geofenceEnabled: data.geofenceEnabled || false,
          geofenceRadius: data.geofenceRadius ? new Prisma.Decimal(data.geofenceRadius) : null,
          geofenceLocation: data.geofenceLocation || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });
    } catch (err: unknown) {
      // #region agent log
      dbg('shift.create error',{errorMsg:String(err),meta:(err as {meta?:unknown})?.meta},'H4');
      // #endregion
      throw err;
    }

    return shift;
  }

  /**
   * Get all shifts
   */
  async getAll(query: {
    organizationId?: string;
    isActive?: boolean | string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.ShiftWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.isActive !== undefined) {
      const normalizedIsActive =
        typeof query.isActive === 'string'
          ? query.isActive.toLowerCase() === 'true'
            ? true
            : query.isActive.toLowerCase() === 'false'
              ? false
              : undefined
          : query.isActive;
      if (typeof normalizedIsActive === 'boolean') {
        where.isActive = normalizedIsActive;
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.shift.count({ where }),
    ]);

    return {
      shifts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get shift by ID
   */
  async getById(id: string) {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    return shift;
  }

  /**
   * Update shift
   */
  async update(id: string, data: any) {
    const existing = await prisma.shift.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Shift not found', 404);
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const validateTime = (v: string | undefined, name: string) => {
      if (!v) return;
      if (!timeRegex.test(v)) throw new AppError(`Invalid ${name}. Use HH:mm format`, 400);
    };
    validateTime(data.startTime, 'From Time');
    validateTime(data.endTime, 'To Time');

    // Check code uniqueness within organization when changing code
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.shift.findFirst({
        where: {
          organizationId: existing.organizationId,
          code: data.code,
        },
      });

      if (codeExists) {
        throw new AppError('Shift code already exists in this organization', 400);
      }
    }

    validateTime(data.firstHalfEnd, 'First Half End');
    validateTime(data.secondHalfStart, 'Second Half Start');
    validateTime(data.punchInTime, 'PunchIn Time');
    validateTime(data.punchOutTime, 'PunchOut Time');

    const updateData: any = { ...data };
    if (data.flexiType !== undefined) {
      updateData.isFlexible = data.flexiType === 'FULL_FLEXI';
    }
    
    // Convert Decimal fields
    if (data.workHours !== undefined) {
      updateData.workHours = data.workHours ? new Prisma.Decimal(data.workHours) : null;
    }
    if (data.overtimeThreshold !== undefined) {
      updateData.overtimeThreshold = data.overtimeThreshold ? new Prisma.Decimal(data.overtimeThreshold) : null;
    }
    if (data.geofenceRadius !== undefined) {
      updateData.geofenceRadius = data.geofenceRadius ? new Prisma.Decimal(data.geofenceRadius) : null;
    }

    const shift = await prisma.shift.update({
      where: { id },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return shift;
  }

  /**
   * Delete shift
   */
  async delete(id: string) {
    const existing = await prisma.shift.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Shift not found', 404);
    }

    // Check if shift is assigned to any employees
    const employeesCount = await prisma.employee.count({
      where: { shiftId: id },
    });

    if (employeesCount > 0) {
      throw new AppError(
        `Cannot delete shift. It is assigned to ${employeesCount} employee(s). Please reassign them first.`,
        400
      );
    }

    await prisma.shift.delete({
      where: { id },
    });

    return { message: 'Shift deleted successfully' };
  }

  /**
   * Validate geofence location
   */
  validateGeofence(
    checkInLocation: { latitude: number; longitude: number },
    geofenceLocation: { latitude: number; longitude: number },
    radius: number
  ): boolean {
    // Haversine formula to calculate distance between two points
    const R = 6371000; // Earth's radius in meters
    const lat1 = (geofenceLocation.latitude * Math.PI) / 180;
    const lat2 = (checkInLocation.latitude * Math.PI) / 180;
    const deltaLat = ((checkInLocation.latitude - geofenceLocation.latitude) * Math.PI) / 180;
    const deltaLng = ((checkInLocation.longitude - geofenceLocation.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in meters

    return distance <= radius;
  }
}

export const shiftService = new ShiftService();
