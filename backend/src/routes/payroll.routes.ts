import { Router } from 'express';
import { salaryStructureController } from '../controllers/salary-structure.controller';
import { salaryTemplateController } from '../controllers/salary-template.controller';
import { payrollController } from '../controllers/payroll.controller';
import { payslipController } from '../controllers/payslip.controller';
import { employeeSalaryController } from '../controllers/employee-salary.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { payslipAccessControl } from '../middlewares/payslip-access';

const router = Router();

// ============================================================================
// Salary Structure Routes
// ============================================================================
router.post(
  '/salary-structures',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  salaryStructureController.create.bind(salaryStructureController)
);

router.get(
  '/salary-components',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  salaryStructureController.getPredefinedComponents.bind(salaryStructureController)
);

router.get(
  '/salary-structures',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  salaryStructureController.getAll.bind(salaryStructureController)
);

router.get(
  '/salary-structures/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  salaryStructureController.getById.bind(salaryStructureController)
);

router.put(
  '/salary-structures/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  salaryStructureController.update.bind(salaryStructureController)
);

router.delete(
  '/salary-structures/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  salaryStructureController.delete.bind(salaryStructureController)
);

// ============================================================================
// Salary Template Routes
// ============================================================================
router.post(
  '/salary-templates',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  salaryTemplateController.create.bind(salaryTemplateController)
);

router.get(
  '/salary-templates',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  salaryTemplateController.getAll.bind(salaryTemplateController)
);

router.get(
  '/salary-templates/grade-level',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  salaryTemplateController.getByGradeAndLevel.bind(salaryTemplateController)
);

router.get(
  '/salary-templates/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  salaryTemplateController.getById.bind(salaryTemplateController)
);

router.put(
  '/salary-templates/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  salaryTemplateController.update.bind(salaryTemplateController)
);

router.delete(
  '/salary-templates/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  salaryTemplateController.delete.bind(salaryTemplateController)
);

// ============================================================================
// Employee Salary Routes
// ============================================================================
router.post(
  '/employee-salaries/enhanced',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  employeeSalaryController.createSalaryEnhanced.bind(employeeSalaryController)
);

router.post(
  '/employee-salaries',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  employeeSalaryController.createSalary.bind(employeeSalaryController)
);

router.get(
  '/employee-salaries',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  employeeSalaryController.getAllSalaries.bind(employeeSalaryController)
);

router.get(
  '/employee-salaries/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'),
  employeeSalaryController.getSalaryById.bind(employeeSalaryController)
);

router.get(
  '/employee-salaries/employee/:employeeId/current',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'),
  employeeSalaryController.getCurrentSalary.bind(employeeSalaryController)
);

router.put(
  '/employee-salaries/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  employeeSalaryController.updateSalary.bind(employeeSalaryController)
);

// ============================================================================
// Bank Account Routes
// ============================================================================
router.post(
  '/bank-accounts',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'EMPLOYEE'),
  employeeSalaryController.createBankAccount.bind(employeeSalaryController)
);

router.get(
  '/bank-accounts/employee/:employeeId',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'),
  employeeSalaryController.getBankAccounts.bind(employeeSalaryController)
);

router.put(
  '/bank-accounts/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'EMPLOYEE'),
  employeeSalaryController.updateBankAccount.bind(employeeSalaryController)
);

router.delete(
  '/bank-accounts/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'EMPLOYEE'),
  employeeSalaryController.deleteBankAccount.bind(employeeSalaryController)
);

// ============================================================================
// Payroll Cycle Routes
// ============================================================================
router.post(
  '/payroll-cycles',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payrollController.create.bind(payrollController)
);

router.get(
  '/payroll-cycles',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  payrollController.getAll.bind(payrollController)
);

router.get(
  '/payroll-cycles/:id/pre-run-check',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payrollController.preRunCheck.bind(payrollController)
);

router.get(
  '/payroll-cycles/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  payrollController.getById.bind(payrollController)
);

router.put(
  '/payroll-cycles/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payrollController.update.bind(payrollController)
);

router.post(
  '/payroll-cycles/:id/process',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payrollController.processPayrollCycle.bind(payrollController)
);

router.post(
  '/payroll-cycles/:id/finalize',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payrollController.finalizePayrollCycle.bind(payrollController)
);

router.post(
  '/payroll-cycles/:id/rollback',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payrollController.rollbackPayrollCycle.bind(payrollController)
);

router.post(
  '/payroll-cycles/:id/mark-paid',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payrollController.markAsPaid.bind(payrollController)
);

router.delete(
  '/payroll-cycles/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payrollController.delete.bind(payrollController)
);

// ============================================================================
// Payslip Routes
// ============================================================================
router.get(
  '/payslips',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'),
  payslipController.getAll.bind(payslipController)
);

router.get(
  '/payslips/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'),
  payslipAccessControl,
  payslipController.getById.bind(payslipController)
);

router.get(
  '/payslips/:id/comprehensive',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'),
  payslipAccessControl,
  payslipController.getComprehensive.bind(payslipController)
);

router.get(
  '/payslips/employee/:employeeId',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'),
  payslipController.getByEmployeeId.bind(payslipController)
);

router.put(
  '/payslips/:id',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payslipController.update.bind(payslipController)
);

router.post(
  '/payslips/:id/generate-pdf',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER', 'EMPLOYEE'),
  payslipController.generatePDF.bind(payslipController)
);

router.post(
  '/payslips/:id/send',
  authenticate,
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  payslipController.sendPayslip.bind(payslipController)
);

export default router;
