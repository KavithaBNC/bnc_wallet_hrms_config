import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate } from '../middlewares/validate';
import { holidayController } from '../controllers/holiday.controller';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

// Validation schemas
const createHolidaySchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string().min(1, 'Holiday name is required').max(255, 'Name too long'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  isOptional: z.boolean().optional(),
  applicableLocations: z.any().optional(),
  description: z.string().optional(),
});

const updateHolidaySchema = createHolidaySchema.partial().extend({
  organizationId: z.string().uuid().optional(),
});

/**
 * @route   POST /api/v1/holidays
 * @desc    Create holiday
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  checkPermission('holidays', 'create'),
  validate(createHolidaySchema),
  holidayController.create.bind(holidayController)
);

/**
 * @route   GET /api/v1/holidays
 * @desc    Get all holidays
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  holidayController.getAll.bind(holidayController)
);

/**
 * @route   GET /api/v1/holidays/:id
 * @desc    Get holiday by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  holidayController.getById.bind(holidayController)
);

/**
 * @route   PUT /api/v1/holidays/:id
 * @desc    Update holiday
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  checkPermission('holidays', 'update'),
  validate(updateHolidaySchema),
  holidayController.update.bind(holidayController)
);

/**
 * @route   DELETE /api/v1/holidays/:id
 * @desc    Delete holiday
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  checkPermission('holidays', 'delete'),
  holidayController.delete.bind(holidayController)
);

export default router;
