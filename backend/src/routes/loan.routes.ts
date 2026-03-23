import { Router } from 'express';
import { loanController } from '../controllers/loan.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route  POST /api/v1/loans
 * @desc   Create a new loan/advance request
 * @access HR_MANAGER, ORG_ADMIN, SUPER_ADMIN
 */
router.post(
  '/',
  checkPermission('loans', 'create'),
  loanController.createLoan.bind(loanController)
);

/**
 * @route  GET /api/v1/loans
 * @desc   Get all loans for an organization
 * @access All authenticated users with org access
 */
router.get('/', loanController.getAllLoans.bind(loanController));

/**
 * @route  GET /api/v1/loans/:id
 * @desc   Get a loan by ID with repayment history
 * @access All authenticated users
 */
router.get('/:id', loanController.getLoanById.bind(loanController));

/**
 * @route  PUT /api/v1/loans/:id/approve
 * @desc   Approve a pending loan
 * @access HR_MANAGER, ORG_ADMIN, SUPER_ADMIN
 */
router.put(
  '/:id/approve',
  checkPermission('loans', 'update'),
  loanController.approveLoan.bind(loanController)
);

/**
 * @route  PUT /api/v1/loans/:id/disburse
 * @desc   Disburse an approved loan (set to ACTIVE)
 * @access ORG_ADMIN, SUPER_ADMIN
 */
router.put(
  '/:id/disburse',
  checkPermission('loans', 'update'),
  loanController.disburseLoan.bind(loanController)
);

/**
 * @route  PUT /api/v1/loans/:id/reject
 * @desc   Reject a pending loan
 * @access HR_MANAGER, ORG_ADMIN, SUPER_ADMIN
 */
router.put(
  '/:id/reject',
  checkPermission('loans', 'update'),
  loanController.rejectLoan.bind(loanController)
);

/**
 * @route  POST /api/v1/loans/:id/repayment
 * @desc   Record a repayment against an active loan
 * @access HR_MANAGER, ORG_ADMIN, SUPER_ADMIN
 */
router.post(
  '/:id/repayment',
  checkPermission('loans', 'update'),
  loanController.recordRepayment.bind(loanController)
);

export default router;
