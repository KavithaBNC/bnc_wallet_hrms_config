
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import {
  CreateJobOpeningInput,
  UpdateJobOpeningInput,
  QueryJobOpeningsInput,
} from '../utils/ats.validation';

export class JobOpeningService {
  /**
   * Create new job opening
   */
  async create(data: CreateJobOpeningInput, userId: string) {
    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Verify position if provided
    if (data.positionId) {
      const position = await prisma.jobPosition.findUnique({
        where: { id: data.positionId },
      });
      if (!position) {
        throw new AppError('Job position not found', 404);
      }
    }

    // Verify department if provided
    if (data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });
      if (!department) {
        throw new AppError('Department not found', 404);
      }
    }

    // Verify hiring manager if provided
    if (data.hiringManagerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: data.hiringManagerId },
      });
      if (!manager) {
        throw new AppError('Hiring manager not found', 404);
      }
    }

    const jobOpening = await prisma.jobOpening.create({
      data: {
        organizationId: data.organizationId,
        positionId: data.positionId,
        title: data.title,
        departmentId: data.departmentId,
        hiringManagerId: data.hiringManagerId,
        recruiters: data.recruiters || [],
        employmentType: data.employmentType,
        jobType: data.jobType,
        location: data.location,
        experienceRequired: data.experienceRequired,
        salaryRange: data.salaryRange,
        description: data.description,
        requirements: data.requirements || [],
        responsibilities: data.responsibilities || [],
        skillsRequired: data.skillsRequired || [],
        qualifications: data.qualifications || [],
        benefits: data.benefits || [],
        numberOfPositions: data.numberOfPositions || 1,
        positionsFilled: 0,
        status: data.status || 'DRAFT',
        postingDate: data.postingDate ? new Date(data.postingDate) : null,
        applicationDeadline: data.applicationDeadline ? new Date(data.applicationDeadline) : null,
        targetClosureDate: data.targetClosureDate ? new Date(data.targetClosureDate) : null,
        applicationFormFields: data.applicationFormFields,
        screeningQuestions: data.screeningQuestions || [],
        internalJob: data.internalJob || false,
        isConfidential: data.isConfidential || false,
        createdBy: userId,
      },
      include: {
        organization: true,
        position: true,
        department: true,
        hiringManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return jobOpening;
  }

  /**
   * Get all job openings with filters
   */
  async getAll(query: QueryJobOpeningsInput, organizationId?: string) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (organizationId) {
      where.organizationId = organizationId;
    } else if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.positionId) {
      where.positionId = query.positionId;
    }

    if (query.hiringManagerId) {
      where.hiringManagerId = query.hiringManagerId;
    }

    if (query.jobType) {
      where.jobType = query.jobType;
    }

    if (query.employmentType) {
      where.employmentType = query.employmentType;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [jobOpenings, total] = await Promise.all([
      prisma.jobOpening.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          position: {
            select: {
              id: true,
              title: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          hiringManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      }),
      prisma.jobOpening.count({ where }),
    ]);

    return {
      data: jobOpenings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get job opening by ID
   */
  async getById(id: string) {
    const jobOpening = await prisma.jobOpening.findUnique({
      where: { id },
      include: {
        organization: true,
        position: true,
        department: true,
        hiringManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    if (!jobOpening) {
      throw new AppError('Job opening not found', 404);
    }

    return jobOpening;
  }

  /**
   * Update job opening
   */
  async update(id: string, data: UpdateJobOpeningInput) {
    await this.getById(id);

    // Verify position if provided
    if (data.positionId) {
      const position = await prisma.jobPosition.findUnique({
        where: { id: data.positionId },
      });
      if (!position) {
        throw new AppError('Job position not found', 404);
      }
    }

    // Verify department if provided
    if (data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });
      if (!department) {
        throw new AppError('Department not found', 404);
      }
    }

    // Verify hiring manager if provided
    if (data.hiringManagerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: data.hiringManagerId },
      });
      if (!manager) {
        throw new AppError('Hiring manager not found', 404);
      }
    }

    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.positionId !== undefined) updateData.positionId = data.positionId;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.hiringManagerId !== undefined) updateData.hiringManagerId = data.hiringManagerId;
    if (data.recruiters !== undefined) updateData.recruiters = data.recruiters;
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
    if (data.jobType !== undefined) updateData.jobType = data.jobType;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.experienceRequired !== undefined) updateData.experienceRequired = data.experienceRequired;
    if (data.salaryRange !== undefined) updateData.salaryRange = data.salaryRange;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.requirements !== undefined) updateData.requirements = data.requirements;
    if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
    if (data.skillsRequired !== undefined) updateData.skillsRequired = data.skillsRequired;
    if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
    if (data.benefits !== undefined) updateData.benefits = data.benefits;
    if (data.numberOfPositions !== undefined) updateData.numberOfPositions = data.numberOfPositions;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.postingDate !== undefined) updateData.postingDate = data.postingDate ? new Date(data.postingDate) : null;
    if (data.applicationDeadline !== undefined)
      updateData.applicationDeadline = data.applicationDeadline ? new Date(data.applicationDeadline) : null;
    if (data.targetClosureDate !== undefined)
      updateData.targetClosureDate = data.targetClosureDate ? new Date(data.targetClosureDate) : null;
    if (data.applicationFormFields !== undefined) updateData.applicationFormFields = data.applicationFormFields;
    if (data.screeningQuestions !== undefined) updateData.screeningQuestions = data.screeningQuestions;
    if (data.internalJob !== undefined) updateData.internalJob = data.internalJob;
    if (data.isConfidential !== undefined) updateData.isConfidential = data.isConfidential;

    const updated = await prisma.jobOpening.update({
      where: { id },
      data: updateData,
      include: {
        organization: true,
        position: true,
        department: true,
        hiringManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete job opening
   */
  async delete(id: string) {
    await this.getById(id);

    // Check if there are any applications
    const applicationCount = await prisma.application.count({
      where: { jobOpeningId: id },
    });

    if (applicationCount > 0) {
      throw new AppError('Cannot delete job opening with existing applications', 400);
    }

    await prisma.jobOpening.delete({
      where: { id },
    });

    return { message: 'Job opening deleted successfully' };
  }

  /**
   * Update positions filled count
   */
  async updatePositionsFilled(id: string, count: number) {
    const jobOpening = await this.getById(id);
    const maxPositions = jobOpening.numberOfPositions;

    if (count < 0 || count > maxPositions) {
      throw new AppError('Invalid positions filled count', 400);
    }

    const updated = await prisma.jobOpening.update({
      where: { id },
      data: { positionsFilled: count },
    });

    return updated;
  }
}

export const jobOpeningService = new JobOpeningService();
