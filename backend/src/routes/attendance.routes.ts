import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import { attendanceController } from '../controllers/attendance.controller';
import { attendanceRegularizationController } from '../controllers/attendance-regularization.controller';
import {
  checkInSchema,
  checkOutSchema,
  manualPunchSchema,
  cardPunchSchema,
  queryAttendanceRecordsSchema,
  queryMonthlyDetailsSchema,
  queryAttendanceSummarySchema,
  queryAttendanceReportSchema,
  queryWorkHoursSchema,
  queryPunchesSchema,
  syncBiometricSchema,
  createRegularizationSchema,
  approveRegularizationSchema,
  rejectRegularizationSchema,
  bulkShiftAssignmentsSchema,
  createCompOffRequestSchema,
  createCompOffConvertRequestSchema,
  queryCompOffSummarySchema,
  queryCompOffRequestsSchema,
  queryCompOffRequestDetailsSchema,
  approveCompOffRequestSchema,
  rejectCompOffRequestSchema,
  queryValidationProcessCalendarSchema,
  runValidationProcessSchema,
  queryValidationProcessEmployeeListSchema,
} from '../utils/attendance.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/attendance/check-in
 * @desc    Check-in
 * @access  Private (All authenticated users)
 */
router.post(
  '/check-in',
  validate(checkInSchema),
  attendanceController.checkIn.bind(attendanceController)
);

/**
 * @route   POST /api/v1/attendance/check-out
 * @desc    Check-out
 * @access  Private (All authenticated users)
 */
router.post(
  '/check-out',
  validate(checkOutSchema),
  attendanceController.checkOut.bind(attendanceController)
);

/**
 * @route   POST /api/v1/attendance/face-punch
 * @desc    Face punch: base64 image → match employee → processAttendancePunch(employeeId, 'FACE')
 * @access  Private (any authenticated user; org from user profile or body)
 */
router.post('/face-punch', attendanceController.facePunch.bind(attendanceController));

/**
 * @route   POST /api/v1/attendance/manual
 * @desc    Manual punch: Admin/HR records IN/OUT for employee at date/time (same engine, source MANUAL)
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/manual',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(manualPunchSchema),
  attendanceController.manualPunch.bind(attendanceController)
);

/**
 * @route   POST /api/v1/attendance/card
 * @desc    Card/biometric punch: processAttendancePunch(employeeId, 'CARD') at current time
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER) for kiosk/integration
 */
router.post(
  '/card',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(cardPunchSchema),
  attendanceController.cardPunch.bind(attendanceController)
);

/**
 * @route   GET /api/v1/attendance/punches
 * @desc    Get all IN/OUT punches in date range (for calendar – show every punch)
 * @access  Private (own punches or HR/Manager with employeeId)
 */
router.get(
  '/punches',
  validateQuery(queryPunchesSchema),
  attendanceController.getPunches.bind(attendanceController)
);

// Enforce organization access for routes that need organization filtering
router.use(enforceOrganizationAccess);

/**
 * @route   GET /api/v1/attendance/records
 * @desc    Get attendance records
 * @access  Private (All authenticated users - filtered by role)
 */
router.get(
  '/records',
  validateQuery(queryAttendanceRecordsSchema),
  attendanceController.getRecords.bind(attendanceController)
);

/**
 * @route   GET /api/v1/attendance/monthly-details
 * @desc    Get monthly details for calendar sidebar (from attendance components + leave balance + records)
 * @access  Private
 */
router.get(
  '/monthly-details',
  validateQuery(queryMonthlyDetailsSchema),
  attendanceController.getMonthlyDetails.bind(attendanceController)
);

/**
 * @route   GET /api/v1/attendance/validation-process/calendar-summary
 * @desc    Get validation process calendar summary from stored results (daily counts)
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/validation-process/calendar-summary',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validateQuery(queryValidationProcessCalendarSchema),
  attendanceController.getValidationProcessCalendarSummary.bind(attendanceController)
);

/**
 * @route   POST /api/v1/attendance/validation-process/run
 * @desc    Run validation process: fetch employees, attendance, apply rules, store results, return aggregated
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/validation-process/run',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(runValidationProcessSchema),
  attendanceController.runValidationProcess.bind(attendanceController)
);

/**
 * @route   GET /api/v1/attendance/validation-process/employee-list
 * @desc    Get validation process employee list by type and date range (for Employee Grid)
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/validation-process/employee-list',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validateQuery(queryValidationProcessEmployeeListSchema),
  attendanceController.getValidationProcessEmployeeList.bind(attendanceController)
);

/**
 * @route   GET /api/v1/attendance/summary/:employeeId/work-hours
 * @desc    Get total work hours for a day from IN/OUT punches (pairs IN with next OUT; last IN counts until now)
 * @access  Private (All authenticated users)
 */
