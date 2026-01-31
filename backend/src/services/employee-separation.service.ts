import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import type { CreateEmployeeSeparationInput, UpdateEmployeeSeparationInput, QueryEmployeeSeparationsInput } from '../utils/employee-separation.validation';
import { EmployeeStatus } from '@prisma/client';

export class EmployeeSeparationService {
  async create(data: CreateEmployeeSeparationInput) {
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      select: { organizationId: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);
    if (employee.organizationId !== data.organizationId) {
      throw new AppError('Employee does not belong to this organization', 400);
    }

    const resignationApplyDate = new Date(data.resignationApplyDate);
    const relievingDate = new Date(data.relievingDate);

    const separation = await prisma.employeeSeparation.create({
      data: {
        employeeId: data.employeeId,
        organizationId: data.organizationId,
        resignationApplyDate,
        noticePeriod: data.noticePeriod,
        noticePeriodReason: data.noticePeriodReason ?? undefined,
        relievingDate,
        reasonOfLeaving: data.reasonOfLeaving ?? undefined,
        separationType: data.separationType,
        remarks: data.remarks ?? undefined,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update employee: dateOfLeaving, status; disable login (user.isActive = false)
    const newStatus: EmployeeStatus = data.separationType === 'RESIGNATION' ? EmployeeStatus.RESIGNED : EmployeeStatus.TERMINATED;
    const updatedEmp = await prisma.employee.update({
      where: { id: data.employeeId },
      data: {
        dateOfLeaving: relievingDate,
        terminationReason: data.reasonOfLeaving ?? data.separationType,
        employeeStatus: newStatus,
      },
      select: { userId: true },
    });
    await prisma.user.update({
      where: { id: updatedEmp.userId },
      data: { isActive: false },
    });

    return separation;
  }

  async getAll(query: QueryEmployeeSeparationsInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.search && query.search.trim()) {
      where.OR = [
        { employee: { employeeCode: { contains: query.search, mode: 'insensitive' } } },
        { employee: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [separations, total] = await Promise.all([
      prisma.employeeSeparation.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'resignationApplyDate']: query.sortOrder || 'desc' },
      }),
      prisma.employeeSeparation.count({ where }),
    ]);

    return {
      separations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const separation = await prisma.employeeSeparation.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            organizationId: true,
          },
        },
        organization: { select: { id: true, name: true } },
      },
    });
    if (!separation) throw new AppError('Separation record not found', 404);
    return separation;
  }

  async update(id: string, data: UpdateEmployeeSeparationInput) {
    const existing = await prisma.employeeSeparation.findUnique({
      where: { id },
      include: { employee: { select: { id: true } } },
    });
    if (!existing) throw new AppError('Separation record not found', 404);

    const payload: any = {};
    if (data.resignationApplyDate != null) payload.resignationApplyDate = new Date(data.resignationApplyDate);
    if (data.noticePeriod != null) payload.noticePeriod = data.noticePeriod;
    if (data.noticePeriodReason !== undefined) payload.noticePeriodReason = data.noticePeriodReason;
    if (data.relievingDate != null) payload.relievingDate = new Date(data.relievingDate);
    if (data.reasonOfLeaving !== undefined) payload.reasonOfLeaving = data.reasonOfLeaving;
    if (data.separationType != null) payload.separationType = data.separationType;
    if (data.remarks !== undefined) payload.remarks = data.remarks;

    const separation = await prisma.employeeSeparation.update({
      where: { id },
      data: payload,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const effectiveRelieving = data.relievingDate != null ? new Date(data.relievingDate) : existing.relievingDate;
    const effectiveType = data.separationType ?? existing.separationType;
    const effectiveReason = data.reasonOfLeaving ?? existing.reasonOfLeaving ?? effectiveType;
    const newStatus: EmployeeStatus = effectiveType === 'RESIGNATION' ? EmployeeStatus.RESIGNED : EmployeeStatus.TERMINATED;
    const emp = await prisma.employee.update({
      where: { id: existing.employeeId },
      data: {
        dateOfLeaving: effectiveRelieving,
        terminationReason: effectiveReason,
        employeeStatus: newStatus,
      },
      select: { userId: true },
    });
    await prisma.user.update({
      where: { id: emp.userId },
      data: { isActive: false },
    });

    return separation;
  }

  async delete(id: string) {
    const existing = await prisma.employeeSeparation.findUnique({ where: { id } });
    if (!existing) throw new AppError('Separation record not found', 404);
    await prisma.employeeSeparation.delete({ where: { id } });
    return { deleted: true };
  }
}

export const employeeSeparationService = new EmployeeSeparationService();
