import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';

export default function AddMachineModal({ isOpen, onClose, onSuccess }) {
  const { stores, handleCreateMachine, createMachineLoading, createMachineError } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    store_id: '',
    quantity_available: '',
    minimum_required: '',
    warranty_expiry_date: ''
  });
  const [validationErrors, setValidationErrors] = useState([]);
  const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

  // Always sync store_id to first available store if stores change
  React.useEffect(() => {
    if (stores?.length > 0 && !formData.store_id) {
      setFormData(f => ({ ...f, store_id: stores[0]?.id }));
    }
  }, [stores, formData.store_id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear validation errors when user starts typing
    setValidationErrors([]);
  };

  const validateForm = () => {
    const errors = [];
    if (!formData.name.trim()) errors.push('Machine name is required');
    if (!formData.store_id) errors.push('Store is required');
    if (!formData.quantity_available) {
      errors.push('Quantity available is required');
    } else if (isNaN(formData.quantity_available) || formData.quantity_available < 0) {
      errors.push('Quantity must be a non-negative number');
    }
    if (!formData.minimum_required) {
      errors.push('Minimum required is required');
    } else if (isNaN(formData.minimum_required) || formData.minimum_required < 0) {
      errors.push('Minimum required must be a non-negative number');
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Submit form
    const result = await handleCreateMachine(formData);
    if (result.success) {
      setFormData({
        name: '',
        store_id: '',
        quantity_available: '',
        minimum_required: '',
        warranty_expiry_date: ''
      });
      setValidationErrors([]);
      onSuccess?.();
      onClose();
    } else {
      setValidationErrors(result.errors || [result.error]);
    }
  };


  // If stores are not loaded, show a loading or error message
  if (!isOpen) return null;
  if (!stores || stores.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">Add New Machine</h2>
          <div className="text-red-700 dark:text-red-300">No data available. Please add a store first.</div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">Add New Machine</h2>
        
        {(createMachineError || validationErrors.length > 0) && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
            {createMachineError && <div>{createMachineError}</div>}
            {validationErrors.map((err, idx) => (
              <div key={idx}>• {err}</div>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Machine Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Machine Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
                placeholder="Enter machine name"
              className={inputClass}
            />
          </div>

          {/* Store */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Store <span className="text-red-400">*</span>
            </label>
            <select
              name="store_id"
              value={formData.store_id}
              onChange={handleChange}
              className={inputClass}
              required
            >
              <option value="" disabled>
                -- Select Store --
              </option>
              {stores?.map(store => (
                <option key={store?.id} value={store?.id}>
                  {store?.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Available */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Quantity Available
            </label>
            <input
              type="number"
              name="quantity_available"
              value={formData.quantity_available}
              onChange={handleChange}
              min="0"
              placeholder="e.g., 5"
              className={inputClass}
            />
          </div>

          {/* Minimum Required */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Minimum Required
            </label>
            <input
              type="number"
              name="minimum_required"
              value={formData.minimum_required}
              onChange={handleChange}
              min="0"
              placeholder="e.g., 3"
              className={inputClass}
            />
          </div>

          {/* Warranty Expiry Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Warranty Expiry Date (Optional)
            </label>
            <input
              type="date"
              name="warranty_expiry_date"
              value={formData.warranty_expiry_date}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMachineLoading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {createMachineLoading ? 'Creating...' : 'Add Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
