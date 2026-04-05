import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import { getModulePermissions } from '../config/configurator-module-mapping';
import organizationService, { OrganizationDevice } from '../services/organization.service';

export default function DeviceSettingPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationId =
    (user as any)?.employee?.organizationId ||
    (user as any)?.employee?.organization?.id ||
    (user as any)?.organizationId;
  const organizationName = (user as any)?.employee?.organization?.name || '';

  const modulePerms = getModulePermissions('/device-setting');
  const permsB = getModulePermissions('/attendance');
  const canAdd = modulePerms.can_add || permsB.can_add;

  const [devices, setDevices] = useState<OrganizationDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add device form
  const [serialNumber, setSerialNumber] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchDevices = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await organizationService.getDevices(organizationId);
      setDevices(list);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim() || !organizationId) return;
    setAdding(true);
    setAddError('');
    try {
      const device = await organizationService.addDevice(organizationId, {
        serialNumber: serialNumber.trim(),
        name: deviceName.trim() || undefined,
      });
      setDevices((prev) => [...prev, device]);
      setSerialNumber('');
      setDeviceName('');
      setToast({ msg: 'Device added successfully', type: 'success' });
    } catch (err: any) {
      setAddError(err?.response?.data?.message || 'Failed to add device');
    } finally {
      setAdding(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!organizationId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Device Setting" subtitle={organizationName || undefined} onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
            No organization assigned. Please contact your administrator.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader title="Device Setting" subtitle={organizationName || undefined} onLogout={handleLogout} />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1200px] mx-auto">

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
            <span className="font-semibold text-gray-900">Attendance</span>
            <span className="mx-1 text-gray-400">/</span>
            <span className="text-gray-500">Device Setting</span>
          </nav>

          {/* Toast */}
          {toast && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {toast.msg}
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
                <p className="text-sm text-gray-500">Total Devices</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{devices.filter((d) => d.isActive).length}</p>
                <p className="text-sm text-gray-500">Active Devices</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-400 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{devices.filter((d) => !d.isActive).length}</p>
                <p className="text-sm text-gray-500">Inactive Devices</p>
              </div>
            </div>
          </div>

          {/* Add Device Form */}
          {canAdd && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Add Biometric Device</h3>
              <p className="text-sm text-gray-500 mb-4">
                Use the serial number the device sends (e.g. in /iclock/cdata). Employee Code in HRMS must match the device user ID for punches to sync.
              </p>
              {addError && (
                <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{addError}</div>
              )}
              <form onSubmit={handleAddDevice} className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col w-64">
                  <label className="text-sm font-medium text-gray-600 mb-1">Serial Number *</label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="e.g. CQZ7224460246"
                    className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="flex flex-col w-64">
                  <label className="text-sm font-medium text-gray-600 mb-1">Device Name (optional)</label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. Main Entrance"
                    className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={adding || !serialNumber.trim()}
                  className="h-10 px-6 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {adding ? 'Adding...' : 'Add Device'}
                </button>
              </form>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold">Error loading devices</p>
              <p className="text-sm mt-1">{error}</p>
              <button onClick={fetchDevices} className="mt-2 text-sm underline hover:no-underline">Try again</button>
            </div>
          )}

          {/* Devices Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Registered Devices</h3>
              <button
                onClick={fetchDevices}
                disabled={loading}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">S.No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        <span className="inline-flex items-center gap-2">
                          <svg className="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Loading devices...
                        </span>
                      </td>
                    </tr>
                  ) : devices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No devices registered. Add a biometric device above.
                      </td>
                    </tr>
                  ) : (
                    devices.map((device, idx) => (
                      <tr key={device.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">{device.serialNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{device.name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${device.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {device.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
