import { Router } from 'express';
import multer from 'multer';
import { employeeController } from '../controllers/employee.controller';
import { employeeBulkImportController } from '../controllers/employee-bulk-import.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { employeeListAccess, enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  queryEmployeesSchema,
  rejoinEmployeeSchema,
} from '../utils/employee.validation';

const router = Router();

// Multer for Excel file upload (memory storage, 50MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    if (allowed.includes(file.mimetype) || /\.(xlsx|xls|csv)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/employees/bulk-import
 * @desc    Bulk import employees from Excel file
 * @access  Private (dynamic permission: employees.create)
 */
router.post(
  '/bulk-import',
  checkPermission('employees', 'create'),
  upload.single('file'),
  employeeBulkImportController.bulkImport.bind(employeeBulkImportController)
);

/**
 * @route   GET /api/v1/employees/import-template
 * @desc    Download employee import template from Configurator
 * @access  Private (dynamic permission: employees.create)
 */
router.get(
  '/import-template',
  checkPermission('employees', 'create'),
  employeeBulkImportController.downloadTemplate.bind(employeeBulkImportController)
);

/**
 * @route   GET /api/v1/employees/credentials
 * @desc    Get employee credentials
 * @access  Private (dynamic permission: employees.read)
 */
router.get(
  '/credentials',
  checkPermission('employees', 'read'),
  employeeListAccess,
  employeeController.getEmployeeCredentials.bind(employeeController)
);

/**
 * @route   GET /api/v1/employees/statistics/:organizationId
 * @desc    Get employee statistics
 * @access  Private (dynamic permission: employees.read)
 */
router.get(
  '/statistics/:organizationId',
  checkPermission('employees', 'read'),
  enforceOrganizationAccess,
  employeeController.getStatistics.bind(employeeController)
);

/**
 * @route   GET /api/v1/employees/:id/hierarchy
 * @desc    Get employee hierarchy (reporting structure)
 * @access  Private (dynamic permission: employees.read)
 */
router.get(
  '/:id/hierarchy',
  checkPermission('employees', 'read'),
  employeeController.getHierarchy.bind(employeeController)
);

/**
 * @route   GET /api/v1/employees
 * @desc    Get all employees with filtering (RBAC optimized)
 * @access  Private (Role-based field filtering via employeeListAccess)
 */
router.get(
  '/',
  employeeListAccess,
  validateQuery(queryEmployeesSchema),
  employeeController.getAll.bind(employeeController)
);

/**
 * @route   GET /api/v1/employees/:id
 * @desc    Get employee by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  employeeListAccess,
  employeeController.getById.bind(employeeController)
);

/**
 * @route   POST /api/v1/employees/rejoin
 * @desc    Rejoin: create new employee from separated employee
 * @access  Private (dynamic permission: employee_rejoin.create)
 */
router.post(
  '/rejoin',
  checkPermission('employee_rejoin', 'create'),
  validate(rejoinEmployeeSchema),
  employeeController.rejoin.bind(employeeController)
);

/**
 * @route   POST /api/v1/employees
 * @desc    Create new employee
 * @access  Private (dynamic permission: employees.create)
 */
router.post(
  '/',
  checkPermission('employees', 'create'),
  enforceOrganizationAccess,
  validate(createEmployeeSchema),
  employeeController.create.bind(employeeController)
);

/**
 * @route   PUT /api/v1/employees/:id
 * @desc    Update employee
 * @access  Private (dynamic permission: employees.update)
 */
router.put(
  '/:id',
  checkPermission('employees', 'update'),
  enforceOrganizationAccess,
  validate(updateEmployeeSchema),
  employeeController.update.bind(employeeController)
);

/**
 * @route   DELETE /api/v1/employees/configurator/:configuratorUserId
 * @desc    Delete employee by Configurator user_id (soft delete)
 * @access  Private (dynamic permission: employees.update)
 */
router.delete(
  '/configurator/:configuratorUserId',
  checkPermission('employees', 'update'),
  employeeController.deleteByConfiguratorUserId.bind(employeeController)
);

/**
 * @route   DELETE /api/v1/employees/:id
 * @desc    Delete employee (soft delete)
 * @access  Private (dynamic permission: employees.update)
 */
router.delete(
  '/:id',
  checkPermission('employees', 'update'),
  employeeListAccess,
  employeeController.delete.bind(employeeController)
);

export default router;
