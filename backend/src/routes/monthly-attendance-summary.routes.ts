import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { monthlyAttendanceSummaryController } from '../controllers/monthly-attendance-summary.controller';

const router = Router();

router.use(authenticate);

/**
 * Build or refresh a single employee's monthly summary
 * POST /api/v1/monthly-attendance-summary/build
 */
router.post(
  '/build',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  monthlyAttendanceSummaryController.buildForEmployee.bind(monthlyAttendanceSummaryController)
);

/**
 * Build or refresh all employees for a month
 * POST /api/v1/monthly-attendance-summary/build-month
 */
router.post(
  '/build-month',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  monthlyAttendanceSummaryController.buildMonth.bind(monthlyAttendanceSummaryController)
);

/**
 * List monthly summaries (with filters)
 * GET /api/v1/monthly-attendance-summary?organizationId=&year=&month=&employeeId=&status=&page=&limit=
 */
router.get(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  monthlyAttendanceSummaryController.list.bind(monthlyAttendanceSummaryController)
);

/**
 * Get lock status for a month
 * GET /api/v1/monthly-attendance-summary/lock?organizationId=&year=&month=
 */
router.get(
  '/lock',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  monthlyAttendanceSummaryController.getMonthLock.bind(monthlyAttendanceSummaryController)
);

/**
 * Get a single summary by id
 * GET /api/v1/monthly-attendance-summary/:id
 */
router.get(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  monthlyAttendanceSummaryController.getById.bind(monthlyAttendanceSummaryController)
);

/**
 * Finalize a summary (DRAFT → FINALIZED)
 * PUT /api/v1/monthly-attendance-summary/:id/finalize
 */
router.put(
  '/:id/finalize',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  monthlyAttendanceSummaryController.finalize.bind(monthlyAttendanceSummaryController)
);

/**
 * Lock a month for the organization
 * POST /api/v1/monthly-attendance-summary/lock-month
 */
router.post(
  '/lock-month',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  monthlyAttendanceSummaryController.lockMonth.bind(monthlyAttendanceSummaryController)
);

/**
 * Unlock a month for the organization
 * POST /api/v1/monthly-attendance-summary/unlock-month
 */
router.post(
  '/unlock-month',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  monthlyAttendanceSummaryController.unlockMonth.bind(monthlyAttendanceSummaryController)
);

export default router;
