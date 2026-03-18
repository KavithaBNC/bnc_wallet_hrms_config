import { Router } from 'express';
import { salaryStructureController } from '../controllers/salary-structure.controller';
import { salaryTemplateController } from '../controllers/salary-template.controller';
import { payrollController } from '../controllers/payroll.controller';
import { payslipController } from '../controllers/payslip.controller';
import { employeeSalaryController } from '../controllers/employee-salary.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { payslipAccessControl } from '../middlewares/payslip-access';

const router = Router();

// ============================================================================
// Salary Structure Routes
// ============================================================================
router.post(
  '/salary-structures',
  authenticate,
  checkPermission('salary_structures', 'create'),
  salaryStructureController.create.bind(salaryStructureController)
);

router.get(
  '/salary-components',
  authenticate,
  checkPermission('salary_structures', 'read'),
  salaryStructureController.getPredefinedComponents.bind(salaryStructureController)
);

router.get(
  '/salary-structures',
  authenticate,
  checkPermission('salary_structures', 'read'),
  salaryStructureController.getAll.bind(salaryStructureController)
);

router.get(
  '/salary-structures/:id',
  authenticate,
  checkPermission('salary_structures', 'read'),
  salaryStructureController.getById.bind(salaryStructureController)
);

router.put(
  '/salary-structures/:id',
  authenticate,
  checkPermission('salary_structures', 'update'),
  salaryStructureController.update.bind(salaryStructureController)
);

router.delete(
  '/salary-structures/:id',
  authenticate,
  checkPermission('salary_structures', 'update'),
  salaryStructureController.delete.bind(salaryStructureController)
);

// ============================================================================
// Salary Template Routes
// ============================================================================
router.post(
  '/salary-templates',
  authenticate,
  checkPermission('salary_structures', 'create'),
  salaryTemplateController.create.bind(salaryTemplateController)
);

router.get(
  '/salary-templates',
  authenticate,
  checkPermission('salary_structures', 'read'),
  salaryTemplateController.getAll.bind(salaryTemplateController)
);

router.get(
  '/salary-templates/grade-level',
  authenticate,
  checkPermission('salary_structures', 'read'),
  salaryTemplateController.getByGradeAndLevel.bind(salaryTemplateController)
);

router.get(
  '/salary-templates/:id',
  authenticate,
  checkPermission('salary_structures', 'read'),
  salaryTemplateController.getById.bind(salaryTemplateController)
);

router.put(
  '/salary-templates/:id',
  authenticate,
  checkPermission('salary_structures', 'update'),
  salaryTemplateController.update.bind(salaryTemplateController)
);

router.delete(
  '/salary-templates/:id',
  authenticate,
  checkPermission('salary_structures', 'update'),
  salaryTemplateController.delete.bind(salaryTemplateController)
);

// ============================================================================
// Employee Salary Routes
// ============================================================================
router.post(
  '/employee-salaries/enhanced',
  authenticate,
  checkPermission('employee_salaries', 'create'),
  employeeSalaryController.createSalaryEnhanced.bind(employeeSalaryController)
);

router.post(
  '/employee-salaries',
  authenticate,
  checkPermission('employee_salaries', 'create'),
  employeeSalaryController.createSalary.bind(employeeSalaryController)
);

router.get(
  '/employee-salaries',
  authenticate,
  checkPermission('employee_salaries', 'read'),
  employeeSalaryController.getAllSalaries.bind(employeeSalaryController)
);

router.get(
  '/employee-salaries/:id',
  authenticate,
  checkPermission('employee_salaries', 'read'),
  employeeSalaryController.getSalaryById.bind(employeeSalaryController)
);

router.get(
  '/employee-salaries/employee/:employeeId/current',
  authenticate,
  checkPermission('employee_salaries', 'read'),
  employeeSalaryController.getCurrentSalary.bind(employeeSalaryController)
);

router.put(
  '/employee-salaries/:id',
  authenticate,
  checkPermission('employee_salaries', 'update'),
  employeeSalaryController.updateSalary.bind(employeeSalaryController)
);

