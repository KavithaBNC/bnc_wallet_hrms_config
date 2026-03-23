import { Router } from 'express';
import { fnfSettlementController } from '../controllers/fnf-settlement.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
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
  checkPermission('fnf_settlements', 'create'),
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
  checkPermission('fnf_settlements', 'read'),
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
  checkPermission('fnf_settlements', 'update'),
  validate(updateFnfSettlementSchema),
  fnfSettlementController.update.bind(fnfSettlementController)
);

// Approve settlement
router.put(
  '/:id/approve',
  checkPermission('fnf_settlements', 'update'),
  fnfSettlementController.approve.bind(fnfSettlementController)
);

// Mark as paid
router.put(
  '/:id/paid',
  checkPermission('fnf_settlements', 'update'),
  fnfSettlementController.markAsPaid.bind(fnfSettlementController)
);

// Delete DRAFT settlement
router.delete(
  '/:id',
  checkPermission('fnf_settlements', 'delete'),
  fnfSettlementController.delete.bind(fnfSettlementController)
);

export default router;
