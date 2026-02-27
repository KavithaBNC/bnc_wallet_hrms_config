import { z } from 'zod';

// ============================================================================
// JOB OPENING VALIDATION
// ============================================================================

export const createJobOpeningSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  positionId: z.string().uuid('Invalid position ID').optional(),
  title: z.string().min(1, 'Title is required').max(255),
  departmentId: z.string().uuid('Invalid department ID').optional(),
  hiringManagerId: z.string().uuid('Invalid hiring manager ID').optional(),
  recruiters: z.array(z.string().uuid()).optional(),

  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  jobType: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
  location: z.string().max(255).optional(),

  experienceRequired: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),

  salaryRange: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
    })
    .optional(),

  description: z.string().min(1, 'Description is required'),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  skillsRequired: z.array(z.string()).optional(),
  qualifications: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),

  numberOfPositions: z.number().int().min(1).default(1),
  status: z.enum(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED']).default('DRAFT'),

  postingDate: z.string().date().optional(),
  applicationDeadline: z.string().date().optional(),
  targetClosureDate: z.string().date().optional(),

  applicationFormFields: z.record(z.any()).optional(),
  screeningQuestions: z.array(z.any()).optional(),

  internalJob: z.boolean().default(false),
  isConfidential: z.boolean().default(false),
});

export const updateJobOpeningSchema = createJobOpeningSchema.partial();

export const queryJobOpeningsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED']).optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  hiringManagerId: z.string().uuid().optional(),
  jobType: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('10'),
});

export type CreateJobOpeningInput = z.infer<typeof createJobOpeningSchema>;
export type UpdateJobOpeningInput = z.infer<typeof updateJobOpeningSchema>;
export type QueryJobOpeningsInput = z.infer<typeof queryJobOpeningsSchema>;

// ============================================================================
// CANDIDATE VALIDATION
// ============================================================================

export const createCandidateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(20).optional(),
  alternatePhone: z.string().max(20).optional(),
  currentLocation: z.string().max(255).optional(),
  preferredLocations: z.array(z.string()).optional(),

  // Professional Info
  currentCompany: z.string().max(255).optional(),
  currentDesignation: z.string().max(255).optional(),
  totalExperienceYears: z.number().min(0).max(100).optional(),
  relevantExperienceYears: z.number().min(0).max(100).optional(),
  currentSalary: z.number().min(0).optional(),
  expectedSalary: z.number().min(0).optional(),
  noticePeriod: z.number().int().min(0).optional(),

  // Education
  highestQualification: z.string().max(255).optional(),
  education: z.array(z.any()).optional(),
  certifications: z.array(z.any()).optional(),
  skills: z.array(z.string()).optional(),

  // Online Profiles
  linkedinUrl: z.string().url().max(500).optional().or(z.literal('')),
  portfolioUrl: z.string().url().max(500).optional().or(z.literal('')),
  githubUrl: z.string().url().max(500).optional().or(z.literal('')),
  otherProfiles: z.record(z.any()).optional(),

  // Resume
  resumeUrl: z.string().url().max(500).optional().or(z.literal('')),

  // Source
  source: z
    .enum(['CAREER_SITE', 'JOB_PORTAL', 'REFERRAL', 'LINKEDIN', 'AGENCY', 'WALK_IN', 'OTHER'])
    .optional(),
  sourceDetails: z.record(z.any()).optional(),
  referredBy: z.string().uuid('Invalid referrer ID').optional(),

  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const updateCandidateSchema = createCandidateSchema.partial();

export const queryCandidatesSchema = z.object({
  search: z.string().optional(),
  source: z
    .enum(['CAREER_SITE', 'JOB_PORTAL', 'REFERRAL', 'LINKEDIN', 'AGENCY', 'WALK_IN', 'OTHER'])
    .optional(),
  referredBy: z.string().uuid().optional(),
  minExperience: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  maxExperience: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  skills: z.string().optional(), // Comma-separated
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('10'),
});

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
export type QueryCandidatesInput = z.infer<typeof queryCandidatesSchema>;

// ============================================================================
// APPLICATION VALIDATION
// ============================================================================

export const createApplicationSchema = z.object({
  jobOpeningId: z.string().uuid('Invalid job opening ID'),
  candidateId: z.string().uuid('Invalid candidate ID'),
  coverLetter: z.string().optional(),
  screeningAnswers: z.record(z.any()).optional(),
  assignedTo: z.string().uuid('Invalid assignee ID').optional(),
});

export const updateApplicationSchema = z.object({
  currentStage: z
    .enum([
      'NEW',
      'SCREENING',
      'PHONE_SCREEN',
      'ASSESSMENT',
      'INTERVIEW_1',
      'INTERVIEW_2',
      'INTERVIEW_3',
      'HR_ROUND',
      'OFFER',
      'HIRED',
      'REJECTED',
      'WITHDRAWN',
    ])
    .optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'REJECTED', 'HIRED', 'WITHDRAWN']).optional(),
  recruiterRating: z.number().min(0).max(5).optional(),
  recruiterNotes: z.string().optional(),
  assignedTo: z.string().uuid('Invalid assignee ID').optional(),
  rejectionReason: z.string().optional(),
  withdrawnReason: z.string().optional(),
});

