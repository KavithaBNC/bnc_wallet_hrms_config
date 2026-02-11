import { z } from 'zod';

// Check-in Validation
export const checkInSchema = z.object({
  location: z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    address: z.string().optional(),
    ipAddress: z.string().ip().optional(),
  }).optional(),
  notes: z.string().max(500).optional(),
  checkInMethod: z.enum(['WEB', 'MOBILE', 'GEOFENCE', 'BIOMETRIC', 'FACE']).optional(),
});

// Check-out Validation
export const checkOutSchema = z.object({
  location: z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    address: z.string().optional(),
    ipAddress: z.string().ip().optional(),
  }).optional(),
  notes: z.string().max(500).optional(),
});

// Manual punch (Admin/HR): employeeId, date, time; optional punchAt (ISO) = timestamp in user's local → correct timezone
export const manualPunchSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  time: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, 'Invalid time format (HH:mm or HH:mm:ss)'),
  punchAt: z.string().optional(), // ISO timestamp from frontend (user local → UTC) so display matches
});

// Card punch (biometric/kiosk): same engine as face/manual, source CARD
export const cardPunchSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
});

// Attendance Record Query
export const queryAttendanceRecordsSchema = z.object({
  employeeId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKEND']).optional(),
  organizationId: z.string().uuid().optional(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  sortBy: z.enum(['date', 'checkIn', 'checkOut']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Attendance Regularization
export const createRegularizationSchema = z.object({
  attendanceRecordId: z.string().uuid('Invalid attendance record ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Invalid datetime format').optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Invalid datetime format').optional(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason too long'),
  supportingDocuments: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    type: z.string(),
  })).optional(),
});

export const approveRegularizationSchema = z.object({
  reviewComments: z.string().max(500).optional(),
});

export const rejectRegularizationSchema = z.object({
  reviewComments: z.string().min(10, 'Review comments are required').max(500, 'Comments too long'),
});

// Attendance Summary Query
export const queryAttendanceSummarySchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

// Work hours for a single day (punches + total from IN/OUT pairs)
export const queryWorkHoursSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
});

// Punches in date range (for calendar – show all IN/OUT per day)
export const queryPunchesSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  employeeId: z.string().uuid().optional(),
});

export const createCompOffRequestSchema = z.object({
  requestType: z.enum(['FULL_DAY', 'HALF_DAY']),
  reason: z.string().max(500).optional(),
  organizationId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
});

export const queryCompOffSummarySchema = z.object({
  organizationId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
});

export const approveCompOffRequestSchema = z.object({
  reviewComments: z.string().max(500).optional(),
});

export const rejectCompOffRequestSchema = z.object({
  reviewComments: z.string().min(1, 'Review comments are required').max(500),
});

// Attendance Report Query
export const queryAttendanceReportSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  departmentId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
});

// Biometric (eSSL) sync
export const syncBiometricSchema = z
  .object({
    organizationId: z.string().uuid('Invalid organization ID'),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  })
  .refine((d) => d.toDate >= d.fromDate, { message: 'toDate must be on or after fromDate', path: ['toDate'] });

// Bulk Shift Assignments
export const bulkShiftAssignmentsSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  assignments: z.array(z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    shiftName: z.string().min(1, 'Shift name is required'),
  })).min(1, 'At least one assignment is required'),
});

// Types
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type QueryAttendanceRecordsInput = z.infer<typeof queryAttendanceRecordsSchema>;
export type CreateRegularizationInput = z.infer<typeof createRegularizationSchema>;
export type ApproveRegularizationInput = z.infer<typeof approveRegularizationSchema>;
export type RejectRegularizationInput = z.infer<typeof rejectRegularizationSchema>;
export type QueryAttendanceSummaryInput = z.infer<typeof queryAttendanceSummarySchema>;
export type QueryAttendanceReportInput = z.infer<typeof queryAttendanceReportSchema>;
export type SyncBiometricInput = z.infer<typeof syncBiometricSchema>;
export type BulkShiftAssignmentsInput = z.infer<typeof bulkShiftAssignmentsSchema>;
export type CreateCompOffRequestInput = z.infer<typeof createCompOffRequestSchema>;
