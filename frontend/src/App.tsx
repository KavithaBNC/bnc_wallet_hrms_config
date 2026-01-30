import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import LeavePage from './pages/LeavePage';
import PayrollPage from './pages/PayrollPage';
import SalaryStructurePage from './pages/SalaryStructurePage';
import EmployeeSalariesPage from './pages/EmployeeSalariesPage';
import OrganizationsPage from './pages/OrganizationsPage';
import PermissionsPage from './pages/PermissionsPage';
import HRAuditSettingsPage from './pages/HRAuditSettingsPage';
import EmployeeMasterApprovalPage from './pages/EmployeeMasterApprovalPage';

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

          {/* 404 Page */}
          <Route
            path="*"
            element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-gray-900">404</h1>
                  <p className="text-xl text-gray-600 mt-4">Page not found</p>
                  <a href="/" className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Go Home
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
