/**
 * Leave Approval Page – Event Approval style layout.
 * Dynamic filters, table with columns, pagination, approve/reject with remarks.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import workflowMappingService from '../services/workflowMapping.service';
import type { WorkflowMapping } from '../services/workflowMapping.service';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  appliedOn: string;
  leaveType: LeaveType;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    email?: string;
  };
  workflowMapping?: {
    id: string;
    displayName: string;
  } | null;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const COLUMN_KEYS = ['associate', 'leaveType', 'date', 'hours', 'days', 'appliedOn', 'reason', 'status', 'entryBy', 'approval', 'remarks', 'action'] as const;

const COLUMN_LABELS: Record<(typeof COLUMN_KEYS)[number], string> = {
  associate: 'Associate',
  leaveType: 'Leave Type',
  date: 'Date',
  hours: 'Hours',
  days: 'Days',
  appliedOn: 'Applied On',
  reason: 'Reason',
  status: 'Status',
  entryBy: 'Entry By',
  approval: 'Approval',
  remarks: 'Remarks',
  action: 'Action',
};

export default function LeaveApprovalPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const organizationName = user?.employee?.organization?.name;
  const isManager = user?.role === 'MANAGER';
  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canApprove = isManager || isHRManager || isOrgAdmin || isSuperAdmin;

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [workflowTypeId, setWorkflowTypeId] = useState<string>('');
  const [leaveTypeId, setLeaveTypeId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchReason, setSearchReason] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [workflows, setWorkflows] = useState<WorkflowMapping[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(COLUMN_KEYS as unknown as string[]));
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [rejectModal, setRejectModal] = useState<{ id: string; comments: string } | null>(null);

  useEffect(() => {
    if (!canApprove) {
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [canApprove, navigate]);

  useEffect(() => {
    if (!organizationId || !canApprove) return;
    fetchRequests();
  }, [organizationId, canApprove, page, pageSize, workflowTypeId, leaveTypeId, dateFrom, dateTo, searchReason, statusFilter]);

  useEffect(() => {
    if (!organizationId || !canApprove) return;
    fetchWorkflows();
    fetchLeaveTypes();
  }, [organizationId, canApprove]);

  const fetchWorkflows = async () => {
    try {
      const result = await workflowMappingService.getAll({ organizationId: organizationId!, limit: 500 });
      setWorkflows(result.items || []);
    } catch {
      setWorkflows([]);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const { data } = await api.get<{ data: { leaveTypes?: LeaveType[] } }>('/leaves/types', {
        params: { organizationId, limit: 500 },
      });
      const list = data?.data?.leaveTypes || data?.data || [];
      setLeaveTypes(Array.isArray(list) ? list : []);
    } catch {
      setLeaveTypes([]);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = {
        page,
        limit: pageSize,
        organizationId: organizationId!,
        sortBy: 'appliedOn',
        sortOrder: 'desc',
      };
      if (statusFilter) params.status = statusFilter;
      if (workflowTypeId) params.workflowMappingId = workflowTypeId;
      if (leaveTypeId) params.leaveTypeId = leaveTypeId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (searchReason.trim()) params.search = searchReason.trim();

      const response = await api.get('/leaves/requests', { params });
      const data = response.data?.data;
      const list = data?.leaveRequests || data?.requests || [];
      const pag = data?.pagination || { page: 1, limit: pageSize, total: 0, totalPages: 0 };
      setRequests(Array.isArray(list) ? list : []);
      setPagination({
        page: pag.page ?? page,
        limit: pag.limit ?? pageSize,
        total: pag.total ?? 0,
        totalPages: pag.totalPages ?? 0,
      });
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to fetch leave requests';
      setError(String(msg || 'Failed to fetch leave requests'));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const remarks = remarksMap[id] || 'Approved';
    try {
      setApprovingId(id);
      setError(null);
      await api.put(`/leaves/requests/${id}/approve`, { reviewComments: remarks });
      setSuccessMessage('Leave request approved successfully');
      setTimeout(() => setSuccessMessage(null), 4000);
      setRemarksMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await fetchRequests();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to approve';
      setError(String(msg));
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal || !rejectModal.comments.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    try {
      setRejectingId(rejectModal.id);
      setError(null);
      await api.put(`/leaves/requests/${rejectModal.id}/reject`, {
        reviewComments: rejectModal.comments.trim(),
      });
      setSuccessMessage('Leave request rejected');
      setTimeout(() => setSuccessMessage(null), 4000);
      setRejectModal(null);
      await fetchRequests();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to reject';
      setError(String(msg));
    } finally {
      setRejectingId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getStatusBadge = (status: string) => {
    const cls =
      status === 'APPROVED'
        ? 'bg-green-100 text-green-800'
        : status === 'REJECTED'
          ? 'bg-red-100 text-red-800'
          : status === 'PENDING'
            ? 'bg-amber-100 text-amber-800'
            : status === 'CANCELLED'
              ? 'bg-gray-100 text-gray-600'
              : 'bg-gray-100 text-gray-800';
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
  };

  const hoursFromDays = (days: number) => {
    if (days <= 0) return '—';
    const totalHours = days * 8;
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const totalPages = Math.max(1, pagination.totalPages);
  const startEntry = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-100">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!canApprove) {
    return null;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Leave Approval"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50 print:py-0">
        <div className="w-full max-w-[1800px] mx-auto">
          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Workflow Type</label>
                <select
                  value={workflowTypeId}
                  onChange={(e) => setWorkflowTypeId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>{w.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Leave Type</label>
                <select
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>{lt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Search by Reason</label>
                <input
                  type="text"
                  value={searchReason}
                  onChange={(e) => setSearchReason(e.target.value)}
                  placeholder="Search by reason"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Actions + Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">Leave Requests</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  title="Print"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2h-2m-4-1h.01M17 16h-2a2 2 0 00-2 2m0 0h.01" />
                  </svg>
                  Print
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColumnPicker(!showColumnPicker)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                    title="Show / hide columns"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Columns
                  </button>
                  {showColumnPicker && (
                    <div className="absolute right-0 mt-1 w-48 py-2 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                      {COLUMN_KEYS.map((key) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(key)}
                            onChange={() => toggleColumn(key)}
                          />
                          {COLUMN_LABELS[key]}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">Loading...</div>
            ) : requests.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No leave requests found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {visibleColumns.has('associate') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Associate
                        </th>
                      )}
                      {visibleColumns.has('leaveType') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Leave Type
                        </th>
                      )}
                      {visibleColumns.has('date') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      )}
                      {visibleColumns.has('hours') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Hours
                        </th>
                      )}
                      {visibleColumns.has('days') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Days
                        </th>
                      )}
                      {visibleColumns.has('appliedOn') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Applied On
                        </th>
                      )}
                      {visibleColumns.has('reason') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                      )}
                      {visibleColumns.has('status') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      )}
                      {visibleColumns.has('entryBy') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entry By
                        </th>
                      )}
                      {visibleColumns.has('approval') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Approval
                        </th>
                      )}
                      {visibleColumns.has('remarks') && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Remarks
                        </th>
                      )}
                      {visibleColumns.has('action') && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50">
                        {visibleColumns.has('associate') && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                {(req.employee.firstName?.[0] || '') + (req.employee.lastName?.[0] || '')}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {req.employee.firstName} {req.employee.lastName}
                                </div>
                                <div className="text-xs text-gray-500">[{req.employee.employeeCode}]</div>
                              </div>
                            </div>
                          </td>
                        )}
                        {visibleColumns.has('leaveType') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {req.leaveType.name}
                            {req.leaveType.code && <span className="text-gray-500 ml-1">({req.leaveType.code})</span>}
                          </td>
                        )}
                        {visibleColumns.has('date') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {formatDate(req.startDate)}
                            {req.startDate !== req.endDate && ` – ${formatDate(req.endDate)}`}
                          </td>
                        )}
                        {visibleColumns.has('hours') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {hoursFromDays(Number(req.totalDays))}
                          </td>
                        )}
                        {visibleColumns.has('days') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {Number(req.totalDays).toFixed(2)}
                          </td>
                        )}
                        {visibleColumns.has('appliedOn') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {req.appliedOn ? formatDateTime(req.appliedOn) : '—'}
                          </td>
                        )}
                        {visibleColumns.has('reason') && (
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={req.reason}>
                            {req.reason}
                          </td>
                        )}
                        {visibleColumns.has('status') && (
                          <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(req.status)}</td>
                        )}
                        {visibleColumns.has('entryBy') && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <div className="text-sm text-gray-900">
                                {req.employee.firstName} {req.employee.lastName} [{req.employee.employeeCode}]
                              </div>
                              <span className="inline-flex px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                Employee
                              </span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.has('approval') && req.status === 'PENDING' && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleApprove(req.id)}
                                disabled={!!approvingId}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
                              >
                                {approvingId === req.id ? '...' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectModal({ id: req.id, comments: '' })}
                                disabled={!!rejectingId}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                        {visibleColumns.has('approval') && req.status !== 'PENDING' && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">—</td>
                        )}
                        {visibleColumns.has('remarks') && req.status === 'PENDING' && (
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={remarksMap[req.id] ?? ''}
                              onChange={(e) => setRemarksMap((prev) => ({ ...prev, [req.id]: e.target.value }))}
                              placeholder="Remarks"
                              className="w-32 rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                        )}
                        {visibleColumns.has('remarks') && req.status !== 'PENDING' && (
                          <td className="px-4 py-3 text-sm text-gray-400">—</td>
                        )}
                        {visibleColumns.has('action') && req.status === 'PENDING' && (
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => handleApprove(req.id)}
                              disabled={!!approvingId}
                              className="inline-flex px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 mr-1"
                            >
                              {approvingId === req.id ? '...' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectModal({ id: req.id, comments: '' })}
                              disabled={!!rejectingId}
                              className="inline-flex px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </td>
                        )}
                        {visibleColumns.has('action') && req.status !== 'PENDING' && (
                          <td className="px-4 py-3 text-right text-sm text-gray-400">—</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600">entries</span>
                </div>
                <span className="text-sm text-gray-600">
                  Showing {startEntry} to {endEntry} of {pagination.total} entries
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : Math.max(1, page - 2 + i);
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        p === page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Reject Leave Request</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide a reason for rejection (required):</p>
            <textarea
              value={rejectModal.comments}
              onChange={(e) => setRejectModal({ ...rejectModal, comments: e.target.value })}
              placeholder="Reason for rejection..."
              rows={4}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={!rejectModal.comments.trim() || !!rejectingId}
                className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectingId ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
