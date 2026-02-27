
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import {
  CreateCandidateInput,
  UpdateCandidateInput,
  QueryCandidatesInput,
} from '../utils/ats.validation';

export class CandidateService {
  /**
   * Create new candidate
   */
  async create(data: CreateCandidateInput) {
    // Check if candidate with email already exists
    const existingCandidate = await prisma.candidate.findUnique({
      where: { email: data.email },
    });

    if (existingCandidate) {
      throw new AppError('Candidate with this email already exists', 409);
    }

    // Verify referrer if provided
    if (data.referredBy) {
      const referrer = await prisma.employee.findUnique({
        where: { id: data.referredBy },
      });
      if (!referrer) {
        throw new AppError('Referrer not found', 404);
      }
    }

    const candidate = await prisma.candidate.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        alternatePhone: data.alternatePhone,
        currentLocation: data.currentLocation,
        preferredLocations: data.preferredLocations || [],
        currentCompany: data.currentCompany,
        currentDesignation: data.currentDesignation,
        totalExperienceYears: data.totalExperienceYears,
        relevantExperienceYears: data.relevantExperienceYears,
        currentSalary: data.currentSalary,
        expectedSalary: data.expectedSalary,
        noticePeriod: data.noticePeriod,
        highestQualification: data.highestQualification,
        education: data.education || [],
        certifications: data.certifications || [],
        skills: data.skills || [],
        linkedinUrl: data.linkedinUrl || null,
        portfolioUrl: data.portfolioUrl || null,
        githubUrl: data.githubUrl || null,
        otherProfiles: data.otherProfiles,
        resumeUrl: data.resumeUrl || null,
        source: data.source,
        sourceDetails: data.sourceDetails,
        referredBy: data.referredBy,
        tags: data.tags || [],
        notes: data.notes,
      },
      include: {
        referrer: {
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
    });

    return candidate;
  }

  /**
   * Get all candidates with filters
   */
  async getAll(query: QueryCandidatesInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.source) {
      where.source = query.source;
    }

    if (query.referredBy) {
      where.referredBy = query.referredBy;
    }

    if (query.minExperience) {
      where.totalExperienceYears = {
        gte: parseFloat(query.minExperience),
      };
    }

    if (query.maxExperience) {
      where.totalExperienceYears = {
        ...where.totalExperienceYears,
        lte: parseFloat(query.maxExperience),
      };
    }

    if (query.skills) {
      const skillsArray = query.skills.split(',').map((s) => s.trim());
      where.skills = {
        hasSome: skillsArray,
      };
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { currentCompany: { contains: query.search, mode: 'insensitive' } },
        { currentDesignation: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          referrer: {
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
      prisma.candidate.count({ where }),
    ]);

    return {
      data: candidates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get candidate by ID
   */
  async getById(id: string) {
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        referrer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
        applications: {
          include: {
            jobOpening: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
          orderBy: { appliedDate: 'desc' },
        },
        _count: {
          select: {
            applications: true,
            interviews: true,
            offers: true,
          },
        },
      },
    });

    if (!candidate) {
      throw new AppError('Candidate not found', 404);
    }

    return candidate;
  }

  /**
   * Get candidate by email
   */
  async getByEmail(email: string) {
    const candidate = await prisma.candidate.findUnique({
      where: { email },
      include: {
        referrer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        applications: {
          include: {
            jobOpening: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return candidate;
  }

  /**
   * Update candidate
   */
  async update(id: string, data: UpdateCandidateInput) {
    const candidate = await this.getById(id);

    // Check email uniqueness if email is being updated
    if (data.email && data.email !== candidate.email) {
      const existingCandidate = await prisma.candidate.findUnique({
        where: { email: data.email },
      });

      if (existingCandidate) {
        throw new AppError('Candidate with this email already exists', 409);
      }
    }

    // Verify referrer if provided
    if (data.referredBy) {
      const referrer = await prisma.employee.findUnique({
        where: { id: data.referredBy },
      });
      if (!referrer) {
        throw new AppError('Referrer not found', 404);
      }
    }

    const updateData: any = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.alternatePhone !== undefined) updateData.alternatePhone = data.alternatePhone;
    if (data.currentLocation !== undefined) updateData.currentLocation = data.currentLocation;
    if (data.preferredLocations !== undefined) updateData.preferredLocations = data.preferredLocations;
    if (data.currentCompany !== undefined) updateData.currentCompany = data.currentCompany;
    if (data.currentDesignation !== undefined) updateData.currentDesignation = data.currentDesignation;
    if (data.totalExperienceYears !== undefined) updateData.totalExperienceYears = data.totalExperienceYears;
    if (data.relevantExperienceYears !== undefined) updateData.relevantExperienceYears = data.relevantExperienceYears;
    if (data.currentSalary !== undefined) updateData.currentSalary = data.currentSalary;
    if (data.expectedSalary !== undefined) updateData.expectedSalary = data.expectedSalary;
    if (data.noticePeriod !== undefined) updateData.noticePeriod = data.noticePeriod;
    if (data.highestQualification !== undefined) updateData.highestQualification = data.highestQualification;
    if (data.education !== undefined) updateData.education = data.education;
    if (data.certifications !== undefined) updateData.certifications = data.certifications;
    if (data.skills !== undefined) updateData.skills = data.skills;
    if (data.linkedinUrl !== undefined) updateData.linkedinUrl = data.linkedinUrl || null;
    if (data.portfolioUrl !== undefined) updateData.portfolioUrl = data.portfolioUrl || null;
    if (data.githubUrl !== undefined) updateData.githubUrl = data.githubUrl || null;
    if (data.otherProfiles !== undefined) updateData.otherProfiles = data.otherProfiles;
    if (data.resumeUrl !== undefined) updateData.resumeUrl = data.resumeUrl || null;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.sourceDetails !== undefined) updateData.sourceDetails = data.sourceDetails;
    if (data.referredBy !== undefined) updateData.referredBy = data.referredBy;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.candidate.update({
      where: { id },
      data: updateData,
      include: {
        referrer: {
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
   * Delete candidate
   */
  async delete(id: string) {
    await this.getById(id);

    // Check if there are any applications
    const applicationCount = await prisma.application.count({
      where: { candidateId: id },
    });

    if (applicationCount > 0) {
      throw new AppError('Cannot delete candidate with existing applications', 400);
    }

    await prisma.candidate.delete({
      where: { id },
    });

    return { message: 'Candidate deleted successfully' };
  }

  /**
   * Update resume parsed data
   */
  async updateResumeParsedData(id: string, parsedData: any) {
    await this.getById(id);

    const updated = await prisma.candidate.update({
      where: { id },
      data: {
        resumeParsedData: parsedData,
      },
    });

    return updated;
  }
}

export const candidateService = new CandidateService();
