import { Router } from 'express';
import multer from 'multer';
import { jobPositionController } from '../controllers/job-position.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createJobPositionSchema,
  updateJobPositionSchema,
  queryJobPositionsSchema,
} from '../utils/job-position.validation';

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
 * @route   GET /api/v1/positions/download-excel
 * @desc    Download sample Excel template for bulk designation upload
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/download-excel',
  checkPermission('job_positions', 'read'),
  jobPositionController.downloadExcel.bind(jobPositionController)
);

/**
 * @route   POST /api/v1/positions/upload-excel
 * @desc    Bulk upload designations from Excel
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, 'HR_MANAGER')
 */
router.post(
  '/upload-excel',
  checkPermission('job_positions', 'create'),
  upload.single('file'),
  jobPositionController.uploadExcel.bind(jobPositionController)
);

/**
 * @route   GET /api/v1/positions/statistics/:organizationId
 * @desc    Get position statistics
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/statistics/:organizationId',
  checkPermission('job_positions', 'read'),
  jobPositionController.getStatistics.bind(jobPositionController)
);

/**
 * @route   GET /api/v1/positions/department/:departmentId
 * @desc    Get positions by department
 * @access  Private (All authenticated users)
 */
router.get(
  '/department/:departmentId',
  jobPositionController.getByDepartment.bind(jobPositionController)
);

/**
 * @route   GET /api/v1/positions/list
 * @desc    Lightweight list for searchable dropdown (id, title, code)
 * @access  Private (All authenticated users)
 */
router.get(
  '/list',
  jobPositionController.list.bind(jobPositionController)
);

/**
 * @route   GET /api/v1/positions
 * @desc    Get all positions with filtering
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  validateQuery(queryJobPositionsSchema),
  jobPositionController.getAll.bind(jobPositionController)
);

/**
 * @route   GET /api/v1/positions/:id
 * @desc    Get position by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  jobPositionController.getById.bind(jobPositionController)
);

/**
 * @route   POST /api/v1/positions
 * @desc    Create new position
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  checkPermission('job_positions', 'create'),
  validate(createJobPositionSchema),
  jobPositionController.create.bind(jobPositionController)
);

/**
 * @route   PUT /api/v1/positions/:id
 * @desc    Update position
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  checkPermission('job_positions', 'update'),
  validate(updateJobPositionSchema),
  jobPositionController.update.bind(jobPositionController)
);

/**
 * @route   DELETE /api/v1/positions/:id
 * @desc    Delete position
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  checkPermission('job_positions', 'delete'),
  jobPositionController.delete.bind(jobPositionController)
);

export default router;
