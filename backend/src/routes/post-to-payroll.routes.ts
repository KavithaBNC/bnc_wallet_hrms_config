import { Router } from 'express';
import { PostToPayrollController } from '../controllers/post-to-payroll.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new PostToPayrollController();

router.use(authenticate);
router.use(enforceOrganizationAccess);

// Match both '' and '/' so GET /api/v1/post-to-payroll is always handled
router.get(['/', ''], controller.getAll.bind(controller));
router.get('/columns', controller.getColumnOptions.bind(controller));
router.get('/salary-element-names', controller.getSalaryElementNames.bind(controller));

// HR Activities: Preview, Post, Unpost
router.get('/preview', controller.getPreview.bind(controller));
router.get('/post-status', controller.getPostStatus.bind(controller));
// Core HR Variable Input Entry: posted data for paygroup + month + year
router.get('/variable-input-entry', controller.getVariableInputEntry.bind(controller));
router.post(
  '/variable-input-entry',
  checkPermission('post_to_payroll', 'create'),
  controller.saveVariableInputEntry.bind(controller)
);
router.post('/post-month', checkPermission('post_to_payroll', 'create'), controller.postMonth.bind(controller));
router.delete('/unpost-month', checkPermission('post_to_payroll', 'delete'), controller.unpostMonth.bind(controller));

router.post(
  '/save',
  checkPermission('post_to_payroll', 'create'),
  controller.saveAll.bind(controller)
);

export default router;
