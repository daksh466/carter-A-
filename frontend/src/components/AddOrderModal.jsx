
import React, { useState, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';

export default function AddOrderModal({ isOpen, onClose, onSuccess }) {
  const { machines, handleCreateOrder, createOrderLoading, createOrderError } = useApp();
  const drawerRef = useRef(null);
  const [formData, setFormData] = useState({
    customerName: '',
    machines: [{ name: '', quantity: 1 }],
    totalAmount: '',
    paymentStatus: 'Pending',
    verifiedBy: '',
    orderDate: new Date().toISOString().split('T')[0],
    customerEmail: '',
    customerPhone: ''
  });
  const [validationErrors, setValidationErrors] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setValidationErrors([]);
  };

  const handleMachineChange = (index, field, value) => {
    const updatedMachines = [...formData.machines];
    updatedMachines[index][field] = value;
    setFormData(prev => ({
      ...prev,
      machines: updatedMachines
    }));
    setValidationErrors([]);
  };

  const addMachine = () => {
    setFormData(prev => ({
      ...prev,
      machines: [...prev.machines, { name: '', quantity: 1 }]
    }));
    setValidationErrors([]);
  };

  const removeMachine = (index) => {
    setFormData(prev => ({
      ...prev,
      machines: prev.machines.filter((_, i) => i !== index)
    }));
    setValidationErrors([]);
  };

  const validateForm = () => {
    const errors = [];
    if (!formData.customerName.trim()) errors.push('Customer name is required');
    if (formData.machines.length === 0) errors.push('At least one machine is required');
    formData.machines.forEach((machine, index) => {
      if (!machine.name) {
        errors.push(`Machine ${index + 1}: name is required`);
      }
      if (!machine.quantity || isNaN(machine.quantity) || machine.quantity < 1) {
        errors.push(`Machine ${index + 1}: quantity must be at least 1`);
      }
    });
    if (!formData.totalAmount) {
      errors.push('Total amount is required');
    } else if (isNaN(formData.totalAmount) || formData.totalAmount < 0) {
      errors.push('Total amount must be a non-negative number');
    }
    if (!formData.paymentStatus) errors.push('Payment status is required');
    if (!formData.verifiedBy.trim()) errors.push('Verified by is required');
    if (!formData.orderDate) errors.push('Order date is required');
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    const machinesData = formData.machines.map(m => ({
      name: m.name,
      quantity: parseInt(m.quantity)
    }));
    const result = await handleCreateOrder({
      customerName: formData.customerName,
      machines: machinesData,
      totalAmount: parseInt(formData.totalAmount),
      paymentStatus: formData.paymentStatus,
      verifiedBy: formData.verifiedBy,
      orderDate: formData.orderDate,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone
    });
    if (result.success) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          customerName: '',
          machines: [{ name: '', quantity: 1 }],
          totalAmount: '',
          paymentStatus: 'Pending',
          verifiedBy: '',
          orderDate: new Date().toISOString().split('T')[0],
          customerEmail: '',
          customerPhone: ''
        });
        setValidationErrors([]);
        onSuccess?.();
        onClose();
      }, 1200);
    } else {
      setValidationErrors(result.errors || [result.error]);
    }
  };

  // --- Drawer Modal ---
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur */}
          <Motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[4px]"
            onClick={onClose}
          />
          {/* Drawer Panel */}
          <Motion.div
            key="drawer"
            ref={drawerRef}
            initial={{ x: '100%', opacity: 0.7, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: '100%', opacity: 0.7, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[480px] max-w-full z-50 bg-gray-950 shadow-2xl flex flex-col"
            tabIndex={-1}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-gray-950/90 border-b border-gray-800 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-white tracking-tight">Create Order</h2>
              <button onClick={onClose} className="p-2 rounded hover:bg-gray-800 transition">
                <X className="w-5 h-5 text-gray-300" />
              </button>
            </div>
            {/* Success Toast */}
            <AnimatePresence>
              {showSuccess && (
                <Motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50"
                >
                  Order created successfully!
                </Motion.div>
              )}
            </AnimatePresence>
            {/* Drawer Content */}
            <form
              id="create-order-form"
              onSubmit={handleSubmit}
              className="flex-1 flex flex-col overflow-y-auto px-6 py-4 gap-6"
              autoComplete="off"
            >
              {/* Error Messages */}
              {(createOrderError || validationErrors.length > 0) && (
                <Motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-2 p-3 bg-red-900/30 border border-red-500 rounded text-red-200 text-sm max-h-32 overflow-y-auto"
                >
                  {createOrderError && <div>{createOrderError}</div>}
                  {validationErrors.map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </Motion.div>
              )}
              {/* Card: Customer Info */}
              <div className="bg-gray-900/80 rounded-xl shadow p-5 flex flex-col gap-4">
                <div className="text-base font-semibold text-gray-100 mb-1">Customer Info</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Customer Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      placeholder="Enter customer name"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        name="customerEmail"
                        value={formData.customerEmail}
                        onChange={handleChange}
                        placeholder="Enter customer email"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Phone</label>
                      <input
                        type="tel"
                        name="customerPhone"
                        value={formData.customerPhone}
                        onChange={handleChange}
                        placeholder="Enter customer phone"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Card: Machines Selection */}
              <div className="bg-gray-900/80 rounded-xl shadow p-5 flex flex-col gap-4">
                <div className="text-base font-semibold text-gray-100 mb-1 flex items-center justify-between">
                  <span>Machines Selection</span>
                  <button
                    type="button"
                    onClick={addMachine}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-blue-900/60 text-blue-300 hover:bg-blue-800/80 hover:text-white transition text-xs font-medium"
                  >
                    <Plus className="w-4 h-4" /> Add Machine
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {formData.machines.map((machine, index) => (
                    <Motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      layout
                      className="flex gap-2 items-center"
                    >
                      <select
                        value={machine.name}
                        onChange={(e) => handleMachineChange(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition"
                      >
                        <option value="">Select Machine</option>
                        {machines.map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={machine.quantity}
                        onChange={(e) => handleMachineChange(index, 'quantity', e.target.value)}
                        placeholder="Qty"
                        className="w-20 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                      />
                      {formData.machines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMachine(index)}
                          className="p-2 rounded bg-red-900/60 text-red-300 hover:bg-red-800/80 hover:text-white transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </Motion.div>
                  ))}
                </div>
              </div>
              {/* Card: Payment Details */}
              <div className="bg-gray-900/80 rounded-xl shadow p-5 flex flex-col gap-4">
                <div className="text-base font-semibold text-gray-100 mb-1">Payment Details</div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Total Amount <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        name="totalAmount"
                        value={formData.totalAmount}
                        onChange={handleChange}
                        min="0"
                        placeholder="Enter total amount"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Payment Status <span className="text-red-500">*</span></label>
                      <select
                        name="paymentStatus"
                        value={formData.paymentStatus}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                        <option value="Failed">Failed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Verified By <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="verifiedBy"
                        value={formData.verifiedBy}
                        onChange={handleChange}
                        placeholder="Enter verifier name"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Order Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        name="orderDate"
                        value={formData.orderDate}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Order Summary Panel */}
              <div className="bg-gray-950/80 rounded-xl shadow p-5 flex flex-col gap-2 border border-gray-800">
                <div className="text-base font-semibold text-gray-100 mb-1">Order Summary</div>
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>Total Machines</span>
                  <span className="font-bold">{formData.machines.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>Total Price</span>
                  <span className="font-bold">₹{formData.totalAmount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>Payment Status</span>
                  <span className="font-bold">{formData.paymentStatus}</span>
                </div>
              </div>
              <div className="h-24" /> {/* Spacer for sticky footer */}
            </form>
            {/* Sticky Footer */}
            <div className="sticky bottom-0 z-20 w-full bg-gradient-to-t from-gray-950/95 to-gray-950/60 px-6 py-4 border-t border-gray-800 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 transition font-medium"
                disabled={createOrderLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-order-form"
                disabled={createOrderLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 text-white font-semibold shadow-lg hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transition disabled:opacity-60 relative overflow-hidden"
              >
                {createOrderLoading ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin w-5 h-5" /> Creating...</span>
                ) : (
                  <span>Create Order</span>
                )}
              </button>
            </div>
          </Motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
