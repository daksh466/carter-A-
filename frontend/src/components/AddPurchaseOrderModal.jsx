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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between pb-4 mb-4 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Create Purchase Order</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 transition">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {(createPurchaseError || validationErrors.length > 0) && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-xl text-red-200 text-sm">
            {createPurchaseError && <div>• {createPurchaseError}</div>}
            {validationErrors.map((err, idx) => <div key={idx}>• {err}</div>)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier & Store */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Supplier Name *</label>
              <input
                name="supplierName"
                value={formData.supplierName}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition"
                placeholder="Enter supplier name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Receiving Store *</label>
              <select
                name="store_id"
                value={formData.store_id}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition"
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
              <h3 className="text-lg font-semibold text-white">Items</h3>
              <button type="button" onClick={addItem} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <input
                    placeholder="Part Name *"
                    value={item.name}
                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    className="col-span-1 md:col-span-2 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                  />
                  <select
                    value={item.machine_id}
                    onChange={(e) => handleItemChange(index, 'machine_id', e.target.value)}
                    className="col-span-1 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                  >
                    <option value="">Machine</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <select
                    value={item.store_id}
                    onChange={(e) => handleItemChange(index, 'store_id', e.target.value)}
                    className="col-span-1 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
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
                      className="px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    />
                    <input
                      type="number"
                      placeholder="Price *"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                      min="0"
                      step="0.01"
                      className="px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-700">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Total Amount *</label>
              <input
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-2xl font-bold"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-400 mt-1">Auto-calculated: ₹{calculateTotal().toFixed(2)}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="Ordered">Ordered</option>
                <option value="Received">Received</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">PO Date *</label>
              <input
                type="date"
                name="poDate"
                value={formData.poDate}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 resize-vertical"
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
