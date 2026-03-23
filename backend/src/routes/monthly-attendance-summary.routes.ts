import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { monthlyAttendanceSummaryController } from '../controllers/monthly-attendance-summary.controller';

const router = Router();

router.use(authenticate);

/**
 * Build or refresh a single employee's monthly summary
 * POST /api/v1/monthly-attendance-summary/build
 */
router.post(
  '/build',
  checkPermission('monthly_attendance_summary', 'create'),
  monthlyAttendanceSummaryController.buildForEmployee.bind(monthlyAttendanceSummaryController)
);

/**
 * Build or refresh all employees for a month
 * POST /api/v1/monthly-attendance-summary/build-month
 */
router.post(
  '/build-month',
  checkPermission('monthly_attendance_summary', 'create'),
  monthlyAttendanceSummaryController.buildMonth.bind(monthlyAttendanceSummaryController)
);

/**
 * List monthly summaries (with filters)
 * GET /api/v1/monthly-attendance-summary?organizationId=&year=&month=&employeeId=&status=&page=&limit=
 */
router.get(
  '/',
  checkPermission('monthly_attendance_summary', 'read'),
  monthlyAttendanceSummaryController.list.bind(monthlyAttendanceSummaryController)
);

/**
 * Get lock status for a month
 * GET /api/v1/monthly-attendance-summary/lock?organizationId=&year=&month=
 */
router.get(
  '/lock',
  checkPermission('monthly_attendance_summary', 'read'),
  monthlyAttendanceSummaryController.getMonthLock.bind(monthlyAttendanceSummaryController)
);

/**
 * Get a single summary by id
 * GET /api/v1/monthly-attendance-summary/:id
 */
router.get(
  '/:id',
  checkPermission('monthly_attendance_summary', 'read'),
  monthlyAttendanceSummaryController.getById.bind(monthlyAttendanceSummaryController)
);

/**
 * Finalize a summary (DRAFT → FINALIZED)
 * PUT /api/v1/monthly-attendance-summary/:id/finalize
 */
router.put(
  '/:id/finalize',
  checkPermission('monthly_attendance_summary', 'update'),
  monthlyAttendanceSummaryController.finalize.bind(monthlyAttendanceSummaryController)
);

/**
 * Lock a month for the organization
 * POST /api/v1/monthly-attendance-summary/lock-month
 */
router.post(
  '/lock-month',
  checkPermission('monthly_attendance_summary', 'update'),
  monthlyAttendanceSummaryController.lockMonth.bind(monthlyAttendanceSummaryController)
);

/**
 * Unlock a month for the organization
 * POST /api/v1/monthly-attendance-summary/unlock-month
 */
router.post(
  '/unlock-month',
  checkPermission('monthly_attendance_summary', 'update'),
  monthlyAttendanceSummaryController.unlockMonth.bind(monthlyAttendanceSummaryController)
);

export default router;
