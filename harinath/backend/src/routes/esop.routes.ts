import { Router } from 'express';
import { esopController } from '../controllers/esop.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createEsopSchema,
  createEsopBulkSchema,
  updateEsopSchema,
  queryEsopSchema,
} from '../utils/esop.validation';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(createEsopSchema),
  esopController.create.bind(esopController)
);

router.post(
  '/bulk',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(createEsopBulkSchema),
  esopController.createBulk.bind(esopController)
);

router.get(
  '/',
  validateQuery(queryEsopSchema),
  esopController.getAll.bind(esopController)
);

router.get(
  '/employee/:employeeId',
  esopController.getByEmployeeId.bind(esopController)
);

router.get(
  '/:id',
  esopController.getById.bind(esopController)
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(updateEsopSchema),
  esopController.update.bind(esopController)
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  esopController.delete.bind(esopController)
);

export default router;
