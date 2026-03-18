
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import {
  CreateApplicationInput,
  UpdateApplicationInput,
  QueryApplicationsInput,
} from '../utils/ats.validation';

export class ApplicationService {
  /**
   * Create new application
   */
  async create(data: CreateApplicationInput) {
    // Verify job opening exists
    const jobOpening = await prisma.jobOpening.findUnique({
      where: { id: data.jobOpeningId },
    });

    if (!jobOpening) {
      throw new AppError('Job opening not found', 404);
    }

    // Check if job opening is open
    if (jobOpening.status !== 'OPEN') {
      throw new AppError('Job opening is not open for applications', 400);
    }

    // Verify candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: data.candidateId },
    });

    if (!candidate) {
      throw new AppError('Candidate not found', 404);
    }

    // Check if application already exists
    const existingApplication = await prisma.application.findUnique({
      where: {
        jobOpeningId_candidateId: {
          jobOpeningId: data.jobOpeningId,
          candidateId: data.candidateId,
        },
      },
    });

    if (existingApplication) {
      throw new AppError('Application already exists for this candidate and job opening', 409);
    }

    // Verify assignee if provided
    if (data.assignedTo) {
      const assignee = await prisma.employee.findUnique({
        where: { id: data.assignedTo },
      });
      if (!assignee) {
        throw new AppError('Assigned recruiter not found', 404);
      }
    }

    const application = await prisma.application.create({
      data: {
        jobOpeningId: data.jobOpeningId,
        candidateId: data.candidateId,
        coverLetter: data.coverLetter,
        screeningAnswers: data.screeningAnswers,
        assignedTo: data.assignedTo,
        currentStage: 'NEW',
        status: 'ACTIVE',
      },
      include: {
        jobOpening: {
          select: {
            id: true,
            title: true,
            status: true,
            organizationId: true,
          },
        },
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        assignedRecruiter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Create initial stage history
    await prisma.applicationStageHistory.create({
      data: {
        applicationId: application.id,
        stage: 'NEW',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return application;
  }

  /**
   * Get all applications with filters
   */
  async getAll(query: QueryApplicationsInput, organizationId?: string) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.jobOpeningId) {
      where.jobOpeningId = query.jobOpeningId;
    }

    if (query.candidateId) {
      where.candidateId = query.candidateId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.currentStage) {
      where.currentStage = query.currentStage;
    }

    if (query.assignedTo) {
      where.assignedTo = query.assignedTo;
    }

    if (query.organizationId || organizationId) {
      where.jobOpening = {
        organizationId: query.organizationId || organizationId,
      };
    }

    if (query.search) {
      where.OR = [
        {
          candidate: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
        {
          jobOpening: {
            title: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appliedDate: 'desc' },
        include: {
          jobOpening: {
            select: {
              id: true,
              title: true,
              status: true,
              organizationId: true,
            },
          },
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              currentCompany: true,
              currentDesignation: true,
            },
          },
          assignedRecruiter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    return {
      data: applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get application by ID
   */
  async getById(id: string) {
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        jobOpening: {
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
          },
        },
        candidate: true,
        assignedRecruiter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        applicationStages: {
          orderBy: { createdAt: 'desc' },
        },
        interviews: {
          orderBy: { round: 'asc' },
        },
        offers: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    return application;
  }

  /**
   * Update application
   */
  async update(id: string, data: UpdateApplicationInput) {
    const application = await this.getById(id);

    // Verify assignee if provided
    if (data.assignedTo) {
      const assignee = await prisma.employee.findUnique({
        where: { id: data.assignedTo },
      });
      if (!assignee) {
        throw new AppError('Assigned recruiter not found', 404);
      }
    }

    const updateData: any = {};

    if (data.currentStage !== undefined) {
      updateData.currentStage = data.currentStage;

      // Create stage history entry
      await prisma.applicationStageHistory.create({
        data: {
          applicationId: id,
          stage: data.currentStage,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });
    }

    if (data.status !== undefined) {
      updateData.status = data.status;

      if (data.status === 'REJECTED' && data.rejectionReason) {
        updateData.rejectionReason = data.rejectionReason;
        updateData.rejectionDate = new Date();
      }

      if (data.status === 'WITHDRAWN' && data.withdrawnReason) {
        updateData.withdrawnReason = data.withdrawnReason;
        updateData.withdrawnDate = new Date();
      }

      if (data.status === 'HIRED') {
        // Update job opening positions filled
        const jobOpening = await prisma.jobOpening.findUnique({
          where: { id: application.jobOpeningId },
        });

        if (jobOpening) {
          await prisma.jobOpening.update({
            where: { id: application.jobOpeningId },
            data: {
              positionsFilled: jobOpening.positionsFilled + 1,
            },
          });
        }
      }
    }

    if (data.recruiterRating !== undefined) updateData.recruiterRating = data.recruiterRating;
    if (data.recruiterNotes !== undefined) updateData.recruiterNotes = data.recruiterNotes;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.rejectionReason !== undefined) updateData.rejectionReason = data.rejectionReason;
    if (data.withdrawnReason !== undefined) updateData.withdrawnReason = data.withdrawnReason;

    const updated = await prisma.application.update({
      where: { id },
      data: updateData,
      include: {
        jobOpening: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedRecruiter: {
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
   * Delete application
   */
  async delete(id: string) {
    await this.getById(id);

    // Check if there are interviews or offers
    const interviewCount = await prisma.interview.count({
      where: { applicationId: id },
    });

    const offerCount = await prisma.offer.count({
      where: { applicationId: id },
    });

    if (interviewCount > 0 || offerCount > 0) {
      throw new AppError('Cannot delete application with existing interviews or offers', 400);
    }

    await prisma.application.delete({
      where: { id },
    });

    return { message: 'Application deleted successfully' };
  }

  /**
   * Update AI insights
   */
  async updateAIInsights(
    id: string,
    insights: {
      aiResumeScore?: number;
      aiSkillMatch?: any;
      aiExperienceMatch?: any;
      aiEducationMatch?: any;
      aiOverallRanking?: number;
      aiSummary?: string;
      aiRecommendations?: any;
    }
  ) {
    await this.getById(id);

    const updateData: any = {};

    if (insights.aiResumeScore !== undefined) updateData.aiResumeScore = insights.aiResumeScore;
    if (insights.aiSkillMatch !== undefined) updateData.aiSkillMatch = insights.aiSkillMatch;
    if (insights.aiExperienceMatch !== undefined) updateData.aiExperienceMatch = insights.aiExperienceMatch;
    if (insights.aiEducationMatch !== undefined) updateData.aiEducationMatch = insights.aiEducationMatch;
    if (insights.aiOverallRanking !== undefined) updateData.aiOverallRanking = insights.aiOverallRanking;
    if (insights.aiSummary !== undefined) updateData.aiSummary = insights.aiSummary;
    if (insights.aiRecommendations !== undefined) updateData.aiRecommendations = insights.aiRecommendations;

    const updated = await prisma.application.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }
}

export const applicationService = new ApplicationService();
