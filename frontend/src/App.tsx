import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import { useAuthStore } from './store/authStore';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import DepartmentsPage from './pages/DepartmentsPage';
import EmployeesPage from './pages/EmployeesPage';
import PositionsPage from './pages/PositionsPage';
import EventConfigurationPage from './pages/EventConfigurationPage';
import OthersConfigurationPage from './pages/OthersConfigurationPage';
import CoreHRPage from './pages/CoreHRPage';
import CompoundCreationPage from './pages/CompoundCreationPage';
import RulesEnginePage from './pages/RulesEnginePage';
import RulesEngineFormulaEditorPage from './pages/RulesEngineFormulaEditorPage';
import CompoundCreationFormPage from './pages/CompoundCreationFormPage';
import ValidationProcessPage from './pages/ValidationProcessPage';
import ValidationProcessEmployeeGridPage from './pages/ValidationProcessEmployeeGridPage';
import RevertProcessPage from './pages/RevertProcessPage';
import ValidationProcessRulePage from './pages/ValidationProcessRulePage';
import ValidationProcessRuleFormPage from './pages/ValidationProcessRuleFormPage';
import AttendanceLockPage from './pages/AttendanceLockPage';
import PostToPayrollPage from './pages/PostToPayrollPage';
import PostToPayrollHRActivitiesPage from './pages/PostToPayrollHRActivitiesPage';
import AttendanceComponentsPage from './pages/AttendanceComponentsPage';
import AttendanceComponentFormPage from './pages/AttendanceComponentFormPage';
import EncashmentCarryForwardPage from './pages/EncashmentCarryForwardPage';
import EncashmentCarryForwardFormPage from './pages/EncashmentCarryForwardFormPage';
import RightsAllocationPage from './pages/RightsAllocationPage';
import RightsAllocationFormPage from './pages/RightsAllocationFormPage';
import WorkflowMappingPage from './pages/WorkflowMappingPage';
import WorkflowMappingFormPage from './pages/WorkflowMappingFormPage';
import RuleSettingPage from './pages/RuleSettingPage';
import RuleSettingFormPage from './pages/RuleSettingFormPage';
import AutoCreditSettingPage from './pages/AutoCreditSettingPage';
import AutoCreditSettingFormPage from './pages/AutoCreditSettingFormPage';
import ApprovalWorkflowPage from './pages/ApprovalWorkflowPage';
import ApprovalWorkflowFormPage from './pages/ApprovalWorkflowFormPage';
import AttendancePage from './pages/AttendancePage';
import ExcessTimeRequestPage from './pages/ExcessTimeRequestPage';
import ExcessTimeApprovalPage from './pages/ExcessTimeApprovalPage';
import ApplyEventPage from './pages/ApplyEventPage';
import FaceAttendancePage from './pages/FaceAttendancePage';
import AttendancePolicyPage from './pages/AttendancePolicyPage';
import LateAndOthersPage from './pages/LateAndOthersPage';
import LateAndOthersFormPage from './pages/LateAndOthersFormPage';
import WeekOfAssignPage from './pages/WeekOfAssignPage';
import WeekOffAssignFormPage from './pages/WeekOffAssignFormPage';
import HolidayAssignPage from './pages/HolidayAssignPage';
import HolidayAssignFormPage from './pages/HolidayAssignFormPage';
import ExcessTimeConversionPage from './pages/ExcessTimeConversionPage';
import ExcessTimeConversionFormPage from './pages/ExcessTimeConversionFormPage';
import OTUsageRulePage from './pages/OTUsageRulePage';
import OTUsageRuleFormPage from './pages/OTUsageRuleFormPage';
import TimeAttendancePage from './pages/TimeAttendancePage';
import ShiftMasterPage from './pages/ShiftMasterPage';
import ShiftMasterFormPage from './pages/ShiftMasterFormPage';
import ShiftAssignPage from './pages/ShiftAssignPage';
import ShiftAssignFormPage from './pages/ShiftAssignFormPage';
import AssociateShiftChangePage from './pages/AssociateShiftChangePage';
import AssociateShiftGridPage from './pages/AssociateShiftGridPage';
import PayrollPage from './pages/PayrollPage';
import PayrollMasterPage from './pages/PayrollMasterPage';
import EmployeeSeparationPage from './pages/EmployeeSeparationPage';
import EmployeeRejoinPage from './pages/EmployeeRejoinPage';
import EmployeeRejoinEditPage from './pages/EmployeeRejoinEditPage';
import SalaryStructurePage from './pages/SalaryStructurePage';
import EmployeeSalariesPage from './pages/EmployeeSalariesPage';
import TransactionPage from './pages/TransactionPage';
import TransferAndPromotionsPage from './pages/TransferAndPromotionsPage';
import TransferPromotionEntryPage from './pages/TransferPromotionEntryPage';
import AddTransferPromotionEntryPage from './pages/AddTransferPromotionEntryPage';
import AddTransferPromotionPage from './pages/AddTransferPromotionPage';
import EmpCodeTransferPage from './pages/EmpCodeTransferPage';
import PaygroupTransferPage from './pages/PaygroupTransferPage';
import AddPaygroupTransferPage from './pages/AddPaygroupTransferPage';
import OrganizationsPage from './pages/OrganizationsPage';
import PermissionsPage from './pages/PermissionsPage';
import HRAuditSettingsPage from './pages/HRAuditSettingsPage';
import EmployeeMasterApprovalPage from './pages/EmployeeMasterApprovalPage';
import EsopListPage from './pages/EsopListPage';
import EsopPage from './pages/EsopPage';
import LeaveApprovalPage from './pages/LeaveApprovalPage';
import EventRequestPage from './pages/EventRequestPage';
import EventBalanceEntryPage from './pages/EventBalanceEntryPage';
import NotFoundPage from './pages/NotFoundPage';
import VariableInputPage from './pages/VariableInputPage';
import VariableInputEntryPage from './pages/VariableInputEntryPage';

