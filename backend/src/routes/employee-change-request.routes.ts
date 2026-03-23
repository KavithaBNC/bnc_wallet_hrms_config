import { Router } from 'express';
import { employeeChangeRequestController } from '../controllers/employee-change-request.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { employeeListAccess } from '../middlewares/rbac';

const router = Router();

router.use(authenticate);

// Submit change request (employee or any user when approval is required)
router.post(
  '/submit',
  employeeListAccess,
  employeeChangeRequestController.submit.bind(employeeChangeRequestController)
);

// List pending requests (HR Manager, Org Admin, Super Admin)
router.get(
  '/',
  checkPermission('employee_change_requests', 'read'),
  employeeListAccess,
  employeeChangeRequestController.listPending.bind(employeeChangeRequestController)
);

// Get single request
router.get(
  '/:id',
  checkPermission('employee_change_requests', 'read'),
  employeeListAccess,
  employeeChangeRequestController.getById.bind(employeeChangeRequestController)
);

// Approve – apply requested data to employee
router.post(
  '/:id/approve',
  checkPermission('employee_change_requests', 'update'),
  employeeListAccess,
  employeeChangeRequestController.approve.bind(employeeChangeRequestController)
);

// Reject
router.post(
  '/:id/reject',
  checkPermission('employee_change_requests', 'update'),
  employeeListAccess,
  employeeChangeRequestController.reject.bind(employeeChangeRequestController)
);

export default router;
