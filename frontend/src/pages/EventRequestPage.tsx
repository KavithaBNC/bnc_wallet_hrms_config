import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import BackNavigation from '../components/common/BackNavigation';

interface LeaveRequestItem {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
  leaveType: {
    id: string;
    name: string;
    code?: string | null;
  };
}

/** Parse "[Permission HH:MM-HH:MM]" from start of reason for permission events. */
function parsePermissionTiming(reason: string | undefined, leaveTypeName: string | undefined): string | null {
  if (!reason?.trim()) return null;
  const isPermission = (leaveTypeName || '').toLowerCase().includes('permission');
  if (!isPermission) return null;
  const match = reason.match(/^\[Permission\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\]/i);
  if (!match) return null;
  return `${match[1]} - ${match[2]}`;
}

/** Format totalDays for permission as "0.22 (2h)" so users see both days and hours. 9h = 1 day (540 min). */
function formatDaysDisplay(r: LeaveRequestItem): string {
  const isPermission = (r.leaveType?.name || '').toLowerCase().includes('permission');
  if (!isPermission || r.totalDays == null) return String(r.totalDays);
  const minutes = Math.round(Number(r.totalDays) * 540);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hoursLabel = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${Number(r.totalDays)} (${hoursLabel})`;
}

export default function EventRequestPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const employeeId = user?.employee?.id;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canCancel = useMemo(() => {
    const role = String(user?.role || '').toUpperCase();
    return role === 'EMPLOYEE' || role === 'MANAGER' || role === 'HR_MANAGER';
  }, [user?.role]);

  const fetchMyRequests = useCallback(async () => {
    if (!employeeId || !organizationId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/leaves/requests', {
        params: {
          employeeId,
          organizationId,
          page: 1,
          limit: 200,
          sortBy: 'appliedOn',
          sortOrder: 'desc',
        },
      });
      const rows = response.data?.data?.leaveRequests || [];
      setRequests(rows);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load event requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, organizationId]);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  const handleCancelRequest = async (id: string) => {
    if (!canCancel) return;
    const reason = window.prompt('Enter cancellation reason (minimum 10 characters):', 'Need to cancel this request');
    if (!reason) return;
    if (reason.trim().length < 10) {
      window.alert('Cancellation reason must be at least 10 characters.');
      return;
    }
    if (!window.confirm('Cancel this pending event request?')) return;

    try {
      setCancellingId(id);
      setError(null);
      await api.put(`/leaves/requests/${id}/cancel`, {
        cancellationReason: reason.trim(),
      });
      await fetchMyRequests();
      window.alert('Request cancelled. Balance/used will be recalculated.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  const statusTone = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <BackNavigation to="/attendance" label="Attendance" />
      <AppHeader
        title="Event Request"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">My Applied Events</h2>
          <button
            onClick={() => navigate('/attendance/apply-event')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Apply Event
          </button>
        </div>

        <div className="rounded-lg bg-white shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No event requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Event</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">From</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">To</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Timing</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Days</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {requests.map((r) => {
                    const permissionTiming = parsePermissionTiming(r.reason, r.leaveType?.name);
                    return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{r.leaveType?.name || 'Event'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{new Date(r.startDate).toLocaleDateString()}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{new Date(r.endDate).toLocaleDateString()}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {permissionTiming ? <span className="font-medium text-gray-800">{permissionTiming}</span> : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900" title={permissionTiming ? 'Days = (duration in hours) ÷ 9 (9-hour work day). 0.22 ≈ 2h.' : undefined}>
                        {formatDaysDisplay(r)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{r.reason}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {r.status === 'PENDING' && canCancel ? (
                          <button
                            onClick={() => handleCancelRequest(r.id)}
                            disabled={cancellingId === r.id}
                            className="font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {cancellingId === r.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

