import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useHRAuditStore } from '../store/hrAuditStore';
import { EMPLOYEE_MODULES } from '../constants/employeeModules';
import AppHeader from '../components/layout/AppHeader';

const ROLES = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'HR_MANAGER', label: 'HR Manager' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'ORG_ADMIN', label: 'Org Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

export default function HRAuditSettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const byRole = useHRAuditStore((s) => s.byRole);
  const { getSettingsForRole, setSettingsForRole, updateModule } = useHRAuditStore();
  const [role, setRole] = useState('EMPLOYEE');
  const settings = useMemo(() => getSettingsForRole(role), [role, byRole, getSettingsForRole]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  /** Snapshot of last saved state for current role – Cancel restores to this */
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<ReturnType<typeof getSettingsForRole> | null>(null);

  // When role changes, set baseline for Cancel to current persisted state for that role
  useEffect(() => {
    const current = getSettingsForRole(role);
    setLastSavedSnapshot({
      ...current,
      modules: current.modules.map((m) => ({ ...m })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when role changes
  }, [role]);

  const modules = useMemo(() => {
    return EMPLOYEE_MODULES.map((m) => {
      const perm = settings.modules.find((p) => p.id === m.id);
      return perm
        ? { ...perm, name: m.name }
        : {
            id: m.id,
            name: m.name,
            viewable: true,
            editable: false,
            mandatory: false,
            approval: false,
          };
    });
  }, [settings.modules]);

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setSaveMessage(null);
  };

  const handleModuleChange = (moduleId: string, field: 'viewable' | 'editable' | 'mandatory' | 'approval', value: boolean) => {
    updateModule(role, moduleId as any, field, value);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const toSave = {
        role,
        allowDelete: settings.allowDelete,
        addApproval: settings.addApproval,
        modules,
      };
      setSettingsForRole(role, toSave);
      await new Promise((r) => setTimeout(r, 300));
      setLastSavedSnapshot({ ...toSave, modules: toSave.modules.map((m) => ({ ...m })) });
      setSaveMessage({ type: 'success', text: 'HR Audit settings saved. Employee view/edit is based on these permissions.' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (lastSavedSnapshot && lastSavedSnapshot.role === role) {
      setSettingsForRole(role, {
        role: lastSavedSnapshot.role,
        allowDelete: lastSavedSnapshot.allowDelete,
        addApproval: lastSavedSnapshot.addApproval,
        modules: lastSavedSnapshot.modules.map((m) => ({ ...m })),
      });
    }
    setSaveMessage(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader title="HR Audit Settings" onLogout={handleLogout} />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-nowrap items-center justify-between gap-3 mb-6 min-w-0">
          <h1 className="text-2xl font-bold text-blue-900 whitespace-nowrap">HR Audit Settings</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Role:</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="h-10 px-3 rounded-md border border-gray-300 bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Delete:</span>
                <div className="flex rounded-full overflow-hidden border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setSettingsForRole(role, { allowDelete: true })}
                    className={`px-4 py-1.5 text-xs font-medium ${
                      settings.allowDelete ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsForRole(role, { allowDelete: false })}
                    className={`px-4 py-1.5 text-xs font-medium ${
                      !settings.allowDelete ? 'bg-red-500 text-white' : 'bg-white text-gray-700'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Add Approval:</span>
                <div className="flex rounded-full overflow-hidden border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setSettingsForRole(role, { addApproval: true })}
                    className={`px-4 py-1.5 text-xs font-medium ${
                      settings.addApproval ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsForRole(role, { addApproval: false })}
                    className={`px-4 py-1.5 text-xs font-medium ${
                      !settings.addApproval ? 'bg-red-500 text-white' : 'bg-white text-gray-700'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Module
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-24">
                    Viewable
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-24">
                    Editable
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-24">
                    Mandatory
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-24">
                    Approval
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {modules.map((module) => (
                  <tr key={module.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                      {module.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={module.viewable}
                        onChange={(e) => handleModuleChange(module.id, 'viewable', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={module.editable}
                        onChange={(e) => handleModuleChange(module.id, 'editable', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={module.mandatory}
                        onChange={(e) => handleModuleChange(module.id, 'mandatory', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={module.approval}
                        onChange={(e) => handleModuleChange(module.id, 'approval', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {saveMessage && (
            <div
              className={`rounded-lg p-3 text-sm ${
                saveMessage.type === 'success' ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {saveMessage.text}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
