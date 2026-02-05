import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import { attendanceController } from '../controllers/attendance.controller';
import { attendanceRegularizationController } from '../controllers/attendance-regularization.controller';
import {
  checkInSchema,
  checkOutSchema,
  queryAttendanceRecordsSchema,
  queryAttendanceSummarySchema,
  queryAttendanceReportSchema,
  syncBiometricSchema,
  createRegularizationSchema,
  approveRegularizationSchema,
  rejectRegularizationSchema,
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
 * @desc    Face punch: base64 image → match employee → insert attendance_logs + record (punch_source FACE)
 * @access  Private (any authenticated user; org from user profile or body)
 */
router.post('/face-punch', attendanceController.facePunch.bind(attendanceController));

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