// ============================================================================
// Bank Account Routes
// ============================================================================
router.post(
  '/bank-accounts',
  authenticate,
  checkPermission('employee_salaries', 'create'),
  employeeSalaryController.createBankAccount.bind(employeeSalaryController)
);

router.get(
  '/bank-accounts/employee/:employeeId',
  authenticate,
  checkPermission('employee_salaries', 'read'),
  employeeSalaryController.getBankAccounts.bind(employeeSalaryController)
);

router.put(
  '/bank-accounts/:id',
  authenticate,
  checkPermission('employee_salaries', 'update'),
  employeeSalaryController.updateBankAccount.bind(employeeSalaryController)
);

router.delete(
  '/bank-accounts/:id',
  authenticate,
  checkPermission('employee_salaries', 'update'),
  employeeSalaryController.deleteBankAccount.bind(employeeSalaryController)
);

// ============================================================================
// Payroll Cycle Routes
// ============================================================================
router.post(
  '/payroll-cycles',
  authenticate,
  checkPermission('payroll', 'create'),
  payrollController.create.bind(payrollController)
);

router.get(
  '/payroll-cycles',
  authenticate,
  checkPermission('payroll', 'read'),
  payrollController.getAll.bind(payrollController)
);

router.get(
  '/payroll-cycles/:id/pre-run-check',
  authenticate,
  checkPermission('payroll', 'read'),
  payrollController.preRunCheck.bind(payrollController)
);

router.get(
  '/payroll-cycles/:id',
  authenticate,
  checkPermission('payroll', 'read'),
  payrollController.getById.bind(payrollController)
);

router.put(
  '/payroll-cycles/:id',
  authenticate,
  checkPermission('payroll', 'update'),
  payrollController.update.bind(payrollController)
);

router.post(
  '/payroll-cycles/:id/process',
  authenticate,
  checkPermission('payroll', 'update'),
  payrollController.processPayrollCycle.bind(payrollController)
);

router.post(
  '/payroll-cycles/:id/finalize',
  authenticate,
  checkPermission('payroll', 'update'),
  payrollController.finalizePayrollCycle.bind(payrollController)
);

router.post(
  '/payroll-cycles/:id/rollback',
  authenticate,
  checkPermission('payroll', 'update'),
  payrollController.rollbackPayrollCycle.bind(payrollController)
);

router.post(
  '/payroll-cycles/:id/mark-paid',
  authenticate,
  checkPermission('payroll', 'update'),
  payrollController.markAsPaid.bind(payrollController)
);

router.delete(
  '/payroll-cycles/:id',
  authenticate,
  checkPermission('payroll', 'update'),
  payrollController.delete.bind(payrollController)
);

// ============================================================================
// Payslip Routes
// ============================================================================
router.get(
  '/payslips',
  authenticate,
  checkPermission('payroll', 'read'),
  payslipController.getAll.bind(payslipController)
);

router.get(
  '/payslips/:id',
  authenticate,
  checkPermission('payroll', 'read'),
  payslipAccessControl,
  payslipController.getById.bind(payslipController)
);

router.get(
  '/payslips/:id/comprehensive',
  authenticate,
  checkPermission('payroll', 'read'),
  payslipAccessControl,
  payslipController.getComprehensive.bind(payslipController)
);

router.get(
  '/payslips/employee/:employeeId',
  authenticate,
  checkPermission('payroll', 'read'),
  payslipController.getByEmployeeId.bind(payslipController)
);

router.put(
  '/payslips/:id',
  authenticate,
  checkPermission('payroll', 'update'),
  payslipController.update.bind(payslipController)
);

router.post(
  '/payslips/:id/generate-pdf',
  authenticate,
  checkPermission('payroll', 'read'),
  payslipController.generatePDF.bind(payslipController)
);

router.post(
  '/payslips/:id/send',
  authenticate,
  checkPermission('payroll', 'update'),
  payslipController.sendPayslip.bind(payslipController)
);

export default router;
