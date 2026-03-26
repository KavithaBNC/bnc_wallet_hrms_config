import { Router } from 'express';
import { Gender, MaritalStatus, EmploymentType, EmployeeStatus, PlaceOfTaxDeduction, PositionLevel } from '@prisma/client';
import { ConfigController } from '../controllers/config.controller';
import { authenticate } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new ConfigController();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/workflow-approval-options', controller.getWorkflowApprovalOptions.bind(controller));

/**
 * Helper: convert ENUM_VALUE to "Enum Value" label
 */
function enumToLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Helper: build searchable enum list endpoint handler
 */
function enumListHandler(enumObj: Record<string, string>, key: string) {
  return (req: any, res: any) => {
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    let items = Object.values(enumObj).map((value) => ({
      value,
      label: enumToLabel(value),
    }));
    if (search) {
      items = items.filter(
        (item) =>
          item.label.toLowerCase().includes(search) ||
          item.value.toLowerCase().includes(search)
      );
    }
    return res.status(200).json({ status: 'success', data: { [key]: items } });
  };
}

/**
 * @route   GET /api/v1/config/genders
 * @desc    List gender options (searchable dropdown)
 */
router.get('/genders', enumListHandler(Gender, 'genders'));

/**
 * @route   GET /api/v1/config/marital-statuses
 * @desc    List marital status options (searchable dropdown)
 */
router.get('/marital-statuses', enumListHandler(MaritalStatus, 'maritalStatuses'));

/**
 * @route   GET /api/v1/config/employment-types
 * @desc    List employment type options (searchable dropdown)
 */
router.get('/employment-types', enumListHandler(EmploymentType, 'employmentTypes'));

/**
 * @route   GET /api/v1/config/employee-statuses
 * @desc    List employee status options (searchable dropdown)
 */
router.get('/employee-statuses', enumListHandler(EmployeeStatus, 'employeeStatuses'));

/**
 * @route   GET /api/v1/config/place-of-tax-deductions
 * @desc    List place of tax deduction options (searchable dropdown)
 */
router.get('/place-of-tax-deductions', enumListHandler(PlaceOfTaxDeduction, 'placeOfTaxDeductions'));

/**
 * @route   GET /api/v1/config/position-levels
 * @desc    List position level options (searchable dropdown)
 */
router.get('/position-levels', enumListHandler(PositionLevel, 'positionLevels'));

export default router;
