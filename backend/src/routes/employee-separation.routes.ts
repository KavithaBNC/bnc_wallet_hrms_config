import { Router } from 'express';
import { employeeSeparationController } from '../controllers/employee-separation.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
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
  checkPermission('employee_separations', 'create'),
  validate(createEmployeeSeparationSchema),
  employeeSeparationController.create.bind(employeeSeparationController)
);

router.put(
  '/:id',
  checkPermission('employee_separations', 'update'),
  validate(updateEmployeeSeparationSchema),
  employeeSeparationController.update.bind(employeeSeparationController)
);

router.delete(
  '/:id',
  checkPermission('employee_separations', 'delete'),
  employeeSeparationController.delete.bind(employeeSeparationController)
);

export default router;
