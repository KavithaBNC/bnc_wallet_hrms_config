
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import {
  CreateOfferInput,
  UpdateOfferInput,
  AcceptOfferInput,
  RejectOfferInput,
  QueryOffersInput,
} from '../utils/ats.validation';

export class OfferService {
  /**
   * Create new offer
   */
  async create(data: CreateOfferInput, userId: string) {
    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id: data.applicationId },
    });

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    // Verify candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: data.candidateId },
    });

    if (!candidate) {
      throw new AppError('Candidate not found', 404);
    }

    // Verify job opening exists
    const jobOpening = await prisma.jobOpening.findUnique({
      where: { id: data.jobOpeningId },
    });

    if (!jobOpening) {
      throw new AppError('Job opening not found', 404);
    }

    // Verify application belongs to job opening and candidate
    if (
      application.jobOpeningId !== data.jobOpeningId ||
      application.candidateId !== data.candidateId
    ) {
      throw new AppError('Application does not match job opening and candidate', 400);
    }

    // Check if offer already exists for this application
    const existingOffer = await prisma.offer.findFirst({
      where: {
        applicationId: data.applicationId,
        status: {
          notIn: ['REJECTED', 'EXPIRED'],
        },
      },
    });

    if (existingOffer) {
      throw new AppError('Active offer already exists for this application', 409);
    }

    // Validate dates
    const offeredDate = new Date(data.offeredDate);
    const validUntil = new Date(data.validUntil);

    if (validUntil <= offeredDate) {
      throw new AppError('Valid until date must be after offered date', 400);
    }

    const offer = await prisma.offer.create({
      data: {
        applicationId: data.applicationId,
        candidateId: data.candidateId,
        jobOpeningId: data.jobOpeningId,
        offerLetterUrl: data.offerLetterUrl || null,
        offeredPosition: data.offeredPosition,
        offeredSalary: data.offeredSalary,
        salaryComponents: data.salaryComponents,
        benefits: data.benefits || [],
        joiningBonus: data.joiningBonus,
        relocationAssistance: data.relocationAssistance,
        offeredDate: offeredDate,
        validUntil: validUntil,
        expectedJoiningDate: data.expectedJoiningDate ? new Date(data.expectedJoiningDate) : null,
        status: 'DRAFT',
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
    });

    return offer;
  }

  /**
   * Get all offers with filters
   */
  async getAll(query: QueryOffersInput, organizationId?: string) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.applicationId) {
      where.applicationId = query.applicationId;
    }

    if (query.candidateId) {
      where.candidateId = query.candidateId;
    }

    if (query.jobOpeningId) {
      where.jobOpeningId = query.jobOpeningId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.organizationId || organizationId) {
      where.jobOpening = {
        organizationId: query.organizationId || organizationId,
      };
    }

    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      prisma.offer.count({ where }),
    ]);

    return {
      data: offers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get offer by ID
   */
  async getById(id: string) {
    const offer = await prisma.offer.findUnique({
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

    if (!offer) {
      throw new AppError('Offer not found', 404);
    }

    return offer;
  }

  /**
   * Update offer
   */
  async update(id: string, data: UpdateOfferInput) {
    const offer = await this.getById(id);

    // Validate dates if provided
    if (data.validUntil) {
      const validUntil = new Date(data.validUntil);
      const offeredDate = offer.offeredDate;

      if (validUntil <= offeredDate) {
        throw new AppError('Valid until date must be after offered date', 400);
      }
    }

    const updateData: any = {};

    if (data.offerLetterUrl !== undefined) updateData.offerLetterUrl = data.offerLetterUrl || null;
    if (data.offeredPosition !== undefined) updateData.offeredPosition = data.offeredPosition;
    if (data.offeredSalary !== undefined) updateData.offeredSalary = data.offeredSalary;
    if (data.salaryComponents !== undefined) updateData.salaryComponents = data.salaryComponents;
    if (data.benefits !== undefined) updateData.benefits = data.benefits;
    if (data.joiningBonus !== undefined) updateData.joiningBonus = data.joiningBonus;
    if (data.relocationAssistance !== undefined) updateData.relocationAssistance = data.relocationAssistance;
    if (data.validUntil !== undefined) updateData.validUntil = new Date(data.validUntil);
    if (data.expectedJoiningDate !== undefined)
      updateData.expectedJoiningDate = data.expectedJoiningDate ? new Date(data.expectedJoiningDate) : null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.rejectionReason !== undefined) updateData.rejectionReason = data.rejectionReason;
    if (data.negotiationNotes !== undefined) updateData.negotiationNotes = data.negotiationNotes;

    const updated = await prisma.offer.update({
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
   * Send offer
   */
  async send(id: string) {
    const offer = await this.getById(id);

    if (offer.status !== 'DRAFT') {
      throw new AppError('Only draft offers can be sent', 400);
    }

    const updated = await prisma.offer.update({
      where: { id },
      data: {
        status: 'SENT',
      },
    });

    // Update application stage
    await prisma.application.update({
      where: { id: offer.applicationId },
      data: {
        currentStage: 'OFFER',
      },
    });

    return updated;
  }

  /**
   * Accept offer
   */
  async accept(id: string, data: AcceptOfferInput) {
    const offer = await this.getById(id);

    if (offer.status !== 'SENT' && offer.status !== 'VIEWED') {
      throw new AppError('Offer must be sent or viewed before acceptance', 400);
    }

    // Check if offer is expired
    if (new Date() > offer.validUntil) {
      throw new AppError('Offer has expired', 400);
    }

    const updated = await prisma.offer.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        acceptedDate: new Date(),
        expectedJoiningDate: data.expectedJoiningDate ? new Date(data.expectedJoiningDate) : offer.expectedJoiningDate,
      },
    });

    // Update application
    await prisma.application.update({
      where: { id: offer.applicationId },
      data: {
        currentStage: 'HIRED',
        status: 'HIRED',
      },
    });

    return updated;
  }

  /**
   * Reject offer
   */
  async reject(id: string, data: RejectOfferInput) {
    const offer = await this.getById(id);

    if (offer.status !== 'SENT' && offer.status !== 'VIEWED') {
      throw new AppError('Offer must be sent or viewed before rejection', 400);
    }

    const updated = await prisma.offer.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedDate: new Date(),
        rejectionReason: data.rejectionReason,
      },
    });

    // Update application
    await prisma.application.update({
      where: { id: offer.applicationId },
      data: {
        currentStage: 'REJECTED',
        status: 'REJECTED',
        rejectionReason: data.rejectionReason,
        rejectionDate: new Date(),
      },
    });

    return updated;
  }

  /**
   * Delete offer
   */
  async delete(id: string) {
    const offer = await this.getById(id);

    if (offer.status === 'ACCEPTED') {
      throw new AppError('Cannot delete accepted offer', 400);
    }

    await prisma.offer.delete({
      where: { id },
    });

    return { message: 'Offer deleted successfully' };
  }
}

export const offerService = new OfferService();
