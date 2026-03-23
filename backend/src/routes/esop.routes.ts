import { Router } from 'express';
import { esopController } from '../controllers/esop.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();

// All routes require authentication + org isolation (sets req.rbac.organizationId)
router.use(authenticate);
router.use(enforceOrganizationAccess);

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/dashboard', esopController.getDashboard.bind(esopController));

// ─── ESOP Pools ──────────────────────────────────────────────────────────────
router.post(
  '/pools',
  checkPermission('esop', 'create'),
  esopController.createPool.bind(esopController)
);
router.get('/pools', esopController.getAllPools.bind(esopController));
router.get('/pools/:id', esopController.getPoolById.bind(esopController));
router.put(
  '/pools/:id',
  checkPermission('esop', 'update'),
  esopController.updatePool.bind(esopController)
);
router.delete(
  '/pools/:id',
  checkPermission('esop', 'delete'),
  esopController.deletePool.bind(esopController)
);

// ─── Vesting Plans ───────────────────────────────────────────────────────────
router.post(
  '/vesting-plans',
  checkPermission('esop', 'create'),
  esopController.createVestingPlan.bind(esopController)
);
router.get('/vesting-plans', esopController.getAllVestingPlans.bind(esopController));
router.get('/vesting-plans/:id', esopController.getVestingPlanById.bind(esopController));
router.put(
  '/vesting-plans/:id',
  checkPermission('esop', 'update'),
  esopController.updateVestingPlan.bind(esopController)
);
router.delete(
  '/vesting-plans/:id',
  checkPermission('esop', 'delete'),
  esopController.deleteVestingPlan.bind(esopController)
);

// ─── ESOP Grants ─────────────────────────────────────────────────────────────
router.post(
  '/grants',
  checkPermission('esop', 'create'),
  esopController.createGrant.bind(esopController)
);
router.get('/grants', esopController.getAllGrants.bind(esopController));
router.get('/grants/:id', esopController.getGrantById.bind(esopController));
router.put(
  '/grants/:id/cancel',
  checkPermission('esop', 'update'),
  esopController.cancelGrant.bind(esopController)
);

// ─── Vesting Schedules ───────────────────────────────────────────────────────
router.get('/vesting-schedules', esopController.getVestingSchedules.bind(esopController));
router.get('/vesting-schedules/:id', esopController.getVestingScheduleById.bind(esopController));
router.post(
  '/process-vesting',
  checkPermission('esop', 'update'),
  esopController.processVesting.bind(esopController)
);

// ─── Available to Exercise (helper) ─────────────────────────────────────────
router.get(
  '/grants/:grantId/available-to-exercise',
  esopController.getAvailableToExercise.bind(esopController)
);

// ─── Exercise Requests ───────────────────────────────────────────────────────
router.post('/exercise-requests', esopController.createExerciseRequest.bind(esopController));
router.get('/exercise-requests', esopController.getAllExerciseRequests.bind(esopController));
router.get('/exercise-requests/:id', esopController.getExerciseRequestById.bind(esopController));
router.put(
  '/exercise-requests/:id/approve',
  checkPermission('esop', 'update'),
  esopController.approveExercise.bind(esopController)
);
router.put(
  '/exercise-requests/:id/reject',
  checkPermission('esop', 'update'),
  esopController.rejectExercise.bind(esopController)
);
router.put(
  '/exercise-requests/:id/complete',
  checkPermission('esop', 'update'),
  esopController.completeExercise.bind(esopController)
);

// ─── Ledger ──────────────────────────────────────────────────────────────────
router.get('/ledger', esopController.getLedger.bind(esopController));

export default router;
