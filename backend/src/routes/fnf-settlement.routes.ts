import { Router } from 'express';
import { fnfSettlementController } from '../controllers/fnf-settlement.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  calculateFnfSettlementSchema,
  updateFnfSettlementSchema,
  queryFnfSettlementsSchema,
} from '../utils/fnf-settlement.validation';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

// Calculate F&F settlement for a separation
router.post(
  '/calculate',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(calculateFnfSettlementSchema),
  fnfSettlementController.calculate.bind(fnfSettlementController)
);

// Dashboard stats
router.get(
  '/stats',
  fnfSettlementController.getStats.bind(fnfSettlementController)
);

// Separations without a settlement (for initiation dropdown)
router.get(
  '/eligible-separations',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  fnfSettlementController.getEligibleSeparations.bind(fnfSettlementController)
);

// List all settlements
router.get(
  '/',
  validateQuery(queryFnfSettlementsSchema),
  fnfSettlementController.getAll.bind(fnfSettlementController)
);

// Get settlement by ID
router.get(
  '/:id',
  fnfSettlementController.getById.bind(fnfSettlementController)
);

// Update manual adjustments
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(updateFnfSettlementSchema),
  fnfSettlementController.update.bind(fnfSettlementController)
);

// Approve settlement
router.put(
  '/:id/approve',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  fnfSettlementController.approve.bind(fnfSettlementController)
);

// Mark as paid
router.put(
  '/:id/paid',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  fnfSettlementController.markAsPaid.bind(fnfSettlementController)
);

// Delete DRAFT settlement
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  fnfSettlementController.delete.bind(fnfSettlementController)
);

export default router;
