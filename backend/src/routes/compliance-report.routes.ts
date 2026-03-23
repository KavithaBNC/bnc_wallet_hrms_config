import { Router } from 'express';
import { complianceReportController } from '../controllers/compliance-report.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

// All compliance reports require read permission
const reportPermission = checkPermission('compliance_reports', 'read');

// Payroll Register: GET /api/v1/compliance-reports/payroll-register?cycleId=xxx
router.get(
  '/payroll-register',
  reportPermission,
  complianceReportController.getPayrollRegister.bind(complianceReportController)
);

// PF ECR: GET /api/v1/compliance-reports/pf-ecr?year=2025&month=3&format=csv
router.get(
  '/pf-ecr',
  reportPermission,
  complianceReportController.getPfEcr.bind(complianceReportController)
);

// Salary Register: GET /api/v1/compliance-reports/salary-register?cycleId=xxx&groupBy=department
router.get(
  '/salary-register',
  reportPermission,
  complianceReportController.getSalaryRegister.bind(complianceReportController)
);

// Bank Advice: GET /api/v1/compliance-reports/bank-advice?cycleId=xxx&format=csv
router.get(
  '/bank-advice',
  reportPermission,
  complianceReportController.getBankAdvice.bind(complianceReportController)
);

// F&F Settlement Statement: GET /api/v1/compliance-reports/fnf-statement/:id
router.get(
  '/fnf-statement/:id',
  reportPermission,
  complianceReportController.getFnfStatement.bind(complianceReportController)
);

// ESIC Statement: GET /api/v1/compliance-reports/esic-statement?cycleId=xxx
router.get(
  '/esic-statement',
  reportPermission,
  complianceReportController.getEsicStatement.bind(complianceReportController)
);

// PT Report: GET /api/v1/compliance-reports/pt-report?cycleId=xxx
router.get(
  '/pt-report',
  reportPermission,
  complianceReportController.getProfessionalTaxReport.bind(complianceReportController)
);

// TDS Working Sheet: GET /api/v1/compliance-reports/tds-working-sheet?financialYear=2025-26
router.get(
  '/tds-working-sheet',
  reportPermission,
  complianceReportController.getTdsWorkingSheet.bind(complianceReportController)
);

// Form 16: GET /api/v1/compliance-reports/form16?financialYear=2025-26&employeeId=xxx
router.get(
  '/form16',
  reportPermission,
  complianceReportController.getForm16.bind(complianceReportController)
);

export default router;