export const queryApplicationsSchema = z.object({
  jobOpeningId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'REJECTED', 'HIRED', 'WITHDRAWN']).optional(),
  currentStage: z
    .enum([
      'NEW',
      'SCREENING',
      'PHONE_SCREEN',
      'ASSESSMENT',
      'INTERVIEW_1',
      'INTERVIEW_2',
      'INTERVIEW_3',
      'HR_ROUND',
      'OFFER',
      'HIRED',
      'REJECTED',
      'WITHDRAWN',
    ])
    .optional(),
  assignedTo: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('10'),
});

export const processResumeSchema = z.object({
  resumeUrl: z.string().url('Invalid resume URL'),
  jobOpeningId: z.string().uuid('Invalid job opening ID').optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type QueryApplicationsInput = z.infer<typeof queryApplicationsSchema>;
export type ProcessResumeInput = z.infer<typeof processResumeSchema>;

// ============================================================================
// INTERVIEW VALIDATION
// ============================================================================

export const createInterviewSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  jobOpeningId: z.string().uuid('Invalid job opening ID'),
  candidateId: z.string().uuid('Invalid candidate ID'),
  round: z.number().int().min(1),
  type: z.enum(['PHONE', 'VIDEO', 'IN_PERSON', 'TECHNICAL', 'HR', 'CULTURAL_FIT', 'PANEL']).optional(),
  title: z.string().min(1, 'Title is required').max(255),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  meetingLink: z.string().url().max(500).optional().or(z.literal('')),
  location: z.string().max(255).optional(),
  interviewers: z.array(z.string().uuid()).optional(),
  interviewPanel: z.array(z.any()).optional(),
});

export const updateInterviewSchema = z.object({
  type: z.enum(['PHONE', 'VIDEO', 'IN_PERSON', 'TECHNICAL', 'HR', 'CULTURAL_FIT', 'PANEL']).optional(),
  title: z.string().min(1).max(255).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  meetingLink: z.string().url().max(500).optional().or(z.literal('')),
  location: z.string().max(255).optional(),
  interviewers: z.array(z.string().uuid()).optional(),
  interviewPanel: z.array(z.any()).optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  cancellationReason: z.string().optional(),
});

export const submitInterviewFeedbackSchema = z.object({
  feedback: z.array(
    z.object({
      interviewerId: z.string().uuid(),
      rating: z.number().min(0).max(5),
      comments: z.string().optional(),
      skillsAssessed: z.record(z.number().min(0).max(5)).optional(),
    })
  ),
  overallRating: z.number().min(0).max(5).optional(),
  recommendation: z.enum(['STRONG_YES', 'YES', 'MAYBE', 'NO', 'STRONG_NO']).optional(),
});

export const queryInterviewsSchema = z.object({
  applicationId: z.string().uuid().optional(),
  jobOpeningId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  type: z.enum(['PHONE', 'VIDEO', 'IN_PERSON', 'TECHNICAL', 'HR', 'CULTURAL_FIT', 'PANEL']).optional(),
  interviewerId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('10'),
});

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
export type SubmitInterviewFeedbackInput = z.infer<typeof submitInterviewFeedbackSchema>;
export type QueryInterviewsInput = z.infer<typeof queryInterviewsSchema>;

// ============================================================================
// OFFER VALIDATION
// ============================================================================

export const createOfferSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  candidateId: z.string().uuid('Invalid candidate ID'),
  jobOpeningId: z.string().uuid('Invalid job opening ID'),
  offerLetterUrl: z.string().url().max(500).optional().or(z.literal('')),
  offeredPosition: z.string().min(1, 'Offered position is required').max(255),
  offeredSalary: z.number().min(0, 'Offered salary must be positive'),
  salaryComponents: z.record(z.any()).optional(),
  benefits: z.array(z.string()).optional(),
  joiningBonus: z.number().min(0).optional(),
  relocationAssistance: z.number().min(0).optional(),
  offeredDate: z.string().date('Invalid offered date'),
  validUntil: z.string().date('Invalid valid until date'),
  expectedJoiningDate: z.string().date().optional(),
});

export const updateOfferSchema = z.object({
  offerLetterUrl: z.string().url().max(500).optional().or(z.literal('')),
  offeredPosition: z.string().min(1).max(255).optional(),
  offeredSalary: z.number().min(0).optional(),
  salaryComponents: z.record(z.any()).optional(),
  benefits: z.array(z.string()).optional(),
  joiningBonus: z.number().min(0).optional(),
  relocationAssistance: z.number().min(0).optional(),
  validUntil: z.string().date().optional(),
  expectedJoiningDate: z.string().date().optional(),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'NEGOTIATING', 'EXPIRED']).optional(),
  rejectionReason: z.string().optional(),
  negotiationNotes: z.string().optional(),
});

export const acceptOfferSchema = z.object({
  expectedJoiningDate: z.string().date().optional(),
});

export const rejectOfferSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

export const queryOffersSchema = z.object({
  applicationId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  jobOpeningId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'NEGOTIATING', 'EXPIRED']).optional(),
  organizationId: z.string().uuid().optional(),
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('10'),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
export type AcceptOfferInput = z.infer<typeof acceptOfferSchema>;
export type RejectOfferInput = z.infer<typeof rejectOfferSchema>;
export type QueryOffersInput = z.infer<typeof queryOffersSchema>;
