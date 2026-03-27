import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import { getModulePermissions } from '../config/configurator-module-mapping';

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  leaveType: {
    id: string;
    name: string;
    code: string;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  description: string;
  defaultDaysPerYear: number;
  isPaid: boolean;
}

const LeavePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  
  // Leave Type Management (for HR/ORG_ADMIN)
  const [showLeaveTypeForm, setShowLeaveTypeForm] = useState(false);
  const [leaveTypeFormData, setLeaveTypeFormData] = useState({
    name: '',
    code: '',
    description: '',
    defaultDaysPerYear: 0,
    isPaid: true,
  });
  const [submittingLeaveType, setSubmittingLeaveType] = useState(false);
  
  // Dynamic permission checks
  const leavePerms = getModulePermissions('/leave');
  const eventConfigPerms = getModulePermissions('/event-configuration');
  const canManageLeaveTypes = eventConfigPerms.can_edit;
  const canApproveLeave = leavePerms.can_view;
  
  const [approvingRequest, setApprovingRequest] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'my' | 'team'>('team'); // For managers to toggle view
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loadingMyRequests, setLoadingMyRequests] = useState(false);

  // Get organizationId from user
  const organizationId = user?.employee?.organizationId;

  useEffect(() => {
    if (organizationId) {
      fetchLeaveRequests();
      if (canApproveLeave) {
        fetchMyLeaveRequests(); // Always fetch manager's own requests
      }
      fetchLeaveTypes();
    } else {
      setError('Organization ID not found. Please ensure your employee profile is set up.');
    }
  }, [organizationId]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/leaves/requests', {
        params: {
          page: 1,
          limit: 50,
        },
      });
      const requests = response.data.data?.leaveRequests || response.data.data?.requests || [];
      setLeaveRequests(requests);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch leave requests');
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch manager's own leave requests
  const fetchMyLeaveRequests = async () => {
    if (!canApproveLeave || !user?.employee?.id) return;
    
    try {
      setLoadingMyRequests(true);
      const response = await api.get('/leaves/requests', {
        params: {
          page: 1,
          limit: 50,
          employeeId: user.employee.id, // Fetch own requests specifically
        },
      });
      const requests = response.data.data?.leaveRequests || response.data.data?.requests || [];
      setMyLeaveRequests(requests);
    } catch (err: any) {
      console.error('Error fetching my leave requests:', err);
      setMyLeaveRequests([]);
    } finally {
      setLoadingMyRequests(false);
    }
  };

  const fetchLeaveTypes = async () => {
    if (!organizationId) {
      console.error('Organization ID not available');
      return;
    }

    try {
      setLoadingTypes(true);
      const response = await api.get('/leaves/types', {
        params: {
          organizationId: organizationId,
          isActive: true,
        },
      });
      
      console.log('Leave types response:', response.data);
      
      // Backend returns { status: 'success', data: { leaveTypes: [...], pagination: {...} } }
      const leaveTypesData = response.data.data?.leaveTypes || [];
      
      if (Array.isArray(leaveTypesData)) {
        setLeaveTypes(leaveTypesData);
        if (leaveTypesData.length > 0) {
          setFormData(prev => ({
            ...prev,
            leaveTypeId: leaveTypesData[0].id,
          }));
        } else {
          setError('No leave types found. Please contact HR to create leave types.');
        }
      } else {
        console.error('Unexpected response structure:', response.data);
        setLeaveTypes([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch leave types:', err);
      setError(err.response?.data?.message || 'Failed to fetch leave types. Please try again.');
      setLeaveTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Frontend validation
    if (!formData.leaveTypeId) {
      setError('Please select a leave type');
      return;
    }
    if (!formData.startDate) {
      setError('Please select a start date');
      return;
    }
    if (!formData.endDate) {
      setError('Please select an end date');
      return;
    }
    if (!formData.reason || formData.reason.trim().length < 10) {
      setError('Reason must be at least 10 characters long');
      return;
    }
    
    // Validate date range
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    if (endDate < startDate) {
      setError('End date must be greater than or equal to start date');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Format dates as YYYY-MM-DD (backend expects this format)
      const payload = {
        leaveTypeId: formData.leaveTypeId,
        startDate: formData.startDate, // Already in YYYY-MM-DD format from date input
        endDate: formData.endDate,
        reason: formData.reason.trim(),
      };
      
      await api.post('/leaves/requests', payload);
      setShowApplyForm(false);
      setFormData({
        leaveTypeId: leaveTypes[0]?.id || '',
        startDate: '',
        endDate: '',
        reason: '',
      });
      
      // Refresh leave requests immediately to show the new request
      await Promise.all([
        fetchLeaveRequests(),
        fetchMyLeaveRequests(), // Also refresh manager's own requests if applicable
      ]);
      
      // Show success message
      setError(null);
      alert('Leave request submitted successfully!');
    } catch (err: any) {
      console.error('Leave request error:', err);
      
      // Handle validation errors from backend
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const errorMessages = err.response.data.errors
          .map((error: any) => `${error.field}: ${error.message}`)
          .join(', ');
        setError(errorMessages);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError(err.message || 'Failed to apply for leave. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationId) {
      setError('Organization ID not found');
      return;
    }
    
    if (!leaveTypeFormData.name || !leaveTypeFormData.code) {
      setError('Name and Code are required');
      return;
    }
    
    try {
      setSubmittingLeaveType(true);
      setError(null);
      
      const payload = {
        organizationId,
        name: leaveTypeFormData.name.trim(),
        code: leaveTypeFormData.code.trim().toUpperCase(),
        description: leaveTypeFormData.description.trim() || undefined,
        defaultDaysPerYear: leaveTypeFormData.defaultDaysPerYear || undefined,
        isPaid: leaveTypeFormData.isPaid,
        isActive: true,
      };
      
      await api.post('/leaves/types', payload);
      setShowLeaveTypeForm(false);
      setLeaveTypeFormData({
        name: '',
        code: '',
        description: '',
        defaultDaysPerYear: 0,
        isPaid: true,
      });
      
      // Refresh leave types
      await fetchLeaveTypes();
      setError(null);
      alert('Leave type created successfully!');
    } catch (err: any) {
      console.error('Create leave type error:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to create leave type. Please try again.');
      }
    } finally {
      setSubmittingLeaveType(false);
    }
  };

  const handleApproveLeave = async (requestId: string) => {
    if (!confirm('Are you sure you want to approve this leave request?')) {
      return;
    }
    
    try {
      setApprovingRequest(requestId);
      setError(null);
      await api.put(`/leaves/requests/${requestId}/approve`, {
        reviewComments: 'Approved by manager',
      });
      await Promise.all([
        fetchLeaveRequests(),
        fetchMyLeaveRequests(), // Also refresh manager's own requests
      ]);
      alert('Leave request approved successfully!');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to approve leave request';
      setError(errorMsg);
      console.error('Approve leave error:', err);
    } finally {
      setApprovingRequest(null);
    }
  };

  const handleRejectLeave = async (requestId: string) => {
    const comments = prompt('Please provide a reason for rejection:');
    if (!comments || comments.trim().length === 0) {
      alert('Rejection reason is required');
      return;
    }
    
    if (!confirm('Are you sure you want to reject this leave request?')) {
      return;
    }
    
    try {
      setRejectingRequest(requestId);
      setError(null);
      await api.put(`/leaves/requests/${requestId}/reject`, {
        reviewComments: comments.trim(),
      });
      await Promise.all([
        fetchLeaveRequests(),
        fetchMyLeaveRequests(), // Also refresh manager's own requests
      ]);
      alert('Leave request rejected.');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to reject leave request';
      setError(errorMsg);
      console.error('Reject leave error:', err);
    } finally {
      setRejectingRequest(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Leave Management"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Create Leave Type Form (for HR/ORG_ADMIN) */}
        {canManageLeaveTypes && showLeaveTypeForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Leave Type</h2>
            <form onSubmit={handleCreateLeaveType}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={leaveTypeFormData.name}
                    onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, name: e.target.value })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Annual Leave"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={leaveTypeFormData.code}
                    onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, code: e.target.value.toUpperCase() })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., AL"
                    required
                    maxLength={10}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={leaveTypeFormData.description}
                    onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, description: e.target.value })}
                    rows={2}
                    className="w-full min-h-[2.5rem] px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Description of the leave type..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Days Per Year
                  </label>
                  <input
                    type="number"
                    value={leaveTypeFormData.defaultDaysPerYear}
                    onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, defaultDaysPerYear: parseInt(e.target.value) || 0 })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 20"
                    min="0"
                    max="365"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPaid"
                    checked={leaveTypeFormData.isPaid}
                    onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, isPaid: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-black rounded"
                  />
                  <label htmlFor="isPaid" className="ml-2 block text-sm text-gray-700">
                    Paid Leave
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={submittingLeaveType}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingLeaveType ? 'Creating...' : 'Create Leave Type'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Apply Leave Form */}
        {showApplyForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Apply for Leave</h2>
            <form onSubmit={handleApplyLeave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Type
                  </label>
                  <select
                    value={formData.leaveTypeId}
                    onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={loadingTypes}
                  >
                    <option value="">
                      {loadingTypes ? 'Loading leave types...' : leaveTypes.length === 0 ? 'No leave types available' : 'Select Leave Type'}
                    </option>
                    {leaveTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.code})
                      </option>
                    ))}
                  </select>
                  {leaveTypes.length === 0 && !loadingTypes && (
                    <div className="mt-1">
                      <p className="text-sm text-yellow-600 mb-2">
                        No leave types found.
                      </p>
                      {canManageLeaveTypes ? (
                        <p className="text-sm text-blue-600">
                          Click "Create Leave Type" button above to create a new leave type.
                        </p>
                      ) : (
                        <p className="text-sm text-yellow-600">
                          Please contact HR to create leave types.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason <span className="text-red-500">*</span>
                    <span className="text-gray-500 text-xs ml-2">
                      (Minimum 10 characters required)
                    </span>
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    className="w-full min-h-[2.5rem] px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter reason for leave (minimum 10 characters)..."
                    required
                    minLength={10}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.reason.length}/10 characters
                    {formData.reason.length < 10 && (
                      <span className="text-red-500"> - {10 - formData.reason.length} more characters needed</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowApplyForm(false);
                    setFormData({
                      leaveTypeId: '',
                      startDate: '',
                      endDate: '',
                      reason: '',
                    });
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Leave Requests */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                {canApproveLeave
                  ? (viewMode === 'team'
                      ? 'Team Leave Requests'
                      : 'My Leave Requests')
                  : 'My Leave Requests'}
              </h2>
              <div className="flex items-center space-x-4">
                {canManageLeaveTypes && (
                  <button
                    onClick={() => setShowLeaveTypeForm(!showLeaveTypeForm)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                  >
                    {showLeaveTypeForm ? 'Hide Leave Type Form' : '+ Create Leave Type'}
                  </button>
                )}
                {!showApplyForm && (
                  <button
                    onClick={() => setShowApplyForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    + Apply Leave
                  </button>
                )}
                {canApproveLeave && (
                  <>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('team')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          viewMode === 'team'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        👥 Team Requests
                      </button>
                      <button
                        onClick={() => setViewMode('my')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          viewMode === 'my'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        👤 My Requests
                      </button>
                    </div>
                    {viewMode === 'team' && (
                      <span className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
                        📊 Viewing your team members' requests
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          {loading || (viewMode === 'my' && loadingMyRequests) ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (viewMode === 'my' ? myLeaveRequests : leaveRequests).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {viewMode === 'my' 
                ? 'No leave requests found for you' 
                : 'No leave requests found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leave Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    {canApproveLeave && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(viewMode === 'my' ? myLeaveRequests : leaveRequests).map((request) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.employee.firstName} {request.employee.lastName}
                        <br />
                        <span className="text-gray-500 text-xs">{request.employee.employeeCode}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.leaveType.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(request.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(request.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.totalDays} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {request.reason}
                      </td>
                      {canApproveLeave && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {request.status === 'PENDING' ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleApproveLeave(request.id)}
                                disabled={approvingRequest === request.id || rejectingRequest === request.id}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Approve"
                              >
                                {approvingRequest === request.id ? 'Approving...' : '✅ Approve'}
                              </button>
                              <button
                                onClick={() => handleRejectLeave(request.id)}
                                disabled={approvingRequest === request.id || rejectingRequest === request.id}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Reject"
                              >
                                {rejectingRequest === request.id ? 'Rejecting...' : '❌ Reject'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">
                              {request.status === 'APPROVED' ? 'Approved' : request.status === 'REJECTED' ? 'Rejected' : 'N/A'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LeavePage;
