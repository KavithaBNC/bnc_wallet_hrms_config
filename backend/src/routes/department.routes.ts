import { Router } from 'express';
import multer from 'multer';
import { departmentController } from '../controllers/department.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  queryDepartmentsSchema,
} from '../utils/department.validation';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls|csv)$/i.test(file.originalname) ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

/**
 * @route   GET /api/v1/departments/download-excel
 * @desc    Download sample Excel template for bulk department upload
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/download-excel',
  checkPermission('departments', 'read'),
  departmentController.downloadExcel.bind(departmentController)
);

/**
 * @route   POST /api/v1/departments/upload-excel
 * @desc    Bulk upload departments from Excel
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/upload-excel',
  checkPermission('departments', 'create'),
  upload.single('file'),
  departmentController.uploadExcel.bind(departmentController)
);

/**
 * @route   GET /api/v1/departments/hierarchy/:organizationId
 * @desc    Get department hierarchy tree
 * @access  Private (All authenticated users)
 */
router.get(
  '/hierarchy/:organizationId',
  departmentController.getHierarchy.bind(departmentController)
);

/**
 * @route   GET /api/v1/departments/list
 * @desc    List departments from Configurator (cascading dropdown)
 * @access  Private (All authenticated users)
 */
router.get(
  '/list',
  departmentController.getConfiguratorList.bind(departmentController)
);

/**
 * @route   GET /api/v1/departments
 * @desc    Get all departments with filtering
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  validateQuery(queryDepartmentsSchema),
  departmentController.getAll.bind(departmentController)
);

/**
 * @route   GET /api/v1/departments/:id
 * @desc    Get department by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  departmentController.getById.bind(departmentController)
);

/**
 * @route   POST /api/v1/departments
 * @desc    Create new department
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  checkPermission('departments', 'create'),
  validate(createDepartmentSchema),
  departmentController.create.bind(departmentController)
);

/**
 * @route   PUT /api/v1/departments/:id
 * @desc    Update department
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  checkPermission('departments', 'update'),
  validate(updateDepartmentSchema),
  departmentController.update.bind(departmentController)
);

/**
 * @route   DELETE /api/v1/departments/:id
 * @desc    Delete department
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  checkPermission('departments', 'delete'),
  departmentController.delete.bind(departmentController)
);

export default router;
