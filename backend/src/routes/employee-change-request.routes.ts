import { Router } from 'express';
import { employeeChangeRequestController } from '../controllers/employee-change-request.controller';
import { authenticate, authorize } from '../middlewares/auth';
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
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  employeeListAccess,
  employeeChangeRequestController.listPending.bind(employeeChangeRequestController)
);

// Get single request
router.get(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  employeeListAccess,
  employeeChangeRequestController.getById.bind(employeeChangeRequestController)
);

// Approve – apply requested data to employee
router.post(
  '/:id/approve',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  employeeListAccess,
  employeeChangeRequestController.approve.bind(employeeChangeRequestController)
);

// Reject
router.post(
  '/:id/reject',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  employeeListAccess,
  employeeChangeRequestController.reject.bind(employeeChangeRequestController)
);

export default router;
