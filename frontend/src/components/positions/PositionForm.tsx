import React, { useState } from 'react';
import { usePositionStore } from '../../store/positionStore';
import { Position } from '../../services/position.service';

interface PositionFormProps {
  position?: Position | null;
  organizationId: string;
  onSuccess?: (createdPosition?: Position) => void;
  onCancel?: () => void;
}

const PositionForm: React.FC<PositionFormProps> = ({
  position,
  organizationId,
  onSuccess,
  onCancel,
}) => {
  const { createPosition, updatePosition, loading } = usePositionStore();

  const [formData, setFormData] = useState({
    title: position?.title || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!validate()) return;

    try {
      const submitData = {
        organizationId,
        title: formData.title.trim(),
      };

      let createdPosition: Position | undefined;
      if (position) {
        createdPosition = await updatePosition(position.id, submitData);
      } else {
        createdPosition = await createPosition(submitData);
      }

      if (createdPosition && onSuccess) {
        onSuccess(createdPosition);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save position';
      setErrors({ submit: errorMessage });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {errors.submit && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{errors.submit}</p>
        </div>
      )}

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
