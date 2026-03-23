import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import organizationService, { Organization, CreateOrganizationData, OrganizationDevice } from '../services/organization.service';
import Modal from '../components/common/Modal';
import AppHeader from '../components/layout/AppHeader';
import { APP_MODULES } from '../config/modules';
import { getModulePermissions } from '../config/configurator-module-mapping';

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateAdminForm, setShowCreateAdminForm] = useState(false);
  const [showAssignModulesForm, setShowAssignModulesForm] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgModules, setOrgModules] = useState<string[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [savingModules, setSavingModules] = useState(false);
  const [syncingShiftModule, setSyncingShiftModule] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [orgDevices, setOrgDevices] = useState<Record<string, OrganizationDevice[]>>({});
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [selectedOrgForDevices, setSelectedOrgForDevices] = useState<Organization | null>(null);
  const [deviceForm, setDeviceForm] = useState({ serialNumber: '', name: '' });
  const [addingDevice, setAddingDevice] = useState(false);
  const [loadingDevicesForModal, setLoadingDevicesForModal] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [showEditIdModal, setShowEditIdModal] = useState(false);
  const [selectedOrgForEditId, setSelectedOrgForEditId] = useState<Organization | null>(null);
  const [editIdForm, setEditIdForm] = useState<{ employeeIdPrefix: string; employeeIdStartingNumber: number | '' }>({
    employeeIdPrefix: '',
    employeeIdStartingNumber: '',
  });
  const [savingEditId, setSavingEditId] = useState(false);

  // Form states
  const [orgFormData, setOrgFormData] = useState<CreateOrganizationData>({
    name: '',
    legalName: '',
    industry: '',
    sizeRange: undefined,
    timezone: 'UTC',
    currency: 'USD',
    employeeIdPrefix: '',
    employeeIdStartingNumber: undefined,
  });

  const [adminFormData, setAdminFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  // Check organization management permissions (system-level access)
  const orgPerms = getModulePermissions('/organizations');
  const canManageOrgs = orgPerms.can_edit;

  useEffect(() => {
    if (canManageOrgs) {
      fetchOrganizations();
    }
  }, [canManageOrgs, pagination.page, searchTerm]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await organizationService.getAll(pagination.page, pagination.limit, searchTerm || undefined);
      setOrganizations(response.organizations);
      setPagination(response.pagination);
      // Fetch devices for each org in parallel
      const devicesMap: Record<string, OrganizationDevice[]> = {};
      await Promise.all(
        response.organizations.map(async (org) => {
          try {
            const devices = await organizationService.getDevices(org.id);
            devicesMap[org.id] = devices;
          } catch {
            devicesMap[org.id] = [];
          }
        })
      );
      setOrgDevices(devicesMap);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to fetch organizations';
      setError(msg);
      console.error('Error fetching organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const newOrg = await organizationService.create(orgFormData);
      setOrganizations([newOrg, ...organizations]);
      setShowCreateForm(false);
      setOrgFormData({
        name: '',
        legalName: '',
        industry: '',
        sizeRange: undefined,
        timezone: 'UTC',
        currency: 'USD',
        employeeIdPrefix: '',
        employeeIdStartingNumber: undefined,
      });
      alert('Organization created successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create organization');
    }
  };

  const assignableModules = APP_MODULES.filter((m) => m.visibility !== 'super_admin_only');

  const handleSyncShiftModule = async () => {
    if (!confirm('Add Time attendance & Shift Master to all organizations that already have modules? (Fixes ABC etc.)')) return;
    try {
      setSyncingShiftModule(true);
      setError(null);
      const result = await organizationService.syncShiftModule();
      alert(result.updated > 0 ? `Done. Updated ${result.updated} organization(s). Orgs with no modules (e.g. ABC) now have full menus; others got Time attendance & Shift. Log in as Org Admin or HR (e.g. Deepa) to see menus.` : 'All organizations already have the shift module.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncingShiftModule(false);
    }
  };

  const openAssignModules = async (org: Organization) => {
    setSelectedOrg(org);
    setShowAssignModulesForm(true);
    setError(null);
    try {
      setLoadingModules(true);
      const modules = await organizationService.getModules(org.id);
      setOrgModules(modules);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load modules');
      setOrgModules([]);
    } finally {
      setLoadingModules(false);
    }
  };

  const toggleOrgModule = (resource: string) => {
    setOrgModules((prev) =>
      prev.includes(resource) ? prev.filter((r) => r !== resource) : [...prev, resource]
    );
  };

  const handleSaveModules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    try {
      setSavingModules(true);
      setError(null);
      await organizationService.setModules(selectedOrg.id, orgModules);
      setShowAssignModulesForm(false);
      setSelectedOrg(null);
      alert(`Modules updated. Org Admin for ${selectedOrg.name} will only see the selected modules.`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save modules');
    } finally {
      setSavingModules(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;

    try {
      setError(null);
      const result = await organizationService.createAdmin(selectedOrg.id, adminFormData);
      // Clear form and close modal
      setAdminFormData({ email: '', password: '', firstName: '', lastName: '' });
      setShowCreateAdminForm(false);
      setSelectedOrg(null);
      setError(null);
      alert(`Organization admin created successfully!\nEmail: ${result.user.email}\nRole: ${result.user.role}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create organization admin');
    }
  };

  if (!canManageOrgs) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">
            Only Super Administrators can access Organization Management (create organization and create organization admin).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader title="Organization Management" onLogout={handleLogout} />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => {
              setOrgFormData({
                name: '',
                legalName: '',
                industry: '',
                sizeRange: undefined,
                timezone: 'UTC',
                currency: 'USD',
              });
              setError(null);
              setOrgFormData({
              name: '',
              legalName: '',
              industry: '',
              sizeRange: undefined,
              timezone: 'UTC',
              currency: 'USD',
              employeeIdPrefix: '',
              employeeIdStartingNumber: undefined,
            });
            setError(null);
            setShowCreateForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Create Organization
          </button>
          <button
            type="button"
            onClick={handleSyncShiftModule}
            disabled={syncingShiftModule}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
            title="Add default modules (incl. Time attendance & Shift) to all orgs; fix orgs like ABC so HR (e.g. Deepa) sees menus"
          >
            {syncingShiftModule ? 'Syncing...' : 'Sync shift module for all orgs'}
          </button>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-red-800 text-sm">{error}</p>
              {error.toLowerCase().includes('connect') && (
                <p className="text-red-700 text-xs mt-2">
                  Tip: Run <code className="bg-red-100 px-1 rounded">npm run dev</code> from project root to start both backend and frontend.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                fetchOrganizations();
              }}
              className="shrink-0 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-sm font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPagination({ ...pagination, page: 1 });
            }}
            className="w-full max-w-md h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Organizations List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading organizations...</p>
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">No organizations found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => (
              <div key={org.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{org.name}</h3>
                    {org.legalName && (
                      <p className="text-sm text-gray-500 mt-1">{org.legalName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {org.industry && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Industry:</span> {org.industry}
                    </p>
                  )}
                  {org.sizeRange && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Size:</span> {org.sizeRange}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Timezone:</span> {org.timezone}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Currency:</span> {org.currency}
                  </p>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Devices:</span>
                    {(orgDevices[org.id]?.length ?? 0) === 0 ? (
                      <p className="text-gray-500 mt-0.5">None</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 list-disc list-inside text-gray-800">
                        {orgDevices[org.id]?.map((d) => (
                          <li key={d.id}>{d.name || d.serialNumber}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      setSelectedOrgForDevices(org);
                      setShowDevicesModal(true);
                      setDeviceForm({ serialNumber: '', name: '' });
                      setDevicesError(null);
                      setLoadingDevicesForModal(true);
                      try {
                        const devices = await organizationService.getDevices(org.id);
                        setOrgDevices((prev) => ({ ...prev, [org.id]: devices }));
                      } catch {
                        setOrgDevices((prev) => ({ ...prev, [org.id]: prev[org.id] ?? [] }));
                      } finally {
                        setLoadingDevicesForModal(false);
                      }
                    }}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition text-sm"
                  >
                    Devices {orgDevices[org.id]?.length ? `(${orgDevices[org.id].length})` : ''}
                  </button>
                  <button
                    onClick={() => openAssignModules(org)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                  >
                    Assign modules
                  </button>
                  <button
                    onClick={() => {
                      setSelectedOrg(org);
                      setAdminFormData({
                        email: '',
                        password: '',
                        firstName: '',
                        lastName: '',
                      });
                      setError(null);
                      setShowCreateAdminForm(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                  >
                    Create Admin
                  </button>
                  <button
                    onClick={() => {
                      setSelectedOrgForEditId(org);
                      setEditIdForm({
                        employeeIdPrefix: org.employeeIdPrefix ?? '',
                        employeeIdStartingNumber: org.employeeIdNextNumber ?? '',
                      });
                      setShowEditIdModal(true);
                      setError(null);
                    }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"
                    title="Edit Employee ID Prefix and Next Number"
                  >
                    Edit ID settings
                  </button>
                  <button
                    onClick={() => alert(`Organization ID: ${org.id}\nName: ${org.name}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex justify-center space-x-2">
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              disabled={pagination.page === 1}
              className="px-4 py-2 border border-black rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-2 border border-black rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </main>

      {/* Create Organization Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false);
          setError(null);
          // Clear form data when closing
          setOrgFormData({
            name: '',
            legalName: '',
            industry: '',
            sizeRange: undefined,
            timezone: 'UTC',
            currency: 'USD',
            employeeIdPrefix: '',
            employeeIdStartingNumber: undefined,
          });
        }}
        title="Create New Organization"
      >
        <form onSubmit={handleCreateOrganization} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={orgFormData.name}
              onChange={(e) => setOrgFormData({ ...orgFormData, name: e.target.value })}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Acme Corporation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Legal Name
            </label>
            <input
              type="text"
              value={orgFormData.legalName}
              onChange={(e) => setOrgFormData({ ...orgFormData, legalName: e.target.value })}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Acme Corporation Inc"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Industry
              </label>
              <input
                type="text"
                value={orgFormData.industry}
                onChange={(e) => setOrgFormData({ ...orgFormData, industry: e.target.value })}
                className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Technology"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Size
              </label>
              <select
                value={orgFormData.sizeRange || ''}
                onChange={(e) => setOrgFormData({ ...orgFormData, sizeRange: e.target.value as any })}
                className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select size</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="501-1000">501-1000 employees</option>
                <option value="1000+">1000+ employees</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <input
                type="text"
                value={orgFormData.timezone}
                onChange={(e) => setOrgFormData({ ...orgFormData, timezone: e.target.value })}
                className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="UTC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <input
                type="text"
                maxLength={3}
                value={orgFormData.currency}
                onChange={(e) => setOrgFormData({ ...orgFormData, currency: e.target.value.toUpperCase() })}
                className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="USD"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Employee ID Setup</p>
            <p className="text-xs text-gray-500 mb-3">
              <strong>Prefix + Suffix:</strong> e.g. prefix <strong>BNC</strong> + starting number <strong>1000</strong> → BNC1000, BNC1001, …<br />
              <strong>No prefix:</strong> Leave prefix empty → suffix only: 1000, 1001, 1002, …
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID Prefix
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={orgFormData.employeeIdPrefix ?? ''}
                  onChange={(e) => setOrgFormData({ ...orgFormData, employeeIdPrefix: e.target.value.trim() || undefined })}
                  className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Leave empty for suffix only (1000, 1001, …)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Starting Number
                </label>
                <input
                  type="number"
                  min={0}
                  value={orgFormData.employeeIdStartingNumber ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOrgFormData({
                      ...orgFormData,
                      employeeIdStartingNumber: v === '' ? undefined : Math.max(0, parseInt(v, 10) || 0),
                    });
                  }}
                  className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 1 or 1000 (default: 1000 if prefix empty)"
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setError(null);
              }}
              className="flex-1 px-4 py-2 border border-black rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Organization
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Admin Modal */}
      <Modal
        isOpen={showCreateAdminForm}
        onClose={() => {
          setShowCreateAdminForm(false);
          setSelectedOrg(null);
          setError(null);
          // Clear form data when closing
          setAdminFormData({
            email: '',
            password: '',
            firstName: '',
            lastName: '',
          });
        }}
        title={`Create Organization Admin - ${selectedOrg?.name || ''}`}
      >
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={adminFormData.email}
              onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="admin@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={adminFormData.password}
              onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="SecurePassword@123"
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be at least 8 characters with uppercase, lowercase, number, and special character
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={adminFormData.firstName}
                onChange={(e) => setAdminFormData({ ...adminFormData, firstName: e.target.value })}
                className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="John"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={adminFormData.lastName}
                onChange={(e) => setAdminFormData({ ...adminFormData, lastName: e.target.value })}
                className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Admin"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowCreateAdminForm(false);
                setSelectedOrg(null);
                setError(null);
              }}
              className="shrink-0 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="shrink-0 min-w-[7rem] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
            >
              Create Admin
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee ID Prefix & Starting Number modal */}
      <Modal
        isOpen={showEditIdModal}
        onClose={() => {
          setShowEditIdModal(false);
          setSelectedOrgForEditId(null);
          setError(null);
        }}
        title={selectedOrgForEditId ? `Employee ID settings – ${selectedOrgForEditId.name}` : 'Employee ID settings'}
      >
        {selectedOrgForEditId && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedOrgForEditId) return;
              setSavingEditId(true);
              setError(null);
              try {
                const updated = await organizationService.update(selectedOrgForEditId.id, {
                  employeeIdPrefix: editIdForm.employeeIdPrefix.trim() || undefined,
                  ...(editIdForm.employeeIdStartingNumber !== ''
                    ? { employeeIdStartingNumber: Number(editIdForm.employeeIdStartingNumber) }
                    : {}),
                });
                setOrganizations((prev) =>
                  prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
                );
                setShowEditIdModal(false);
                setSelectedOrgForEditId(null);
                alert('Employee ID settings saved. New employees will get codes using this prefix and next number.');
              } catch (err: any) {
                setError(err.response?.data?.message || 'Failed to update settings');
              } finally {
                setSavingEditId(false);
              }
            }}
            className="space-y-4"
          >
            <p className="text-sm text-gray-600">
              These values control how new employee codes are generated for this organization. Prefix + next number → e.g. <strong>BNC</strong> + <strong>5</strong> → BNC5, BNC6, …
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID Prefix</label>
                <input
                  type="text"
                  maxLength={20}
                  value={editIdForm.employeeIdPrefix}
                  onChange={(e) =>
                    setEditIdForm((f) => ({ ...f, employeeIdPrefix: e.target.value }))
                  }
                  className="w-full h-10 px-4 py-2 bg-white text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. BNC or leave empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Number</label>
                <input
                  type="number"
                  min={0}
                  value={editIdForm.employeeIdStartingNumber === '' ? '' : editIdForm.employeeIdStartingNumber}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditIdForm((f) => ({
                      ...f,
                      employeeIdStartingNumber:
                        v === '' ? '' : Math.max(0, parseInt(v, 10) || 0),
                    }));
                  }}
                  className="w-full h-10 px-4 py-2 bg-white text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Next code number"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Next employee will get this number (then it increments).
                </p>
              </div>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowEditIdModal(false);
                  setSelectedOrgForEditId(null);
                  setError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEditId}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
              >
                {savingEditId ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Assign modules modal (SAP-style: which modules this org gets; Org Admin will only see these) */}
      <Modal
        isOpen={showAssignModulesForm}
        onClose={() => {
          setShowAssignModulesForm(false);
          setSelectedOrg(null);
          setError(null);
        }}
        title={`Assign modules – ${selectedOrg?.name || ''}`}
      >
        <p className="text-sm text-gray-600 mb-4">
          Select which modules this organization can use. Org Admin will only see and use these modules.
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {loadingModules ? (
          <p className="text-gray-500">Loading modules...</p>
        ) : (
          <form onSubmit={handleSaveModules} className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {assignableModules.map((mod) => (
                <label
                  key={mod.path}
                  className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={orgModules.includes(mod.resource)}
                    onChange={() => toggleOrgModule(mod.resource)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">{mod.label}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowAssignModulesForm(false);
                  setSelectedOrg(null);
                  setError(null);
                }}
                className="shrink-0 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingModules}
                className="shrink-0 min-w-[7rem] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
              >
                {savingModules ? 'Saving...' : 'Save modules'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Biometric devices modal: list + add */}
      <Modal
        isOpen={showDevicesModal}
        onClose={() => {
          setShowDevicesModal(false);
          setSelectedOrgForDevices(null);
          setDevicesError(null);
          setDeviceForm({ serialNumber: '', name: '' });
        }}
        title={selectedOrgForDevices ? `Devices – ${selectedOrgForDevices.name}` : 'Devices'}
      >
        {selectedOrgForDevices && (
          <div className="space-y-4">
            {devicesError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {devicesError}
              </div>
            )}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Registered devices</h4>
              {loadingDevicesForModal ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : (orgDevices[selectedOrgForDevices.id]?.length ?? 0) === 0 ? (
                <p className="text-gray-500 text-sm">No devices. Add one below.</p>
              ) : (
                <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                  {(orgDevices[selectedOrgForDevices.id] ?? []).map((d) => (
                    <li key={d.id}>
                      {d.name || d.serialNumber} <span className="text-gray-500">({d.serialNumber})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Add device</h4>
              <p className="text-xs text-gray-500 mb-2">
                Use the serial number the device sends (e.g. in /iclock/cdata). Employee Code in HRMS must match the device user id for punches to show.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!selectedOrgForDevices || !deviceForm.serialNumber.trim()) return;
                  try {
                    setAddingDevice(true);
                    setDevicesError(null);
                    const device = await organizationService.addDevice(selectedOrgForDevices.id, {
                      serialNumber: deviceForm.serialNumber.trim(),
                      name: deviceForm.name.trim() || undefined,
                    });
                    setOrgDevices((prev) => ({
                      ...prev,
                      [selectedOrgForDevices.id]: [...(prev[selectedOrgForDevices.id] ?? []), device],
                    }));
                    setDeviceForm({ serialNumber: '', name: '' });
                    setDevicesError(null);
                  } catch (err: any) {
                    setDevicesError(err.response?.data?.message || 'Failed to add device');
                  } finally {
                    setAddingDevice(false);
                  }
                }}
                className="flex flex-wrap items-end gap-3"
              >
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Serial number *</label>
                  <input
                    type="text"
                    value={deviceForm.serialNumber}
                    onChange={(e) => setDeviceForm((f) => ({ ...f, serialNumber: e.target.value }))}
                    placeholder="e.g. CQZ7224460246"
                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name (optional)</label>
                  <input
                    type="text"
                    value={deviceForm.name}
                    onChange={(e) => setDeviceForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Reception"
                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingDevice || !deviceForm.serialNumber.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {addingDevice ? 'Adding...' : 'Add device'}
                </button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
