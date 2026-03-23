import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Employee } from '../services/employee.service';
import employeeService from '../services/employee.service';
import EmployeeForm from '../components/employees/EmployeeForm';
import PaygroupSelectionModal from '../components/employees/PaygroupSelectionModal';
import { getEditableTabsFromPermissions, resolveBaseRole, type EmployeeFormTabKey } from '../utils/rbac';
import { getModulePermissions } from '../config/configurator-module-mapping';
import permissionService from '../services/permission.service';
import BackNavigation from '../components/common/BackNavigation';

interface LocationState {
  employee?: Employee | null;
  organizationId?: string;
  paygroupId?: string;
  paygroupName?: string;
  mode?: 'view' | 'edit';
  rejoinMode?: boolean;
}

export default function EmployeeFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;

  const { user } = useAuthStore();

  const isEdit = Boolean(id);
  const isCreate = !isEdit;

  const [employee, setEmployee] = useState<Employee | null>(state.employee ?? null);
  const [loading, setLoading] = useState(isEdit && !state.employee);
  const [error, setError] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<{ resource: string; action: string }[]>([]);

  // Paygroup selection for create mode
  const [showPaygroupModal, setShowPaygroupModal] = useState(false);
  const paygroupSubmittedRef = useRef(false);
  const [selectedPaygroupId, setSelectedPaygroupId] = useState<string | null>(state.paygroupId ?? null);
  const [selectedPaygroupName, setSelectedPaygroupName] = useState<string | null>(state.paygroupName ?? null);

  const isViewRoute = location.pathname.includes('/employees/view/');
  const mode = state.mode ?? (isViewRoute ? 'view' : 'edit');
  const rejoinMode = state.rejoinMode ?? false;

  const organizationId =
    state.organizationId ||
    user?.employee?.organizationId ||
    user?.employee?.organization?.id ||
    (user as any)?.organizationId ||
    '';

  const baseRole = resolveBaseRole(user?.role);
  const modulePerms = getModulePermissions('/employees');
  const canUpdateByRole = modulePerms.can_edit;

  // Fetch permissions
  useEffect(() => {
    if (!user) return;
    permissionService.getUserPermissions().then((list) => {
      setUserPermissions(list.map((p) => ({ resource: p.resource, action: p.action })));
    }).catch(() => setUserPermissions([]));
  }, [user?.id]);

  const editableTabsFromPermissions = getEditableTabsFromPermissions(userPermissions);

  // For edit mode: if no employee data passed via state, fetch it
  useEffect(() => {
    if (!isEdit || !id || state.employee) return;
    setLoading(true);
    employeeService.getById(id)
      .then((emp) => {
        setEmployee(emp);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load employee', err);
        setError('Failed to load employee details.');
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // For create mode: if no paygroup selected yet, show the paygroup modal
  useEffect(() => {
    if (isCreate && !selectedPaygroupId) {
      setShowPaygroupModal(true);
    }
  }, [isCreate, selectedPaygroupId]);

  const handlePaygroupSubmit = (paygroupId: string, paygroupName: string) => {
    paygroupSubmittedRef.current = true;
    setSelectedPaygroupId(paygroupId);
    setSelectedPaygroupName(paygroupName);
    setShowPaygroupModal(false);
  };

  const handlePaygroupClose = () => {
    // Only navigate back if user cancelled (not after successful submit)
    if (!paygroupSubmittedRef.current) {
      navigate('/employees');
    }
  };

  const handleSuccess = () => {
    navigate('/employees');
  };

  const handleCancel = () => {
    navigate('/employees');
  };

  const pageTitle = rejoinMode
    ? 'Employee Rejoin'
    : isEdit
    ? (mode === 'view' ? 'View Employee' : 'Edit Employee')
    : 'Create Employee';

  // Compute editable tabs (same logic as EmployeesPage)
  const computedEditableTabs = rejoinMode
    ? undefined
    : employee && mode !== 'view'
    ? canUpdateByRole
      ? undefined
      : (editableTabsFromPermissions ??
        ((baseRole === 'EMPLOYEE' || baseRole === 'MANAGER') && user?.employee?.id === employee.id
          ? (['personal', 'academic', 'previousEmployment', 'family'] as EmployeeFormTabKey[])
          : undefined))
    : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading employee details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <BackNavigation to="/employees" label="Employees" />
        </div>
      </div>
    );
  }

  // Create mode: waiting for paygroup selection
  if (isCreate && !selectedPaygroupId) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <BackNavigation to="/employees" label="Employees" />
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-gray-500 mt-1">Create Employee</p>
        </div>
        {showPaygroupModal && (
          <PaygroupSelectionModal
            isOpen={showPaygroupModal}
            onClose={handlePaygroupClose}
            organizationId={organizationId}
            onSubmit={handlePaygroupSubmit}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6 min-w-0 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <BackNavigation to="/employees" label="Employees" />
        <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
        <p className="text-gray-500 mt-1">{pageTitle}</p>
      </div>

      {/* Employee Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-x-hidden">
        <EmployeeForm
          key={employee?.id ?? 'create'}
          employee={employee}
          organizationId={organizationId ?? employee?.organizationId ?? ''}
          initialPaygroupId={selectedPaygroupId ?? undefined}
          initialPaygroupName={selectedPaygroupName ?? undefined}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          mode={mode}
          rejoinMode={rejoinMode}
          editableTabs={computedEditableTabs}
        />
      </div>
    </div>
  );
}