function App() {
  const { isAuthenticated, loadUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      loadUser();
    }
  }, [isAuthenticated, loadUser]);

  return (
    <Router>
      <div className="flex flex-col min-h-screen w-full bg-gray-50">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />

          {/* Auth Routes - Redirect to dashboard if already logged in */}
          <Route
            path="/login"
            element={
              <ProtectedRoute requireAuth={false}>
                <LoginPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/register"
            element={
              <ProtectedRoute requireAuth={false}>
                <RegisterPage />
              </ProtectedRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected Routes - Require authentication, with sidebar layout */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ProfilePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/departments"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <DepartmentsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/positions"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PositionsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EventConfigurationPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/hr-activities" element={<Navigate to="/hr-activities/validation-process" replace />} />
          <Route
            path="/hr-activities/validation-process"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ValidationProcessPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr-activities/validation-process/revert"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RevertProcessPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr-activities/validation-process/employees"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ValidationProcessEmployeeGridPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route

          //   path="/hr-activities/post-to-payroll"
          //   element={
          //     <ProtectedRoute>
          //       <DashboardLayout>
          //         <PostToPayrollHRActivitiesPage />
          //   path="/hr-activities/validation-process/revert"
          //   element={
          //     <ProtectedRoute>
          //       <DashboardLayout>
          //         <RevertProcessPage />
          //       </DashboardLayout>
          //     </ProtectedRoute>
          //   }
          // />
                
          path="/hr-activities/post-to-payroll"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <PostToPayrollHRActivitiesPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr-activities/validation-process/revert"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <RevertProcessPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
          <Route
            path="/core-hr"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CoreHRPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/core-hr/overview"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CoreHRPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/core-hr/compound-creation"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CompoundCreationPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/core-hr/compound-creation/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CompoundCreationFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/core-hr/compound-creation/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CompoundCreationFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/core-hr/rules-engine"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RulesEnginePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/core-hr/variable-input"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <VariableInputPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/core-hr/variable-input/entry"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <VariableInputEntryPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/core-hr/variable-input"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <VariableInputPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/core-hr/rules-engine/formula/:paygroupId/:compoundId"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RulesEngineFormulaEditorPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/others-configuration"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OthersConfigurationPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/others-configuration/validation-process-rule"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ValidationProcessRulePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/others-configuration/validation-process-rule/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ValidationProcessRuleFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/others-configuration/validation-process-rule/:id/edit"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ValidationProcessRuleFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/others-configuration/attendance-lock"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AttendanceLockPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
                    <Route
            path="/others-configuration/post-to-payroll"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PostToPayrollPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/attendance-components"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AttendanceComponentsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/attendance-components/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AttendanceComponentFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/attendance-components/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AttendanceComponentFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/encashment-carry-forward"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EncashmentCarryForwardPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/encashment-carry-forward/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EncashmentCarryForwardFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/encashment-carry-forward/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EncashmentCarryForwardFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/rights-allocation"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RightsAllocationPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/rights-allocation/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RightsAllocationFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/rights-allocation/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RightsAllocationFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/workflow-mapping"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <WorkflowMappingPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/workflow-mapping/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <WorkflowMappingFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/workflow-mapping/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <WorkflowMappingFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/rule-setting"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RuleSettingPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/rule-setting/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RuleSettingFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/rule-setting/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RuleSettingFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/auto-credit-setting"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AutoCreditSettingPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/approval-workflow"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ApprovalWorkflowPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/approval-workflow/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ApprovalWorkflowFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/approval-workflow/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ApprovalWorkflowFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/auto-credit-setting/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AutoCreditSettingFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-configuration/auto-credit-setting/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AutoCreditSettingFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AttendancePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance/apply-event"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ApplyEventPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance/face"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <FaceAttendancePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance/my-requests/excess-time-request"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ExcessTimeRequestPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance/excess-time-approval"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ExcessTimeApprovalPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AttendancePolicyPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/late-and-others"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LateAndOthersPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/late-and-others/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LateAndOthersFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/late-and-others/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LateAndOthersFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/week-of-assign"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <WeekOfAssignPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/week-of-assign/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <WeekOffAssignFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/week-of-assign/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <WeekOffAssignFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/holiday-assign"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HolidayAssignPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/holiday-assign/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HolidayAssignFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/holiday-assign/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HolidayAssignFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/excess-time-conversion"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ExcessTimeConversionPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/excess-time-conversion/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ExcessTimeConversionFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/excess-time-conversion/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ExcessTimeConversionFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/ot-usage-rule"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OTUsageRulePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/ot-usage-rule/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OTUsageRuleFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-policy/ot-usage-rule/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OTUsageRuleFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/leave/approvals"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LeaveApprovalPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event/requests"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EventRequestPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event/balance-entry"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EventBalanceEntryPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/leave/apply" element={<Navigate to="/attendance/apply-event" replace />} />
          <Route path="/leave" element={<Navigate to="/attendance/apply-event" replace />} />
          <Route
            path="/time-attendance"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TimeAttendancePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-attendance/shift-master"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ShiftMasterPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-attendance/shift-assign"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ShiftAssignPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-attendance/associate-shift-change"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AssociateShiftChangePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-attendance/associate-shift-grid"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AssociateShiftGridPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-attendance/shift-assign/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ShiftAssignFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-attendance/shift-assign/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ShiftAssignFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-attendance/shift-master/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ShiftMasterFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-attendance/shift-master/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ShiftMasterFormPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PayrollPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll-master"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PayrollMasterPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll/employee-separation"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeeSeparationPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll/employee-rejoin"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeeRejoinPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll/employee-rejoin/edit/:employeeId"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeeRejoinEditPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/salary-structures"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <SalaryStructurePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee-salaries"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeeSalariesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/esop"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EsopListPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/esop/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EsopPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TransactionPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/transfer-promotions"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TransferAndPromotionsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/transfer-promotion-entry"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TransferPromotionEntryPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/emp-code-transfer"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmpCodeTransferPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/paygroup-transfer"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PaygroupTransferPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/paygroup-transfer/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AddPaygroupTransferPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/transfer-promotion-entry/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AddTransferPromotionEntryPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/transfer-promotions/add"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AddTransferPromotionPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction/transfer-promotions/edit/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AddTransferPromotionPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizations"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OrganizationsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/permissions"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PermissionsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr-audit-settings"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HRAuditSettingsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee-master-approval"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeeMasterApprovalPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* 404: redirect authenticated users to dashboard, others see 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
