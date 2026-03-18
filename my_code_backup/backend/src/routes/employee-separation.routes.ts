import { Router } from 'express';
import { employeeSeparationController } from '../controllers/employee-separation.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createEmployeeSeparationSchema,
  updateEmployeeSeparationSchema,
  queryEmployeeSeparationsSchema,
} from '../utils/employee-separation.validation';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get(
  '/',
  validateQuery(queryEmployeeSeparationsSchema),
  employeeSeparationController.getAll.bind(employeeSeparationController)
);

router.get(
  '/:id',
  employeeSeparationController.getById.bind(employeeSeparationController)
);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(createEmployeeSeparationSchema),
  employeeSeparationController.create.bind(employeeSeparationController)
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(updateEmployeeSeparationSchema),
  employeeSeparationController.update.bind(employeeSeparationController)
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  employeeSeparationController.delete.bind(employeeSeparationController)
);

export default router;
