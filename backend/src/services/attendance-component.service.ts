import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { parsePagination, parseString } from '../utils/queryParser';

export class AttendanceComponentService {
  /**
   * Create new attendance component
   */
  async create(data: {
    organizationId: string;
    shortName: string;
    eventName: string;
    description?: string;
    eventCategory: string;
    authorized?: boolean;
    considerAsWorkHours?: boolean;
    hasBalance?: boolean;
    creditFromOverTime?: boolean;
    allowBalanceEntry?: boolean;
    allowEventOpeningRule?: boolean;
    allowAutoCreditRule?: boolean;
    allowHourly?: boolean;
    allowDatewise?: boolean;
    allowWeekOffSelection?: boolean;
    allowHolidaySelection?: boolean;
    applicableForRegularization?: boolean;
    allowDifferentLeavePeriod?: boolean;
    allowEventChange?: boolean;
    validationRemarksMandatory?: boolean;
    leaveDeductionWhileInFandF?: boolean;
    cannotOverlapWith?: string[];
    priority?: number;
    eventEntryForm?: string;
    autoCreditEngine?: string;
    encashment?: string;
    sendMailToOnEntry?: boolean;
    sendSMSToOnEntry?: boolean;
  }) {
    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Check shortName uniqueness within organization
    const existing = await prisma.attendanceComponent.findFirst({
      where: {
        organizationId: data.organizationId,
        shortName: data.shortName.trim(),
      },
    });

    if (existing) {
      throw new AppError('Short name already exists for this organization', 400);
    }

    const component = await prisma.attendanceComponent.create({
      data: {
        organizationId: data.organizationId,
        shortName: data.shortName.trim(),
        eventName: data.eventName.trim(),
        description: data.description?.trim() || null,
        eventCategory: data.eventCategory,
        authorized: data.authorized ?? false,
        considerAsWorkHours: data.considerAsWorkHours ?? false,
        hasBalance: data.hasBalance ?? false,
        creditFromOverTime: data.creditFromOverTime ?? false,
        allowBalanceEntry: data.allowBalanceEntry ?? false,
        allowEventOpeningRule: data.allowEventOpeningRule ?? false,
        allowAutoCreditRule: data.allowAutoCreditRule ?? false,
        allowHourly: data.allowHourly ?? false,
        allowDatewise: data.allowDatewise ?? false,
        allowWeekOffSelection: data.allowWeekOffSelection ?? false,
        allowHolidaySelection: data.allowHolidaySelection ?? false,
        applicableForRegularization: data.applicableForRegularization ?? false,
        allowDifferentLeavePeriod: data.allowDifferentLeavePeriod ?? false,
        allowEventChange: data.allowEventChange ?? false,
        validationRemarksMandatory: data.validationRemarksMandatory ?? false,
        leaveDeductionWhileInFandF: data.leaveDeductionWhileInFandF ?? false,
        cannotOverlapWith: data.cannotOverlapWith && data.cannotOverlapWith.length > 0
          ? data.cannotOverlapWith.join(', ')
          : null,
        priority: data.priority || null,
        eventEntryForm: data.eventEntryForm || null,
        autoCreditEngine: data.autoCreditEngine || null,
        encashment: data.encashment || null,
        sendMailToOnEntry: data.sendMailToOnEntry ?? false,
        sendSMSToOnEntry: data.sendSMSToOnEntry ?? false,
      },
    });

    return component;
  }