router.get(
  '/summary/:employeeId/work-hours',
  validateQuery(queryWorkHoursSchema),
  attendanceController.getWorkHoursForDay.bind(attendanceController)
);

/**
 * @route   GET /api/v1/attendance/summary/:employeeId
 * @desc    Get attendance summary for employee
 * @access  Private (All authenticated users)
 */
router.get(
  '/summary/:employeeId',
  validateQuery(queryAttendanceSummarySchema),
  attendanceController.getSummary.bind(attendanceController)
);

/**
 * @route   GET /api/v1/attendance/comp-off/summary
 * @desc    Get comp off excess-time summary for logged-in employee
 * @access  Private (All authenticated users)
 */
router.get(
  '/comp-off/summary',
  validateQuery(queryCompOffSummarySchema),
  attendanceController.getCompOffSummary.bind(attendanceController)
);

router.get(
  '/comp-off/requests',
  validateQuery(queryCompOffRequestsSchema),
  attendanceController.getCompOffRequests.bind(attendanceController)
);

router.get(
  '/comp-off/requests/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  validateQuery(queryCompOffRequestDetailsSchema),
  attendanceController.getCompOffRequestDetails.bind(attendanceController)
);

/**
 * @route   POST /api/v1/attendance/comp-off/requests
 * @desc    Create comp off request (manual request by employee)
 * @access  Private (All authenticated users)
 */
router.post(
  '/comp-off/requests',
  validate(createCompOffRequestSchema),
  attendanceController.createCompOffRequest.bind(attendanceController)
);

router.post(
  '/comp-off/requests/convert',
  validate(createCompOffConvertRequestSchema),
  attendanceController.convertCompOffRequest.bind(attendanceController)
);

/**
 * @route   PUT /api/v1/attendance/comp-off/requests/:id/approve
 * @desc    Approve comp off request
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER)
 */
router.put(
  '/comp-off/requests/:id/approve',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  validate(approveCompOffRequestSchema),
  attendanceController.approveCompOffRequest.bind(attendanceController)
);

/**
 * @route   PUT /api/v1/attendance/comp-off/requests/:id/reject
 * @desc    Reject comp off request
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER)
 */
router.put(
  '/comp-off/requests/:id/reject',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  validate(rejectCompOffRequestSchema),
  attendanceController.rejectCompOffRequest.bind(attendanceController)
);

/**
 * @route   GET /api/v1/attendance/reports
 * @desc    Get attendance report
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/reports',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validateQuery(queryAttendanceReportSchema),
  attendanceController.getReport.bind(attendanceController)
);

/**
 * @route   POST /api/v1/attendance/sync/biometric
 * @desc    Sync attendance from eSSL biometric / eSSL Cloud API
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/sync/biometric',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(syncBiometricSchema),
  attendanceController.syncBiometric.bind(attendanceController)
);

/**
 * @route   POST /api/v1/attendance/shift-assignments/bulk
 * @desc    Bulk update shift assignments for employees
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/shift-assignments/bulk',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(bulkShiftAssignmentsSchema),
  attendanceController.bulkUpdateShiftAssignments.bind(attendanceController)
);

// ============================================================================
// ATTENDANCE REGULARIZATION
// ============================================================================

/**
 * @route   POST /api/v1/attendance/regularization
 * @desc    Create regularization request
 * @access  Private (All authenticated users)
 */
router.post(
  '/regularization',
  validate(createRegularizationSchema),
  attendanceRegularizationController.create.bind(attendanceRegularizationController)
);

/**
 * @route   GET /api/v1/attendance/regularization
 * @desc    Get all regularization requests
 * @access  Private (All authenticated users - filtered by role)
 */
router.get(
  '/regularization',
  attendanceRegularizationController.getAll.bind(attendanceRegularizationController)
);

/**
 * @route   GET /api/v1/attendance/regularization/:id
 * @desc    Get regularization by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/regularization/:id',
  attendanceRegularizationController.getById.bind(attendanceRegularizationController)
);

/**
 * @route   PUT /api/v1/attendance/regularization/:id/approve
 * @desc    Approve regularization request
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER)
 */
router.put(
  '/regularization/:id/approve',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  validate(approveRegularizationSchema),
  attendanceRegularizationController.approve.bind(attendanceRegularizationController)
);

/**
 * @route   PUT /api/v1/attendance/regularization/:id/reject
 * @desc    Reject regularization request
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER)
 */
router.put(
  '/regularization/:id/reject',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  validate(rejectRegularizationSchema),
  attendanceRegularizationController.reject.bind(attendanceRegularizationController)
);

/**
 * @route   PUT /api/v1/attendance/regularization/:id/cancel
 * @desc    Cancel regularization request (by employee)
 * @access  Private (All authenticated users - own requests only)
 */
router.put(
  '/regularization/:id/cancel',
  attendanceRegularizationController.cancel.bind(attendanceRegularizationController)
);

export default router;
