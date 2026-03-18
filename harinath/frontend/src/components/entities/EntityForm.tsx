import React, { useState } from 'react';
import entityService, { Entity } from '../../services/entity.service';

interface EntityFormProps {
  organizationId: string;
  onSuccess?: (createdEntity: Entity) => void;
  onCancel?: () => void;
}

const EntityForm: React.FC<EntityFormProps> = ({
  organizationId,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({ name: '', code: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    if (!name) {
      setErrors({ name: 'Entity name is required' });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const entity = await entityService.create({
        organizationId,
        name,
        code: formData.code.trim() || null,
      });
      if (onSuccess) onSuccess(entity);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create entity';
      setErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Entity Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g. nemi, bmpl"
          className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
            errors.name ? 'border-red-500' : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          }`}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Code (optional)</label>
        <input
          type="text"
          name="code"
          value={formData.code}
          onChange={handleChange}
          placeholder="e.g. NEMI"
          className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      {errors.submit && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{errors.submit}</p>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-black rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Create Entity'}
        </button>
      </div>
    </form>
  );
};

export default EntityForm;
