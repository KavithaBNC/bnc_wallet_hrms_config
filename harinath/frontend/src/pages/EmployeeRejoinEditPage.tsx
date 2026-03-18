import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import EmployeeForm from '../components/employees/EmployeeForm';
import employeeService, { Employee } from '../services/employee.service';
import { useAuthStore } from '../store/authStore';

/**
 * Full-page Employee Edit form for Rejoin flow.
 * Reached from Employee Rejoin list → Edit. No employee list; only the form.
 */
export default function EmployeeRejoinEditPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setError('Employee ID missing');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    employeeService
      .getById(employeeId)
      .then((data) => {
        if (!cancelled) {
          setEmployee(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load employee');
          setEmployee(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleBack = () => {
    navigate('/payroll/employee-rejoin');
  };

  const handleSuccess = () => {
    navigate('/payroll/employee-rejoin');
  };

  const handleCancel = () => {
    navigate('/payroll/employee-rejoin');
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
        <AppHeader
          title="Employee Rejoin"
          subtitle={organizationName ? organizationName : ''}
          onLogout={handleLogout}
        />
        <main className="flex-1 flex items-center justify-center p-6">
          <p className="text-gray-500">Loading employee...</p>
        </main>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
        <AppHeader
          title="Employee Rejoin"
          subtitle={organizationName ? organizationName : ''}
          onLogout={handleLogout}
        />
        <main className="flex-1 p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-medium">{error || 'Employee not found'}</p>
            <button
              type="button"
              onClick={handleBack}
              className="mt-3 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
            >
              Back to Rejoin List
            </button>
          </div>
        </main>
      </div>
    );
  }

  const organizationId = employee.organizationId ?? user?.employee?.organizationId ?? user?.employee?.organization?.id ?? '';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
      <AppHeader
        title="Employee Rejoin"
        subtitle={organizationName ? organizationName : `Edit: ${employee.employeeCode} – ${[employee.firstName, employee.lastName].filter(Boolean).join(' ')}`}
        onLogout={handleLogout}
      />
      <main className="flex-1 min-h-0 overflow-auto w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Rejoin List
          </button>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <EmployeeForm
            employee={employee}
            organizationId={organizationId}
            initialPaygroupId={employee.paygroup?.id ?? undefined}
            initialPaygroupName={employee.paygroup?.name ?? undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            mode="edit"
            rejoinMode={true}
          />
        </div>
      </main>
    </div>
  );
}
