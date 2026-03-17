import { Router } from 'express';
import { esopController } from '../controllers/esop.controller';
import { authenticate, authorize } from '../middlewares/auth';
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
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  esopController.createPool.bind(esopController)
);
router.get('/pools', esopController.getAllPools.bind(esopController));
router.get('/pools/:id', esopController.getPoolById.bind(esopController));
router.put(
  '/pools/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  esopController.updatePool.bind(esopController)
);
router.delete(
  '/pools/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  esopController.deletePool.bind(esopController)
);

// ─── Vesting Plans ───────────────────────────────────────────────────────────
router.post(
  '/vesting-plans',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  esopController.createVestingPlan.bind(esopController)
);
router.get('/vesting-plans', esopController.getAllVestingPlans.bind(esopController));
router.get('/vesting-plans/:id', esopController.getVestingPlanById.bind(esopController));
router.put(
  '/vesting-plans/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  esopController.updateVestingPlan.bind(esopController)
);
router.delete(
  '/vesting-plans/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  esopController.deleteVestingPlan.bind(esopController)
);

// ─── ESOP Grants ─────────────────────────────────────────────────────────────
router.post(
  '/grants',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  esopController.createGrant.bind(esopController)
);
router.get('/grants', esopController.getAllGrants.bind(esopController));
router.get('/grants/:id', esopController.getGrantById.bind(esopController));
router.put(
  '/grants/:id/cancel',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  esopController.cancelGrant.bind(esopController)
);

// ─── Vesting Schedules ───────────────────────────────────────────────────────
router.get('/vesting-schedules', esopController.getVestingSchedules.bind(esopController));
router.get('/vesting-schedules/:id', esopController.getVestingScheduleById.bind(esopController));
router.post(
  '/process-vesting',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
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
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  esopController.approveExercise.bind(esopController)
);
router.put(
  '/exercise-requests/:id/reject',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  esopController.rejectExercise.bind(esopController)
);
router.put(
  '/exercise-requests/:id/complete',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  esopController.completeExercise.bind(esopController)
);

// ─── Ledger ──────────────────────────────────────────────────────────────────
router.get('/ledger', esopController.getLedger.bind(esopController));

export default router;
