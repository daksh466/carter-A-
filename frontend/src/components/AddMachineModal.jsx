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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Add New Machine</h2>
          <div className="text-red-200">No data available. Please add a store first.</div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4">Add New Machine</h2>
        
        {(createMachineError || validationErrors.length > 0) && (
          <div className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
            {createMachineError && <div>{createMachineError}</div>}
            {validationErrors.map((err, idx) => (
              <div key={idx}>• {err}</div>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Machine Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Machine Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
                placeholder="Enter machine name"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Store */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Store <span className="text-red-400">*</span>
            </label>
            <select
              name="store_id"
              value={formData.store_id}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
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
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Quantity Available
            </label>
            <input
              type="number"
              name="quantity_available"
              value={formData.quantity_available}
              onChange={handleChange}
              min="0"
              placeholder="e.g., 5"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Minimum Required */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Minimum Required
            </label>
            <input
              type="number"
              name="minimum_required"
              value={formData.minimum_required}
              onChange={handleChange}
              min="0"
              placeholder="e.g., 3"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Warranty Expiry Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Warranty Expiry Date (Optional)
            </label>
            <input
              type="date"
              name="warranty_expiry_date"
              value={formData.warranty_expiry_date}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMachineLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {createMachineLoading ? 'Creating...' : 'Add Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
