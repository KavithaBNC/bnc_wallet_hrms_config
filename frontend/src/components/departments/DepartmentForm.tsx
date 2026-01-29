import React, { useState } from 'react';
import { useDepartmentStore } from '../../store/departmentStore';
import { Department } from '../../services/department.service';

interface DepartmentFormProps {
  department?: Department | null;
  organizationId: string;
  onSuccess?: (createdDepartment?: Department) => void;
  onCancel?: () => void;
}

const DepartmentForm: React.FC<DepartmentFormProps> = ({
  department,
  organizationId,
  onSuccess,
  onCancel,
}) => {
  const { createDepartment, updateDepartment, loading } = useDepartmentStore();

  const [formData, setFormData] = useState({
    name: department?.name || '',
    subDepartment: (department as any)?.subDepartment || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Department name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling

    if (!validate()) {
      return;
    }

    try {
      const submitData = {
        organizationId,
        name: formData.name.trim(),
        isActive: true,
      };

      let createdDepartment: Department | undefined;
      if (department) {
        createdDepartment = await updateDepartment(department.id, submitData);
      } else {
        createdDepartment = await createDepartment(submitData);
      }

      if (createdDepartment && onSuccess) {
        onSuccess(createdDepartment);
      }
    } catch (error: any) {
      console.error('Error creating/updating department:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save department';
      setErrors({ submit: errorMessage });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Department Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Department Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
              errors.name
                ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            }`}
            placeholder="e.g., Engineering, Sales, HR"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* Sub-Department */}
        <div>
          <label htmlFor="subDepartment" className="block text-sm font-medium text-gray-700">
            Sub-Department
          </label>
          <input
            type="text"
            id="subDepartment"
            name="subDepartment"
            value={formData.subDepartment}
            onChange={handleChange}
            className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Sub-Department"
          />
        </div>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{errors.submit}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-black rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : department ? 'Update Department' : 'Create Department'}
        </button>
      </div>
    </form>
  );
};

export default DepartmentForm;
