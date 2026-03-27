import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Employee } from '../services/employee.service';
import employeeService from '../services/employee.service';
import EmployeeForm from '../components/employees/EmployeeForm';
import PaygroupSelectionModal from '../components/employees/PaygroupSelectionModal';
import { getEditableTabsFromPermissions, type EmployeeFormTabKey } from '../utils/rbac';
import { getModulePermissions } from '../config/configurator-module-mapping';
import permissionService from '../services/permission.service';

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

  const isNewFromConfigurator = id === 'new';
  const isEdit = Boolean(id) && !isNewFromConfigurator;
  const isCreate = !isEdit;

  // Extract Configurator identifiers from state (used for HRMS lookup below)
  const configStateUserId = (state.employee as any)?.configuratorUserId as number | string | undefined;
  const configStateEmail = (state.employee as any)?.email as string | undefined;

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

  // For Configurator-to-HRMS registration (/employees/edit/new):
  // Check if an HRMS employee already exists for this Configurator user.
  // If found, redirect to the proper /employees/edit/:id URL so all saved HRMS data
  // (DOB, gender, DOJ, etc.) is pre-filled. This handles cases where the employee
  // was previously saved in HRMS but the handleEditUser lookup in EmployeesPage failed.
  useEffect(() => {
    if (!isNewFromConfigurator || (!configStateUserId && !configStateEmail)) return;
    (async () => {
      try {
        let emp: Employee | null = null;
        if (configStateUserId) {
          emp = await employeeService.getByConfiguratorUserId(Number(configStateUserId));
        }
        if (!emp && configStateEmail) {
          emp = await employeeService.getByEmail(configStateEmail);
        }
        if (emp) {
          navigate(`/employees/edit/${emp.id}`, {
            replace: true,
            state: { employee: emp, mode: 'edit' },
          });
        }
      } catch {
        // Lookup failed — stay on create form
      }
    })();
  }, [isNewFromConfigurator, configStateUserId, configStateEmail, navigate]);

  // For create mode: if no paygroup selected yet, show the paygroup modal
  // Skip when prefilled from Configurator (state.employee already has data)
  useEffect(() => {
    if (isCreate && !selectedPaygroupId && !isNewFromConfigurator) {
      setShowPaygroupModal(true);
    }
  }, [isCreate, selectedPaygroupId, isNewFromConfigurator]);

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
    : (isEdit || isNewFromConfigurator)
    ? (mode === 'view' ? 'View Employee' : 'Edit Employee')
    : 'Create Employee';

  // Compute editable tabs (same logic as EmployeesPage)
  // Dynamic: if user doesn't have can_edit on /employees, restrict to personal tabs (self-service)
  const computedEditableTabs = rejoinMode
    ? undefined
    : employee && mode !== 'view'
    ? canUpdateByRole
      ? undefined
      : (editableTabsFromPermissions ??
        (!modulePerms.can_edit && user?.employee?.id === employee.id
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
          <button
            onClick={() => navigate('/employees')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Back to Employees
          </button>
        </div>
      </div>
    );
  }

  // Create mode: waiting for paygroup selection (skip when prefilled from Configurator)
  if (isCreate && !selectedPaygroupId && !isNewFromConfigurator) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <button
            onClick={() => navigate('/employees')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Employees
          </button>
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
        <button
          onClick={() => navigate('/employees')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Employees
        </button>
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
