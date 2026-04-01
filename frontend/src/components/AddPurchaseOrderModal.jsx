import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';


export default function AddPurchaseOrderModal({ isOpen, onClose, onSuccess }) {
  const { stores, machines, handleCreatePurchaseOrder, createPurchaseLoading, createPurchaseError } = useApp();
// const drawerRef = useRef(null);
  const [formData, setFormData] = useState({
    supplierName: '',
    store_id: stores[0]?.id || '',
    items: [{ name: '', machine_id: '', store_id: stores[0]?.id || '', quantity: 1, unitPrice: '' }],
    totalAmount: '',
    status: 'Ordered',
    poDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [validationErrors, setValidationErrors] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Inventory updated successfully');
  const fieldClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

React.useEffect(() => {
    if (stores?.length > 0 && !formData.store_id) {
      setFormData(f => ({ ...f, store_id: stores[0].id }));
    }
  }, [stores, formData.store_id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationErrors([]);
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: updatedItems }));
    setValidationErrors([]);
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', machine_id: '', store_id: stores[0]?.id || '', quantity: 1, unitPrice: '' }]
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      return sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0));
    }, 0);
  };

  const validateForm = () => {
    const errors = [];
    if (!formData.supplierName.trim()) errors.push('Supplier name is required');
    if (!formData.store_id) errors.push('Store is required');
    if (formData.items.length === 0) errors.push('At least one item required');
    formData.items.forEach((item, idx) => {
      if (!item.name.trim()) errors.push(`Item ${idx+1}: name required`);
      if (!item.machine_id) errors.push(`Item ${idx+1}: machine required`);
      if (!item.store_id) errors.push(`Item ${idx+1}: store required`);
      if (item.quantity < 1 || isNaN(item.quantity)) errors.push(`Item ${idx+1}: quantity >= 1`);
      if (item.unitPrice < 0 || isNaN(item.unitPrice)) errors.push(`Item ${idx+1}: unitPrice >= 0`);
    });
    if (Math.abs(calculateTotal() - Number(formData.totalAmount)) > 0.01) {
      errors.push('Total amount must match items total');
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    const result = await handleCreatePurchaseOrder(formData);
    if (result.success) {
      setSuccessMessage('Inventory updated successfully');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          supplierName: '',
          store_id: stores[0]?.id || '',
          items: [{ name: '', machine_id: '', store_id: stores[0]?.id || '', quantity: 1, unitPrice: '' }],
          totalAmount: '',
          status: 'Ordered',
          poDate: new Date().toISOString().split('T')[0],
          notes: ''
        });
        setValidationErrors([]);
        onSuccess?.();
        onClose();
      }, 1500);
    } else {
      setValidationErrors(result.errors || [result.error]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl transition-colors duration-300 dark:border-gray-700 dark:bg-gray-900">
        <div className="sticky top-0 z-10 mb-4 flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Purchase Order</h2>
          <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {(createPurchaseError || validationErrors.length > 0) && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500 dark:bg-red-900/30 dark:text-red-200">
            {createPurchaseError && <div>• {createPurchaseError}</div>}
            {validationErrors.map((err, idx) => <div key={idx}>• {err}</div>)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier & Store */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Supplier Name *</label>
              <input
                name="supplierName"
                value={formData.supplierName}
                onChange={handleChange}
                className={fieldClass}
                placeholder="Enter supplier name"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Receiving Store *</label>
              <select
                name="store_id"
                value={formData.store_id}
                onChange={handleChange}
                className={fieldClass}
              >
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Items</h3>
              <button type="button" onClick={addItem} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800/50 md:grid-cols-5">
                  <input
                    placeholder="Part Name *"
                    value={item.name}
                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    className="col-span-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white md:col-span-2"
                  />
                  <select
                    value={item.machine_id}
                    onChange={(e) => handleItemChange(index, 'machine_id', e.target.value)}
                    className="col-span-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">Machine</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <select
                    value={item.store_id}
                    onChange={(e) => handleItemChange(index, 'store_id', e.target.value)}
                    className="col-span-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Qty *"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      min="1"
                      className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Price *"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                      min="0"
                      step="0.01"
                      className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="col-span-1 md:col-span-full p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition ml-auto w-min"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total, Status, Date */}
          <div className="grid grid-cols-1 gap-6 border-t border-gray-200 pt-4 transition-colors duration-300 dark:border-gray-700 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Total Amount *</label>
              <input
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-2xl font-bold text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Auto-calculated: ₹{calculateTotal().toFixed(2)}</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={fieldClass}
              >
                <option value="Ordered">Ordered</option>
                <option value="Received">Received</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">PO Date *</label>
              <input
                type="date"
                name="poDate"
                value={formData.poDate}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="Additional notes about this purchase..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-all duration-200"
              disabled={createPurchaseLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPurchaseLoading}
              className="flex-1 px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {createPurchaseLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Purchase Order'
              )}
            </button>
          </div>

          {showSuccess && (
            <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-pulse">
              {successMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
