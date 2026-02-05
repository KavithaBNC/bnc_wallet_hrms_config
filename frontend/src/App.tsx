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
import AttendancePage from './pages/AttendancePage';
import FaceAttendancePage from './pages/FaceAttendancePage';
import LeavePage from './pages/LeavePage';
import TimeAttendancePage from './pages/TimeAttendancePage';
import ShiftMasterPage from './pages/ShiftMasterPage';
import ShiftMasterFormPage from './pages/ShiftMasterFormPage';
import ShiftAssignPage from './pages/ShiftAssignPage';
import ShiftAssignFormPage from './pages/ShiftAssignFormPage';
import AssociateShiftChangePage from './pages/AssociateShiftChangePage';
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
import NotFoundPage from './pages/NotFoundPage';

function App() {
  const { isAuthenticated, loadUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      loadUser();
    }
  }, [isAuthenticated, loadUser]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
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
            path="/leave"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LeavePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
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
