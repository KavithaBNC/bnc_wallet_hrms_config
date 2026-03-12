import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getModulePermissions } from '../config/configurator-module-mapping';
import AppHeader from '../components/layout/AppHeader';
import {
  salaryStructureService,
  SalaryStructure,
  SalaryComponent,
  PredefinedComponent,
} from '../services/payroll.service';

const SalaryStructurePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [predefinedComponents, setPredefinedComponents] = useState<{
    earnings: PredefinedComponent[];
    deductions: PredefinedComponent[];
  } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    components: [] as SalaryComponent[],
  });
  const [submitting, setSubmitting] = useState(false);

  // Module permissions from /api/v1/user-role-modules/project API response
  const structurePerms = getModulePermissions('/salary-structures');
  const canManage = structurePerms.can_view;
  const organizationId = user?.employee?.organizationId;

  useEffect(() => {
    if (organizationId && canManage) {
      fetchSalaryStructures();
      fetchPredefinedComponents();
    } else {
      setLoading(false);
    }
  }, [organizationId, canManage]);

  const fetchSalaryStructures = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await salaryStructureService.getAll({
        organizationId,
        page: '1',
        limit: '50',
      });
      setSalaryStructures(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch salary structures');
    } finally {
      setLoading(false);
    }
  };

  const fetchPredefinedComponents = async () => {
    try {
      const response = await salaryStructureService.getPredefinedComponents();
      setPredefinedComponents(response);
    } catch (err: any) {
      console.error('Failed to fetch predefined components:', err);
    }
  };

  const handleAddComponent = (predefined: PredefinedComponent, type: 'EARNING' | 'DEDUCTION') => {
    const newComponent: SalaryComponent = {
      name: predefined.name,
      code: predefined.code,
      type,
      calculationType: predefined.defaultCalculationType,
      value: predefined.defaultPercentage || predefined.defaultValue || 0,
      isTaxable: predefined.isTaxable,
      isStatutory: predefined.isStatutory,
      formula: predefined.defaultFormula,
      description: predefined.description,
      baseComponent: predefined.defaultCalculationType === 'PERCENTAGE' ? 'BASIC' : undefined,
    };

    // Check if component already exists
    if (formData.components.some((c) => c.code === predefined.code)) {
      alert('This component is already added');
      return;
    }

    setFormData({
      ...formData,
      components: [...formData.components, newComponent],
    });
  };

  const handleRemoveComponent = (index: number) => {
    setFormData({
      ...formData,
      components: formData.components.filter((_, i) => i !== index),
    });
  };

  const handleUpdateComponent = (index: number, field: keyof SalaryComponent, value: any) => {
    const updated = [...formData.components];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, components: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      alert('Organization ID not found');
      return;
    }

    if (formData.components.length === 0) {
      alert('Please add at least one component');
      return;
    }

    // Validate that BASIC earning exists
    const hasBasic = formData.components.some(
      (c) => c.type === 'EARNING' && (c.code === 'BASIC' || c.name.toLowerCase().includes('basic'))
    );
    if (!hasBasic) {
      alert('At least one BASIC earning component is required');
      return;
    }

    try {
      setSubmitting(true);
      await salaryStructureService.create({
        organizationId,
        name: formData.name,
        description: formData.description,
        components: formData.components,
        isActive: true,
      });

      alert('Salary structure created successfully!');
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        components: [],
      });
      fetchSalaryStructures();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create salary structure');
    } finally {
      setSubmitting(false);
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
          title="Salary Structure Management"
          subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
          onLogout={handleLogout}
        />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">You don't have permission to manage salary structures.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Salary Structure Management"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />
      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title and Actions */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Define salary components and structures for your organization</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Create Salary Structure
          </button>
        </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Salary Structures</h2>
          </div>
          {salaryStructures.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No salary structures found. Create a new structure to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Components</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salaryStructures.map((structure) => (
                    <tr key={structure.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {structure.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {structure.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex flex-wrap gap-2">
                          {(structure.components as SalaryComponent[]).map((comp, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded text-xs ${
                                comp.type === 'EARNING'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {comp.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            structure.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {structure.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            // TODO: Implement edit/view functionality
                            alert('Edit functionality coming soon!');
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Are you sure you want to delete this salary structure?')) {
                              try {
                                await salaryStructureService.delete(structure.id);
                                alert('Salary structure deleted successfully!');
                                fetchSalaryStructures();
                              } catch (err: any) {
                                alert(err.response?.data?.message || 'Failed to delete salary structure');
                              }
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Salary Structure Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create Salary Structure</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', description: '', components: [] });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Structure Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Standard Salary Structure"
                    className="w-full h-10 px-3 py-2 bg-white text-black border border-black rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    className="w-full h-10 px-3 py-2 bg-white text-black border border-black rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Predefined Components */}
              {predefinedComponents && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Components</h3>
                  
                  {/* Earnings */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Earnings</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {predefinedComponents.earnings.map((earning) => (
                        <button
                          key={earning.code}
                          type="button"
                          onClick={() => handleAddComponent(earning, 'EARNING')}
                          disabled={formData.components.some((c) => c.code === earning.code)}
                          className="px-3 py-2 text-sm border border-black rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                        >
                          <div className="font-medium">{earning.name}</div>
                          <div className="text-xs text-gray-500">{earning.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Deductions */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Deductions</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {predefinedComponents.deductions.map((deduction) => (
                        <button
                          key={deduction.code}
                          type="button"
                          onClick={() => handleAddComponent(deduction, 'DEDUCTION')}
                          disabled={formData.components.some((c) => c.code === deduction.code)}
                          className="px-3 py-2 text-sm border border-black rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                        >
                          <div className="font-medium">{deduction.name}</div>
                          <div className="text-xs text-gray-500">{deduction.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Components */}
              {formData.components.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Components</h3>
                  <div className="space-y-4">
                    {formData.components.map((component, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">{component.name}</h4>
                            <p className="text-xs text-gray-500">{component.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Calculation Type
                            </label>
                            <select
                              value={component.calculationType}
                              onChange={(e) =>
                                handleUpdateComponent(
                                  index,
                                  'calculationType',
                                  e.target.value as 'FIXED' | 'PERCENTAGE' | 'FORMULA'
                                )
                              }
                              className="w-full h-10 px-2 py-1 text-sm bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="FIXED">Fixed</option>
                              <option value="PERCENTAGE">Percentage</option>
                              <option value="FORMULA">Formula</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {component.calculationType === 'PERCENTAGE' ? 'Percentage (%)' : 'Value'}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={component.calculationType === 'PERCENTAGE' ? 100 : undefined}
                              value={component.value}
                              onChange={(e) =>
                                handleUpdateComponent(index, 'value', parseFloat(e.target.value) || 0)
                              }
                              className="w-full h-10 px-2 py-1 text-sm bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          {component.calculationType === 'PERCENTAGE' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Base Component
                              </label>
                              <select
                                value={component.baseComponent || 'BASIC'}
                                onChange={(e) => handleUpdateComponent(index, 'baseComponent', e.target.value)}
                                className="w-full h-10 px-2 py-1 text-sm bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="BASIC">Basic Salary</option>
                                {formData.components
                                  .filter((c) => c.type === 'EARNING' && c.code !== 'BASIC')
                                  .map((c) => (
                                    <option key={c.code} value={c.code || c.name}>
                                      {c.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}

                          {component.calculationType === 'FORMULA' && (
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Formula</label>
                              <input
                                type="text"
                                value={component.formula || ''}
                                onChange={(e) => handleUpdateComponent(index, 'formula', e.target.value)}
                                placeholder="e.g., overtimeHours * hourlyRate * 1.5"
                                className="w-full h-10 px-2 py-1 text-sm bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex gap-4">
                          <label className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={component.isTaxable}
                              onChange={(e) => handleUpdateComponent(index, 'isTaxable', e.target.checked)}
                              className="mr-1"
                            />
                            Taxable
                          </label>
                          <label className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={component.isStatutory}
                              onChange={(e) => handleUpdateComponent(index, 'isStatutory', e.target.checked)}
                              className="mr-1"
                            />
                            Statutory
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', description: '', components: [] });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

export default SalaryStructurePage;
