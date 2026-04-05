import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import employeeService, { Employee } from '../services/employee.service';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

export default function AssociateShiftChangePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;

  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedAssociateIds, setSelectedAssociateIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  // const [showToAll, setShowToAll] = useState(false); // Commented out for future use
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    employeeService
      .getAll({ organizationId, page: 1, limit: 1000, employeeStatus: 'ACTIVE' })
      .then((res) => {
        setEmployees(res.employees || []);
      })
      .catch(() => {});
  }, [organizationId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!fromDate || !toDate) {
      setError('From Date and To Date are required.');
      return;
    }
    
    if (selectedAssociateIds.length === 0) {
      setError('Please select at least one associate.');
      return;
    }
    
    setSubmitting(true);
    setError(null);

    try {
      // Navigate to Associate Shift Grid page
      // Use the fromDate to determine the month to display
      const selectedDate = new Date(fromDate);
      const monthParam = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
      
      const params = new URLSearchParams({
        month: monthParam,
      });
      
      // Add multiple associate IDs as comma-separated values
      params.append('associateIds', selectedAssociateIds.join(','));
      
      // Add date range for reference (optional, can be used for filtering)
      params.append('fromDate', fromDate);
      params.append('toDate', toDate);
      
      navigate(`/time-attendance/associate-shift-grid?${params.toString()}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit associate shift change');
      setSubmitting(false);
    }
  };


  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
      <AppHeader
        title="Time attendance"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
          <Link to="/dashboard" className="hover:text-gray-900">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/time-attendance" className="hover:text-gray-900">Time attendance</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">Associate Shift Change</span>
        </nav>

        <div className="flex flex-1 min-h-0">
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-6">Associate Shift Change</h1>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex flex-col flex-1 min-h-0 space-y-6">
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1.5">
                    From Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-10 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1.5">
                    To Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-10 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Associate Selection - Tag/Chip Input Style */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1.5">
                  Associate:
                </label>
                
                {/* Tag Input Field */}
                <div className="relative">
                  <div
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="min-h-[42px] w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 cursor-text flex flex-wrap items-center gap-2"
                  >
                    {selectedAssociateIds.length === 0 ? (
                      <span className="text-gray-400 py-1">Select associates...</span>
                    ) : (
                      selectedAssociateIds.map((associateId) => {
                        const emp = employees.find((e) => e.id === associateId);
                        if (!emp) return null;
                        return (
                          <span
                            key={associateId}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium"
                          >
                            <span className="text-white">×</span>
                            <span>{fullName(emp).toUpperCase()} [{emp.employeeCode}]</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAssociateIds((prev) => prev.filter((id) => id !== associateId));
                              }}
                              className="ml-1 text-white hover:text-gray-200 focus:outline-none font-bold text-sm leading-none"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })
                    )}
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder={selectedAssociateIds.length === 0 ? "Type to search associates..." : ""}
                      className="flex-1 min-w-[120px] outline-none bg-transparent text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  {/* Dropdown */}
                  {showDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowDropdown(false)}
                      />
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto">
                        {employees.length === 0 ? (
                          <div className="px-4 py-8 text-center text-gray-500 text-sm">
                            No associates found
                          </div>
                        ) : (
                          <div className="p-2">
                            {employees
                              .filter((emp) => {
                                if (!searchTerm) return true;
                                const searchLower = searchTerm.toLowerCase();
                                const name = fullName(emp).toLowerCase();
                                const code = emp.employeeCode?.toLowerCase() || '';
                                return name.includes(searchLower) || code.includes(searchLower);
                              })
                              .filter((emp) => !selectedAssociateIds.includes(emp.id))
                              .map((emp) => (
                                <div
                                  key={emp.id}
                                  onClick={() => {
                                    setSelectedAssociateIds((prev) => [...prev, emp.id]);
                                    setSearchTerm('');
                                  }}
                                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer rounded text-sm text-gray-900"
                                >
                                  <span className="font-medium">{fullName(emp)}</span>
                                  <span className="text-gray-600 ml-2">({emp.employeeCode})</span>
                                </div>
                              ))}
                            {employees
                              .filter((emp) => {
                                if (!searchTerm) return true;
                                const searchLower = searchTerm.toLowerCase();
                                const name = fullName(emp).toLowerCase();
                                const code = emp.employeeCode?.toLowerCase() || '';
                                return name.includes(searchLower) || code.includes(searchLower);
                              })
                              .filter((emp) => !selectedAssociateIds.includes(emp.id)).length === 0 && (
                              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                No more associates to select
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Filters Section - Commented out for future use */}
              {/* <div className="border-t border-gray-200 pt-4">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Filters</h2>
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Show to all:</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="showToAll"
                        checked={showToAll === true}
                        onChange={() => setShowToAll(true)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">YES</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="showToAll"
                        checked={showToAll === false}
                        onChange={() => setShowToAll(false)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">NO</span>
                    </label>
                  </div>
                </div>
              </div> */}

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-auto">
                <Link
                  to="/time-attendance"
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting || selectedAssociateIds.length === 0}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
