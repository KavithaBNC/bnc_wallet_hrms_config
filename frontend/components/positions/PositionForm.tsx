import React, { useEffect, useState } from 'react';
import { usePositionStore } from '../../store/positionStore';
import { useDepartmentStore } from '../../store/departmentStore';
import { Position, PositionLevel, EmploymentType } from '../../services/position.service';

interface PositionFormProps {
  position?: Position | null;
  organizationId: string;
  onSuccess?: (createdPosition?: Position) => void;
  onCancel?: () => void;
}

const POSITION_LEVELS: { value: PositionLevel; label: string }[] = [
  { value: 'C_LEVEL', label: 'C-Level' },
  { value: 'VP', label: 'Vice President' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'SENIOR', label: 'Senior' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'ENTRY', label: 'Entry Level' },
];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
];

const PositionForm: React.FC<PositionFormProps> = ({
  position,
  organizationId,
  onSuccess,
  onCancel,
}) => {
  const { createPosition, updatePosition, loading } = usePositionStore();
  const { departments, fetchDepartments } = useDepartmentStore();

  const [formData, setFormData] = useState({
    title: position?.title || '',
    code: position?.code || '',
    description: position?.description || '',
    departmentId: position?.departmentId || '',
    level: position?.level || '',
    employmentType: position?.employmentType || '',
    salaryRangeMin: position?.salaryRangeMin?.toString() || '',
    salaryRangeMax: position?.salaryRangeMax?.toString() || '',
    requirements: position?.requirements?.join('\n') || '',
    responsibilities: position?.responsibilities?.join('\n') || '',
    isActive: position?.isActive !== undefined ? position.isActive : true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDepartments(organizationId);
  }, [organizationId]);

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

    if (!formData.title.trim()) {
      newErrors.title = 'Position title is required';
    }

    if (!formData.departmentId) {
      newErrors.departmentId = 'Department is required';
    }

    if (!formData.level) {
      newErrors.level = 'Position level is required';
    }

    if (!formData.employmentType) {
      newErrors.employmentType = 'Employment type is required';
    }

    // Validate salary range
    const minSalary = parseFloat(formData.salaryRangeMin);
    const maxSalary = parseFloat(formData.salaryRangeMax);

    if (formData.salaryRangeMin && isNaN(minSalary)) {
      newErrors.salaryRangeMin = 'Invalid salary amount';
    }

    if (formData.salaryRangeMax && isNaN(maxSalary)) {
      newErrors.salaryRangeMax = 'Invalid salary amount';
    }

    if (formData.salaryRangeMin && formData.salaryRangeMax) {
      if (minSalary >= maxSalary) {
        newErrors.salaryRangeMax = 'Maximum salary must be greater than minimum';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling

    if (!validate()) {
      console.log('PositionForm validation failed');
      return;
    }

    try {
      const submitData = {
        organizationId,
        title: formData.title.trim(),
        code: formData.code.trim() || undefined,
        description: formData.description.trim() || undefined,
        departmentId: formData.departmentId,
        level: formData.level as PositionLevel,
        employmentType: formData.employmentType as EmploymentType,
        salaryRangeMin: formData.salaryRangeMin ? parseFloat(formData.salaryRangeMin) : undefined,
        salaryRangeMax: formData.salaryRangeMax ? parseFloat(formData.salaryRangeMax) : undefined,
        requirements: formData.requirements
          ? formData.requirements.split('\n').filter(r => r.trim())
          : undefined,
        responsibilities: formData.responsibilities
          ? formData.responsibilities.split('\n').filter(r => r.trim())
          : undefined,
        isActive: formData.isActive,
      };

      console.log('Creating position with data:', submitData);
      let createdPosition: Position | undefined;
      if (position) {
        createdPosition = await updatePosition(position.id, submitData);
        console.log('Position updated:', createdPosition);
      } else {
        createdPosition = await createPosition(submitData);
        console.log('Position created:', createdPosition);
      }

      if (createdPosition && onSuccess) {
        console.log('Calling onSuccess with position:', createdPosition);
        onSuccess(createdPosition);
      } else {
        console.error('Position creation failed or onSuccess not provided');
      }
    } catch (error: any) {
      console.error('Error creating/updating position:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save position';
      setErrors({ submit: errorMessage });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Position Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
            errors.title
              ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
              : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          }`}
          placeholder="e.g., Senior Software Engineer, Marketing Manager"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Code */}
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700">
            Position Code
          </label>
          <input
            type="text"
            id="code"
            name="code"
            value={formData.code}
            onChange={handleChange}
            className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="e.g., SSE-001"
          />
        </div>

        {/* Department */}
        <div>
          <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700">
            Department <span className="text-red-500">*</span>
          </label>
          <select
            id="departmentId"
            name="departmentId"
            value={formData.departmentId}
            onChange={handleChange}
            className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
              errors.departmentId
                ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            }`}
          >
            <option value="">Select a department</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          {errors.departmentId && <p className="mt-1 text-sm text-red-600">{errors.departmentId}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Level */}
        <div>
          <label htmlFor="level" className="block text-sm font-medium text-gray-700">
            Position Level <span className="text-red-500">*</span>
          </label>
          <select
            id="level"
            name="level"
            value={formData.level}
            onChange={handleChange}
            className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
              errors.level
                ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            }`}
          >
            <option value="">Select a level</option>
            {POSITION_LEVELS.map(level => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
          {errors.level && <p className="mt-1 text-sm text-red-600">{errors.level}</p>}
        </div>

        {/* Employment Type */}
        <div>
          <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700">
            Employment Type <span className="text-red-500">*</span>
          </label>
          <select
            id="employmentType"
            name="employmentType"
            value={formData.employmentType}
            onChange={handleChange}
            className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
              errors.employmentType
                ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            }`}
          >
            <option value="">Select employment type</option>
            {EMPLOYMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.employmentType && <p className="mt-1 text-sm text-red-600">{errors.employmentType}</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full min-h-[2.5rem] bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Brief description of the position"
        />
      </div>

      {/* Salary Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Salary Range (Annual)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="salaryRangeMin" className="block text-xs text-gray-600 mb-1">
              Minimum
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                $
              </span>
              <input
                type="number"
                id="salaryRangeMin"
                name="salaryRangeMin"
                value={formData.salaryRangeMin}
                onChange={handleChange}
                className={`block w-full pl-7 rounded-md shadow-sm sm:text-sm ${
                  errors.salaryRangeMin
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="50000"
                step="1000"
              />
            </div>
            {errors.salaryRangeMin && <p className="mt-1 text-sm text-red-600">{errors.salaryRangeMin}</p>}
          </div>

          <div>
            <label htmlFor="salaryRangeMax" className="block text-xs text-gray-600 mb-1">
              Maximum
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                $
              </span>
              <input
                type="number"
                id="salaryRangeMax"
                name="salaryRangeMax"
                value={formData.salaryRangeMax}
                onChange={handleChange}
                className={`block w-full pl-7 rounded-md shadow-sm sm:text-sm ${
                  errors.salaryRangeMax
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="80000"
                step="1000"
              />
            </div>
            {errors.salaryRangeMax && <p className="mt-1 text-sm text-red-600">{errors.salaryRangeMax}</p>}
          </div>
        </div>
      </div>

      {/* Requirements */}
      <div>
        <label htmlFor="requirements" className="block text-sm font-medium text-gray-700">
          Requirements
        </label>
        <p className="text-xs text-gray-500 mb-1">Enter each requirement on a new line</p>
        <textarea
          id="requirements"
          name="requirements"
          value={formData.requirements}
          onChange={handleChange}
          rows={4}
          className="mt-1 block w-full rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-sm"
          placeholder="Bachelor's degree in Computer Science&#10;5+ years of experience&#10;Strong knowledge of React and TypeScript"
        />
      </div>

      {/* Responsibilities */}
      <div>
        <label htmlFor="responsibilities" className="block text-sm font-medium text-gray-700">
          Responsibilities
        </label>
        <p className="text-xs text-gray-500 mb-1">Enter each responsibility on a new line</p>
        <textarea
          id="responsibilities"
          name="responsibilities"
          value={formData.responsibilities}
          onChange={handleChange}
          rows={4}
          className="mt-1 block w-full rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-sm"
          placeholder="Design and develop frontend applications&#10;Lead technical discussions&#10;Mentor junior developers"
        />
      </div>

      {/* Is Active */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isActive"
          name="isActive"
          checked={formData.isActive}
          onChange={handleChange}
          className="h-4 w-4 rounded border-black text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
          Active Position (Available for hiring)
        </label>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{errors.submit}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
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
          {loading ? 'Saving...' : position ? 'Update Position' : 'Create Position'}
        </button>
      </div>
    </form>
  );
};

export default PositionForm;