  /**
   * Get all attendance components with pagination and filtering
   */
  async getAll(query: {
    organizationId: string;
    page?: number | string;
    limit?: number | string;
    search?: string;
  }) {
    // Parse pagination parameters safely
    const { page, limit, skip } = parsePagination(query.page, query.limit, 10, 100);

    const where: Prisma.AttendanceComponentWhereInput = {
      organizationId: query.organizationId,
    };

    const searchTerm = parseString(query.search);
    if (searchTerm) {
      where.OR = [
        { shortName: { contains: searchTerm, mode: 'insensitive' } },
        { eventName: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [components, total] = await Promise.all([
      prisma.attendanceComponent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attendanceComponent.count({ where }),
    ]);

    return {
      components,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get attendance component by ID
   */
  async getById(id: string) {
    const component = await prisma.attendanceComponent.findUnique({
      where: { id },
    });

    if (!component) {
      throw new AppError('Attendance component not found', 404);
    }

    return component;
  }

  /**
   * Update attendance component
   */
  async update(
    id: string,
    data: Partial<{
      shortName: string;
      eventName: string;
      description: string;
      eventCategory: string;
      authorized: boolean;
      considerAsWorkHours: boolean;
      hasBalance: boolean;
      creditFromOverTime: boolean;
      allowBalanceEntry: boolean;
      allowEventOpeningRule: boolean;
      allowAutoCreditRule: boolean;
      allowHourly: boolean;
      allowDatewise: boolean;
      allowWeekOffSelection: boolean;
      allowHolidaySelection: boolean;
      applicableForRegularization: boolean;
      allowDifferentLeavePeriod: boolean;
      allowEventChange: boolean;
      validationRemarksMandatory: boolean;
      leaveDeductionWhileInFandF: boolean;
      cannotOverlapWith: string[];
      priority: number;
      eventEntryForm: string;
      autoCreditEngine: string;
      encashment: string;
      sendMailToOnEntry: boolean;
      sendSMSToOnEntry: boolean;
    }>
  ) {
    const existing = await prisma.attendanceComponent.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Attendance component not found', 404);
    }

    // Check shortName uniqueness if being updated
    if (data.shortName && data.shortName.trim() !== existing.shortName) {
      const duplicate = await prisma.attendanceComponent.findFirst({
        where: {
          organizationId: existing.organizationId,
          shortName: data.shortName.trim(),
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new AppError('Short name already exists for this organization', 400);
      }
    }

    const updateData: Prisma.AttendanceComponentUpdateInput = {};

    if (data.shortName !== undefined) updateData.shortName = data.shortName.trim();
    if (data.eventName !== undefined) updateData.eventName = data.eventName.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.eventCategory !== undefined) updateData.eventCategory = data.eventCategory;
    if (data.authorized !== undefined) updateData.authorized = data.authorized;
    if (data.considerAsWorkHours !== undefined) updateData.considerAsWorkHours = data.considerAsWorkHours;
    if (data.hasBalance !== undefined) updateData.hasBalance = data.hasBalance;
    if (data.creditFromOverTime !== undefined) updateData.creditFromOverTime = data.creditFromOverTime;
    if (data.allowBalanceEntry !== undefined) updateData.allowBalanceEntry = data.allowBalanceEntry;
    if (data.allowEventOpeningRule !== undefined) updateData.allowEventOpeningRule = data.allowEventOpeningRule;
    if (data.allowAutoCreditRule !== undefined) updateData.allowAutoCreditRule = data.allowAutoCreditRule;
    if (data.allowHourly !== undefined) updateData.allowHourly = data.allowHourly;
    if (data.allowDatewise !== undefined) updateData.allowDatewise = data.allowDatewise;
    if (data.allowWeekOffSelection !== undefined) updateData.allowWeekOffSelection = data.allowWeekOffSelection;
    if (data.allowHolidaySelection !== undefined) updateData.allowHolidaySelection = data.allowHolidaySelection;
    if (data.applicableForRegularization !== undefined) updateData.applicableForRegularization = data.applicableForRegularization;
    if (data.allowDifferentLeavePeriod !== undefined) updateData.allowDifferentLeavePeriod = data.allowDifferentLeavePeriod;
    if (data.allowEventChange !== undefined) updateData.allowEventChange = data.allowEventChange;
    if (data.validationRemarksMandatory !== undefined) updateData.validationRemarksMandatory = data.validationRemarksMandatory;
    if (data.leaveDeductionWhileInFandF !== undefined) updateData.leaveDeductionWhileInFandF = data.leaveDeductionWhileInFandF;
    if (data.cannotOverlapWith !== undefined) {
      updateData.cannotOverlapWith = data.cannotOverlapWith && data.cannotOverlapWith.length > 0
        ? data.cannotOverlapWith.join(', ')
        : null;
    }
    if (data.priority !== undefined) updateData.priority = data.priority || null;
    if (data.eventEntryForm !== undefined) updateData.eventEntryForm = data.eventEntryForm || null;
    if (data.autoCreditEngine !== undefined) updateData.autoCreditEngine = data.autoCreditEngine || null;
    if (data.encashment !== undefined) updateData.encashment = data.encashment || null;
    if (data.sendMailToOnEntry !== undefined) updateData.sendMailToOnEntry = data.sendMailToOnEntry;
    if (data.sendSMSToOnEntry !== undefined) updateData.sendSMSToOnEntry = data.sendSMSToOnEntry;

    const component = await prisma.attendanceComponent.update({
      where: { id },
      data: updateData,
    });

    return component;
  }

  /**
   * Delete attendance component
   */
  async delete(id: string) {
    const component = await prisma.attendanceComponent.findUnique({
      where: { id },
    });

    if (!component) {
      throw new AppError('Attendance component not found', 404);
    }

    await prisma.attendanceComponent.delete({
      where: { id },
    });
  }
}

export const attendanceComponentService = new AttendanceComponentService();
