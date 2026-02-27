import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import { useEmployeeStore } from '../store/employeeStore';
import {
  employeeSalaryService,
  salaryStructureService,
  EmployeeSalary,
  SalaryStructure,
  BankAccount,
} from '../services/payroll.service';
import employeeService from '../services/employee.service';
import { Employee } from '../services/employee.service';

const EmployeeSalariesPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const { employees, fetchEmployees } = useEmployeeStore();
  const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState<EmployeeSalary | null>(null);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const canManage = isHRManager || isOrgAdmin;
  const organizationId = user?.employee?.organizationId;

  const [formData, setFormData] = useState({
    employeeId: '',
    salaryStructureId: '',
    effectiveDate: '',
    basicSalary: '',
    grossSalary: '',
    netSalary: '',
    currency: 'INR',
    paymentFrequency: 'MONTHLY' as 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY',
    bankAccountId: '',
  });

  useEffect(() => {
    if (organizationId && canManage) {
      fetchSalaries();
      fetchEmployees({ organizationId, page: 1, limit: 100 });
      fetchSalaryStructures();
    } else {
      setLoading(false);
    }
  }, [organizationId, canManage]);

  const fetchSalaries = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await employeeSalaryService.getAllSalaries({
        organizationId,
        page: '1',
        limit: '100',
      });
      setSalaries(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch employee salaries');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalaryStructures = async () => {
    try {
      const response = await salaryStructureService.getAll({
        organizationId,
        page: '1',
        limit: '50',
      });
      setSalaryStructures(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch salary structures:', err);
    }
  };

  const handleEmployeeSelect = async (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    setSelectedEmployee(employee || null);
    setFormData((prev) => ({ ...prev, employeeId }));

    // Fetch bank accounts for the employee
    try {
      const accounts = await employeeSalaryService.getBankAccounts(employeeId);
      setBankAccounts(accounts);
      if (accounts.length > 0) {
        const primaryAccount = accounts.find((a) => a.isPrimary) || accounts[0];
        setFormData((prev) => ({ ...prev, bankAccountId: primaryAccount.id }));
      }
    } catch (err: any) {
      console.error('Failed to fetch bank accounts:', err);
    }

    // Check if employee already has a salary
    try {
      const currentSalary = await employeeSalaryService.getCurrentSalary(employeeId);
      if (currentSalary) {
        if (confirm('Employee already has an active salary. Do you want to create a new one?')) {
          // Pre-fill form with current salary values
          setFormData((prev) => ({
            ...prev,
            basicSalary: currentSalary.basicSalary.toString(),
            grossSalary: currentSalary.grossSalary.toString(),
            netSalary: currentSalary.netSalary.toString(),
            salaryStructureId: currentSalary.salaryStructureId || '',
            currency: currentSalary.currency,
            paymentFrequency: currentSalary.paymentFrequency,
          }));
        } else {
          setShowAssignModal(false);
          return;
        }
      }
    } catch (err: any) {
      // Employee doesn't have salary yet, continue
    }
  };

  const handleSalaryStructureSelect = (structureId: string) => {
    const structure = salaryStructures.find((s) => s.id === structureId);
    if (structure) {
      // Calculate salary from structure components
      let basic = 0;
      let gross = 0;
      const components: Record<string, number> = {};

      structure.components.forEach((comp) => {
        if (comp.type === 'EARNING') {
          if (comp.calculationType === 'FIXED') {
            const value = comp.value;
            components[comp.code || comp.name] = value;
            if (comp.code === 'BASIC' || comp.name.toLowerCase().includes('basic')) {
              basic = value;
            }
            gross += value;
          } else if (comp.calculationType === 'PERCENTAGE' && basic > 0) {
            const value = (basic * comp.value) / 100;
            components[comp.code || comp.name] = value;
            gross += value;
          }
        }
      });

      // Calculate deductions
      let deductions = 0;
      structure.components.forEach((comp) => {
        if (comp.type === 'DEDUCTION') {
          if (comp.calculationType === 'FIXED') {
            const value = comp.value;
            components[comp.code || comp.name] = value;
            deductions += value;
          } else if (comp.calculationType === 'PERCENTAGE') {
            let value = 0;
            if (comp.baseComponent === 'BASIC' && basic > 0) {
              value = (basic * comp.value) / 100;
            } else if (comp.baseComponent === 'GROSS' && gross > 0) {
              value = (gross * comp.value) / 100;
            }
            components[comp.code || comp.name] = value;
            deductions += value;
          }
        }
      });

      const net = gross - deductions;

      setFormData((prev) => ({
        ...prev,
        salaryStructureId: structureId,
        basicSalary: basic.toString(),
        grossSalary: gross.toString(),
        netSalary: net.toString(),
      }));
    }
  };

  const handleAssignSalary = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.basicSalary || !formData.grossSalary || !formData.netSalary) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      await employeeSalaryService.createSalary({
        employeeId: formData.employeeId,
        salaryStructureId: formData.salaryStructureId || undefined,
        effectiveDate: formData.effectiveDate || new Date().toISOString().split('T')[0],
        basicSalary: parseFloat(formData.basicSalary),
        grossSalary: parseFloat(formData.grossSalary),
        netSalary: parseFloat(formData.netSalary),
        currency: formData.currency,
        paymentFrequency: formData.paymentFrequency,
        bankAccountId: formData.bankAccountId || undefined,
        isActive: true,
      });

      alert('Salary assigned successfully!');
      setShowAssignModal(false);
      resetForm();
      fetchSalaries();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign salary');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      salaryStructureId: '',
      effectiveDate: new Date().toISOString().split('T')[0],
      basicSalary: '',
      grossSalary: '',
      netSalary: '',
      currency: 'INR',
      paymentFrequency: 'MONTHLY',
      bankAccountId: '',
    });
    setSelectedEmployee(null);
    setBankAccounts([]);
  };

  const handleViewSalary = async (salary: EmployeeSalary) => {
    try {
      // Fetch employee details
      const employee = await employeeService.getById(salary.employeeId);
      setSelectedEmployee(employee);
      setShowViewModal(salary);
    } catch (err: any) {
      alert('Failed to fetch employee details');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!canManage) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader
          title="Employee Salaries"
          subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
          onLogout={handleLogout}
        />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">You don't have permission to view employee salaries.</p>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader
          title="Employee Salaries"
          subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
          onLogout={handleLogout}
        />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Employee Salaries"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />
      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title and Actions */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Manage and view employee salary assignments</h2>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAssignModal(true);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Assign Salary
          </button>
        </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Salaries Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Salary Assignments</h2>
        </div>
        {salaries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No salary assignments found. Assign salaries to employees to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Basic Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaries.map((salary) => {
                  const employee = employees.find((e) => e.id === salary.employeeId);
                  return (
                    <tr key={salary.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee?.employeeCode || ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{Number(salary.basicSalary).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{Number(salary.grossSalary).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{Number(salary.netSalary).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(salary.effectiveDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            salary.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {salary.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewSalary(salary)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          👁️ View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Salary Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Assign Salary to Employee</h2>

              <form onSubmit={handleAssignSalary}>
                {/* Employee Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeCode} - {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Salary Structure Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Salary Structure (Optional)</label>
                  <select
                    value={formData.salaryStructureId}
                    onChange={(e) => handleSalaryStructureSelect(e.target.value)}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Structure (Optional)</option>
                    {salaryStructures.map((struct) => (
                      <option key={struct.id} value={struct.id}>
                        {struct.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Selecting a structure will auto-calculate salary components
                  </p>
                </div>

                {/* Effective Date */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Effective Date</label>
                  <input
                    type="date"
                    value={formData.effectiveDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Basic Salary */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Basic Salary <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.basicSalary}
                    onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Gross Salary */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gross Salary <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.grossSalary}
                    onChange={(e) => setFormData({ ...formData, grossSalary: e.target.value })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Net Salary */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Net Salary <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.netSalary}
                    onChange={(e) => setFormData({ ...formData, netSalary: e.target.value })}
                    className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Currency & Payment Frequency */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Frequency</label>
                    <select
                      value={formData.paymentFrequency}
                      onChange={(e) =>
                        setFormData({ ...formData, paymentFrequency: e.target.value as any })
                      }
                      className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="BI_WEEKLY">Bi-Weekly</option>
                      <option value="WEEKLY">Weekly</option>
                    </select>
                  </div>
                </div>

                {/* Bank Account */}
                {selectedEmployee && bankAccounts.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank Account</label>
                    <select
                      value={formData.bankAccountId}
                      onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                      className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">No Bank Account</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.bankName} - {account.accountNumber} {account.isPrimary ? '(Primary)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-black rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Assigning...' : 'Assign Salary'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Salary Modal */}
      {showViewModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Salary Details</h2>

              {/* Employee Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Employee Information</h3>
                <p className="text-sm text-gray-600">
                  <strong>Name:</strong> {selectedEmployee.firstName} {selectedEmployee.lastName}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Employee Code:</strong> {selectedEmployee.employeeCode}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Email:</strong> {selectedEmployee.email}
                </p>
                {selectedEmployee.department && (
                  <p className="text-sm text-gray-600">
                    <strong>Department:</strong> {selectedEmployee.department.name}
                  </p>
                )}
                {selectedEmployee.position && (
                  <p className="text-sm text-gray-600">
                    <strong>Position:</strong> {selectedEmployee.position.title}
                  </p>
                )}
              </div>

              {/* Salary Details */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Salary Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded">
                    <p className="text-xs text-gray-600">Basic Salary</p>
                    <p className="text-lg font-bold text-blue-900">
                      ₹{Number(showViewModal.basicSalary).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <p className="text-xs text-gray-600">Gross Salary</p>
                    <p className="text-lg font-bold text-green-900">
                      ₹{Number(showViewModal.grossSalary).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded">
                    <p className="text-xs text-gray-600">Net Salary</p>
                    <p className="text-lg font-bold text-purple-900">
                      ₹{Number(showViewModal.netSalary).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600">Currency</p>
                    <p className="text-lg font-bold text-gray-900">{showViewModal.currency}</p>
                  </div>
                </div>
              </div>

              {/* Components Breakdown */}
              {showViewModal.components && Object.keys(showViewModal.components).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Salary Components</h3>
                  <div className="space-y-2">
                    {Object.entries(showViewModal.components).map(([key, value]) => (
                      <div key={key} className="flex justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium text-gray-700">{key.toUpperCase()}</span>
                        <span className="text-sm text-gray-900">₹{Number(value).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Details */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Other Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Frequency:</span>
                    <span className="text-gray-900">{showViewModal.paymentFrequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Effective Date:</span>
                    <span className="text-gray-900">
                      {new Date(showViewModal.effectiveDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        showViewModal.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {showViewModal.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowViewModal(null);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

export default EmployeeSalariesPage;
