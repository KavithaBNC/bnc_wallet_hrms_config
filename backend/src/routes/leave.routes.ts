import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import { leaveTypeController } from '../controllers/leave-type.controller';
import { leaveRequestController } from '../controllers/leave-request.controller';
import { leaveBalanceController } from '../controllers/leave-balance.controller';
import { leavePolicyController } from '../controllers/leave-policy.controller';
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  queryLeaveTypesSchema,
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  approveLeaveRequestSchema,
  rejectLeaveRequestSchema,
  cancelLeaveRequestSchema,
  queryLeaveRequestsSchema,
  queryLeaveBalanceSchema,
  queryLeaveCalendarSchema,
} from '../utils/leave.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

// ============================================================================
// LEAVE TYPES
// ============================================================================

/**
 * @route   POST /api/v1/leaves/types
 * @desc    Create leave type
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/types',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(createLeaveTypeSchema),
  leaveTypeController.create.bind(leaveTypeController)
);

/**
 * @route   GET /api/v1/leaves/types
 * @desc    Get all leave types
 * @access  Private (All authenticated users)
 */
router.get(
  '/types',
  validateQuery(queryLeaveTypesSchema),
  leaveTypeController.getAll.bind(leaveTypeController)
);

/**
 * @route   GET /api/v1/leaves/types/:id
 * @desc    Get leave type by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/types/:id',
  leaveTypeController.getById.bind(leaveTypeController)
);

/**
 * @route   PUT /api/v1/leaves/types/:id
 * @desc    Update leave type
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/types/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(updateLeaveTypeSchema),
  leaveTypeController.update.bind(leaveTypeController)
);

/**
 * @route   DELETE /api/v1/leaves/types/:id
 * @desc    Delete leave type
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/types/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  leaveTypeController.delete.bind(leaveTypeController)
);

// ============================================================================
// LEAVE REQUESTS
// ============================================================================

/**
 * @route   POST /api/v1/leaves/requests
 * @desc    Apply for leave
 * @access  Private (All authenticated users)
 */
router.post(
  '/requests',
  validate(createLeaveRequestSchema),
  leaveRequestController.create.bind(leaveRequestController)
);

/**
 * @route   GET /api/v1/leaves/requests
 * @desc    Get all leave requests
 * @access  Private (All authenticated users - filtered by role)
 */
router.get(
  '/requests',
  validateQuery(queryLeaveRequestsSchema),
  leaveRequestController.getAll.bind(leaveRequestController)
);

/**
 * @route   GET /api/v1/leaves/requests/apply-hint
 * @desc    Get employee-specific leave apply hint
 * @access  Private (All authenticated users)
 */
router.get(
  '/requests/apply-hint',
  leaveRequestController.getApplyHint.bind(leaveRequestController)
);

/**
 * @route   GET /api/v1/leaves/requests/:id
 * @desc    Get leave request by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/requests/:id',
  leaveRequestController.getById.bind(leaveRequestController)
);

/**
 * @route   PUT /api/v1/leaves/requests/:id
 * @desc    Update leave request (only if pending)
 * @access  Private (Employee - own requests only)
 */
router.put(
  '/requests/:id',
  validate(updateLeaveRequestSchema),
  leaveRequestController.update.bind(leaveRequestController)
);

/**
 * @route   PUT /api/v1/leaves/requests/:id/approve
 * @desc    Approve leave request
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER)
 */
router.put(
  '/requests/:id/approve',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  validate(approveLeaveRequestSchema),
  leaveRequestController.approve.bind(leaveRequestController)
);

/**
 * @route   PUT /api/v1/leaves/requests/:id/reject
 * @desc    Reject leave request
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER)
 */
router.put(
  '/requests/:id/reject',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  validate(rejectLeaveRequestSchema),
  leaveRequestController.reject.bind(leaveRequestController)
);

/**
 * @route   PUT /api/v1/leaves/requests/:id/cancel
 * @desc    Cancel leave request
 * @access  Private (Employee - own requests only)
 */
router.put(
  '/requests/:id/cancel',
  validate(cancelLeaveRequestSchema),
  leaveRequestController.cancel.bind(leaveRequestController)
);

// ============================================================================
// LEAVE BALANCE
// ============================================================================

/**
 * @route   GET /api/v1/leaves/balance/:employeeId
 * @desc    Get leave balance for employee
 * @access  Private (All authenticated users)
 */
router.get(
  '/balance/:employeeId',
  validateQuery(queryLeaveBalanceSchema),
  leaveBalanceController.getBalance.bind(leaveBalanceController)
);

/**
 * @route   GET /api/v1/leaves/calendar
 * @desc    Get leave calendar
 * @access  Private (All authenticated users)
 */
router.get(
  '/calendar',
  validateQuery(queryLeaveCalendarSchema),
  leaveBalanceController.getCalendar.bind(leaveBalanceController)
);

/**
 * @route   GET /api/v1/leaves/balance-entry
 * @desc    List event balance entries (employee-wise)
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/balance-entry',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  leaveBalanceController.getBalanceEntries.bind(leaveBalanceController)
);

/**
 * @route   PUT /api/v1/leaves/balance-entry
 * @desc    Upsert event balance entry
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/balance-entry',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  leaveBalanceController.upsertBalanceEntry.bind(leaveBalanceController)
);

// ============================================================================
// LEAVE POLICIES
// ============================================================================

/**
 * @route   POST /api/v1/leaves/policies
 * @desc    Create leave policy
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/policies',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  leavePolicyController.create.bind(leavePolicyController)
);

/**
 * @route   GET /api/v1/leaves/policies
 * @desc    Get all leave policies
 * @access  Private (All authenticated users)
 */
router.get(
  '/policies',
  leavePolicyController.getAll.bind(leavePolicyController)
);

/**
 * @route   GET /api/v1/leaves/policies/:id
 * @desc    Get leave policy by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/policies/:id',
  leavePolicyController.getById.bind(leavePolicyController)
);

/**
 * @route   PUT /api/v1/leaves/policies/:id
 * @desc    Update leave policy
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/policies/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  leavePolicyController.update.bind(leavePolicyController)
);

/**
 * @route   DELETE /api/v1/leaves/policies/:id
 * @desc    Delete leave policy
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/policies/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  leavePolicyController.delete.bind(leavePolicyController)
);

/**
 * @route   GET /api/v1/leaves/policies/check-eligibility
 * @desc    Check employee eligibility for leave type
 * @access  Private (All authenticated users)
 */
router.get(
  '/policies/check-eligibility',
  leavePolicyController.checkEligibility.bind(leavePolicyController)
);

export default router;
