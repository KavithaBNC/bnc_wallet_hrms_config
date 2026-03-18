
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import {
  CreateInterviewInput,
  UpdateInterviewInput,
  SubmitInterviewFeedbackInput,
  QueryInterviewsInput,
} from '../utils/ats.validation';

export class InterviewService {
  /**
   * Create new interview
   */
  async create(data: CreateInterviewInput, userId: string) {
    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id: data.applicationId },
    });

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    // Verify job opening exists
    const jobOpening = await prisma.jobOpening.findUnique({
      where: { id: data.jobOpeningId },
    });

    if (!jobOpening) {
      throw new AppError('Job opening not found', 404);
    }

    // Verify candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: data.candidateId },
    });

    if (!candidate) {
      throw new AppError('Candidate not found', 404);
    }

    // Verify application belongs to job opening and candidate
    if (
      application.jobOpeningId !== data.jobOpeningId ||
      application.candidateId !== data.candidateId
    ) {
      throw new AppError('Application does not match job opening and candidate', 400);
    }

    // Verify interviewers if provided
    if (data.interviewers && data.interviewers.length > 0) {
      for (const interviewerId of data.interviewers) {
        const interviewer = await prisma.employee.findUnique({
          where: { id: interviewerId },
        });
        if (!interviewer) {
          throw new AppError(`Interviewer with ID ${interviewerId} not found`, 404);
        }
      }
    }

    const interview = await prisma.interview.create({
      data: {
        applicationId: data.applicationId,
        jobOpeningId: data.jobOpeningId,
        candidateId: data.candidateId,
        round: data.round,
        type: data.type,
        title: data.title,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        durationMinutes: data.durationMinutes,
        meetingLink: data.meetingLink || null,
        location: data.location,
        interviewers: data.interviewers || [],
        interviewPanel: data.interviewPanel || [],
        status: 'SCHEDULED',
        createdBy: userId,
      },
      include: {
        application: {
          select: {
            id: true,
            currentStage: true,
            status: true,
          },
        },
        jobOpening: {
          select: {
            id: true,
            title: true,
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
      },
    });

    return interview;
  }

  /**
   * Get all interviews with filters
   */
  async getAll(query: QueryInterviewsInput, organizationId?: string) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.applicationId) {
      where.applicationId = query.applicationId;
    }

    if (query.jobOpeningId) {
      where.jobOpeningId = query.jobOpeningId;
    }

    if (query.candidateId) {
      where.candidateId = query.candidateId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.interviewerId) {
      where.interviewers = {
        array_contains: [query.interviewerId],
      };
    }

    if (query.startDate && query.endDate) {
      where.scheduledAt = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      };
    } else if (query.startDate) {
      where.scheduledAt = {
        gte: new Date(query.startDate),
      };
    } else if (query.endDate) {
      where.scheduledAt = {
        lte: new Date(query.endDate),
      };
    }

    if (organizationId) {
      where.jobOpening = {
        organizationId: organizationId,
      };
    }

    const [interviews, total] = await Promise.all([
      prisma.interview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          application: {
            select: {
              id: true,
              currentStage: true,
              status: true,
            },
          },
          jobOpening: {
            select: {
              id: true,
              title: true,
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
        },
      }),
      prisma.interview.count({ where }),
    ]);

    return {
      data: interviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get interview by ID
   */
  async getById(id: string) {
    const interview = await prisma.interview.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            jobOpening: {
              select: {
                id: true,
                title: true,
                organizationId: true,
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
          },
        },
        jobOpening: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        candidate: true,
      },
    });

    if (!interview) {
      throw new AppError('Interview not found', 404);
    }

    return interview;
  }

  /**
   * Update interview
   */
  async update(id: string, data: UpdateInterviewInput) {
    const interview = await this.getById(id);

    // Verify interviewers if provided
    if (data.interviewers && data.interviewers.length > 0) {
      for (const interviewerId of data.interviewers) {
        const interviewer = await prisma.employee.findUnique({
          where: { id: interviewerId },
        });
        if (!interviewer) {
          throw new AppError(`Interviewer with ID ${interviewerId} not found`, 404);
        }
      }
    }

    const updateData: any = {};

    if (data.type !== undefined) updateData.type = data.type;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
    if (data.meetingLink !== undefined) updateData.meetingLink = data.meetingLink || null;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.interviewers !== undefined) updateData.interviewers = data.interviewers;
    if (data.interviewPanel !== undefined) updateData.interviewPanel = data.interviewPanel;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.cancellationReason !== undefined) updateData.cancellationReason = data.cancellationReason;

    // Increment reschedule count if status changed to SCHEDULED from another status
    if (data.status === 'SCHEDULED' && interview.status !== 'SCHEDULED') {
      updateData.rescheduleCount = interview.rescheduleCount + 1;
    }

    const updated = await prisma.interview.update({
      where: { id },
      data: updateData,
      include: {
        application: {
          select: {
            id: true,
            currentStage: true,
          },
        },
        jobOpening: {
          select: {
            id: true,
            title: true,
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
      },
    });

    return updated;
  }

  /**
   * Submit interview feedback
   */
  async submitFeedback(id: string, data: SubmitInterviewFeedbackInput) {
    const interview = await this.getById(id);

    if (interview.status !== 'COMPLETED') {
      throw new AppError('Interview must be completed before submitting feedback', 400);
    }

    // Calculate overall rating if not provided
    let overallRating = data.overallRating;
    if (!overallRating && data.feedback && data.feedback.length > 0) {
        const ratings = data.feedback.map((f) => f.rating).filter((r) => r !== undefined) as number[];
        if (ratings.length > 0) {
          overallRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        }
    }

    const updated = await prisma.interview.update({
      where: { id },
      data: {
        feedback: data.feedback,
        overallRating: overallRating,
        recommendation: data.recommendation,
        status: 'COMPLETED',
      },
      include: {
        application: {
          select: {
            id: true,
            currentStage: true,
          },
        },
        jobOpening: {
          select: {
            id: true,
            title: true,
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
      },
    });

    // Update application overall rating
    if (overallRating) {
      const application = await prisma.application.findUnique({
        where: { id: interview.applicationId },
        include: {
          interviews: {
            where: {
              status: 'COMPLETED',
              overallRating: { not: null },
            },
          },
        },
      });

      if (application && application.interviews.length > 0) {
        const allRatings = application.interviews
          .map((i) => i.overallRating)
          .filter((r) => r !== null)
          .map((r) => Number(r));

        if (allRatings.length > 0) {
          const avgRating = allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length;

          await prisma.application.update({
            where: { id: interview.applicationId },
            data: {
              overallRating: avgRating,
            },
          });
        }
      }
    }

    return updated;
  }

  /**
   * Delete interview
   */
  async delete(id: string) {
    await this.getById(id);

    await prisma.interview.delete({
      where: { id },
    });

    return { message: 'Interview deleted successfully' };
  }
}

export const interviewService = new InterviewService();
