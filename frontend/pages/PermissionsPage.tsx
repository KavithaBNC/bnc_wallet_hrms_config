import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import permissionService, { Permission, RolePermission } from '../services/permission.service';
import AppHeader from '../components/layout/AppHeader';

type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE';

const PermissionsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>('MANAGER');
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loadingRolePerms, setLoadingRolePerms] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Check if user can manage permissions
  const canManagePermissions = user?.role === 'ORG_ADMIN' || user?.role === 'HR_MANAGER';

  useEffect(() => {
    loadPermissions();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      loadRolePermissions();
    }
  }, [selectedRole]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await permissionService.getAll();
      setPermissions(result.permissions);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load permissions');
      console.error('Error loading permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async () => {
    try {
      setLoadingRolePerms(true);
      const perms = await permissionService.getRolePermissions(selectedRole);
      setRolePermissions(perms);
      setSelectedPermissions(perms.map((rp) => rp.permission.id));
    } catch (err: any) {
      console.error('Error loading role permissions:', err);
    } finally {
      setLoadingRolePerms(false);
    }
  };

  const handleAssignPermissions = async () => {
    try {
      setError(null);
      const result = await permissionService.assignPermissions({
        role: selectedRole,
        permissionIds: selectedPermissions,
      });
      alert(`Successfully assigned ${result.assigned} permission(s). ${result.skipped} already assigned.`);
      await loadRolePermissions();
      setShowAssignModal(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign permissions');
      console.error('Error assigning permissions:', err);
    }
  };

  const handleRemovePermission = async (permissionId: string) => {
    if (!confirm('Are you sure you want to remove this permission from the role?')) {
      return;
    }

    try {
      setError(null);
      await permissionService.removePermission({
        role: selectedRole,
        permissionId,
      });
      alert('Permission removed successfully');
      await loadRolePermissions();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove permission');
      console.error('Error removing permission:', err);
    }
  };

  const handleReplacePermissions = async () => {
    if (!confirm(`Replace all permissions for ${selectedRole}? This will remove existing permissions and assign only the selected ones.`)) {
      return;
    }

    try {
      setError(null);
      const result = await permissionService.replaceRolePermissions(
        selectedRole,
        selectedPermissions
      );
      alert(`Replaced permissions: removed ${result.removed}, assigned ${result.assigned}`);
      await loadRolePermissions();
      setShowAssignModal(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to replace permissions');
      console.error('Error replacing permissions:', err);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    const module = perm.module || 'Other';
    if (!acc[module]) {
      acc[module] = [];
    }
    acc[module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const modules = Object.keys(permissionsByModule).sort();

  const filteredPermissions =
    selectedModule === 'all'
      ? permissions
      : permissionsByModule[selectedModule] || [];

  const rolePermissionIds = new Set(rolePermissions.map((rp) => rp.permission.id));

  if (!canManagePermissions) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">
            Only HR_ADMIN and ORG_ADMIN can manage permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Permission Management"
        subtitle="Manage role permissions dynamically"
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Assign Permissions
          </button>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Role Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Role</h2>
          <div className="flex space-x-4">
            {(['MANAGER', 'EMPLOYEE'] as UserRole[]).map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-6 py-2 rounded-lg font-medium transition ${
                  selectedRole === role
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Note: HR_MANAGER and ORG_ADMIN have all permissions by default.
          </p>
        </div>

        {/* Role Permissions Summary */}
        {selectedRole && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedRole} Permissions ({rolePermissions.length})
              </h2>
              {loadingRolePerms && (
                <span className="text-sm text-gray-500">Loading...</span>
              )}
            </div>
            {rolePermissions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {rolePermissions.map((rp) => (
                  <div
                    key={rp.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {rp.permission.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rp.permission.resource}.{rp.permission.action}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemovePermission(rp.permission.id)}
                      className="ml-2 text-red-600 hover:text-red-700 text-sm"
                      title="Remove permission"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No permissions assigned. Use "Assign Permissions" to add permissions.
              </p>
            )}
          </div>
        )}

        {/* All Permissions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              All Permissions ({permissions.length})
            </h2>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading permissions...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {modules
                .filter((module) => selectedModule === 'all' || module === selectedModule)
                .map((module) => (
                  <div key={module} className="border-b border-gray-200 pb-4 last:border-0">
                    <h3 className="text-md font-semibold text-gray-900 mb-3">{module}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {permissionsByModule[module].map((perm) => {
                        const isAssigned = rolePermissionIds.has(perm.id);
                        return (
                          <div
                            key={perm.id}
                            className={`p-3 rounded-lg border ${
                              isAssigned
                                ? 'bg-green-50 border-green-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {perm.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {perm.resource}.{perm.action}
                                </p>
                                {perm.description && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    {perm.description}
                                  </p>
                                )}
                              </div>
                              {isAssigned && (
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  Assigned
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </main>

      {/* Assign Permissions Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  Assign Permissions to {selectedRole}
                </h2>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedPermissions(rolePermissions.map((rp) => rp.permission.id));
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex space-x-3">
                <button
                  onClick={() => {
                    setSelectedPermissions(permissions.map((p) => p.id));
                  }}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedPermissions([])}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Clear All
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  {selectedPermissions.length} selected
                </span>
              </div>

              <div className="space-y-4">
                {modules.map((module) => (
                  <div key={module} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex items-center mb-3">
                      <input
                        type="checkbox"
                        checked={permissionsByModule[module].every((p) =>
                          selectedPermissions.includes(p.id)
                        )}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissions((prev) => [
                              ...prev,
                              ...permissionsByModule[module]
                                .map((p) => p.id)
                                .filter((id) => !prev.includes(id)),
                            ]);
                          } else {
                            setSelectedPermissions((prev) =>
                              prev.filter(
                                (id) =>
                                  !permissionsByModule[module].some((p) => p.id === id)
                              )
                            );
                          }
                        }}
                        className="mr-2"
                      />
                      <h3 className="text-md font-semibold text-gray-900">{module}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-6">
                      {permissionsByModule[module].map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="mr-2"
                          />
                          <div className="flex-1">
                            <span className="text-sm text-gray-900">{perm.name}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({perm.resource}.{perm.action})
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedPermissions(rolePermissions.map((rp) => rp.permission.id));
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleReplacePermissions}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Replace All
              </button>
              <button
                onClick={handleAssignPermissions}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Assign Selected ({selectedPermissions.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionsPage;
