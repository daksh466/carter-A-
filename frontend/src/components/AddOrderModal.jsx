
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
            className="fixed top-0 right-0 z-50 flex h-full w-full max-w-full flex-col bg-white shadow-2xl transition-colors duration-300 sm:w-[480px] dark:bg-gray-950"
            tabIndex={-1}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 px-6 py-4 backdrop-blur-sm transition-colors duration-300 dark:border-gray-800 dark:bg-gray-950/90">
              <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Create Order</h2>
              <button onClick={onClose} className="rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
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
                  className="mb-2 max-h-32 overflow-y-auto rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500 dark:bg-red-900/30 dark:text-red-200"
                >
                  {createOrderError && <div>{createOrderError}</div>}
                  {validationErrors.map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </Motion.div>
              )}
              {/* Card: Customer Info */}
              <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-md transition-colors duration-300 dark:border-gray-700 dark:bg-gray-900/80">
                <div className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">Customer Info</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400">Customer Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      placeholder="Enter customer name"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400">Email</label>
                      <input
                        type="email"
                        name="customerEmail"
                        value={formData.customerEmail}
                        onChange={handleChange}
                        placeholder="Enter customer email"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400">Phone</label>
                      <input
                        type="tel"
                        name="customerPhone"
                        value={formData.customerPhone}
                        onChange={handleChange}
                        placeholder="Enter customer phone"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Card: Machines Selection */}
              <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-md transition-colors duration-300 dark:border-gray-700 dark:bg-gray-900/80">
                <div className="mb-1 flex items-center justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
                  <span>Machines Selection</span>
                  <button
                    type="button"
                    onClick={addMachine}
                    className="flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/60 dark:text-blue-300 dark:hover:bg-blue-800/80 dark:hover:text-white"
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
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
                        className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-2 text-gray-900 placeholder-gray-500 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                      {formData.machines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMachine(index)}
                          className="rounded bg-red-100 p-2 text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/60 dark:text-red-300 dark:hover:bg-red-800/80 dark:hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </Motion.div>
                  ))}
                </div>
              </div>
              {/* Card: Payment Details */}
              <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-md transition-colors duration-300 dark:border-gray-700 dark:bg-gray-900/80">
                <div className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">Payment Details</div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400">Total Amount <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        name="totalAmount"
                        value={formData.totalAmount}
                        onChange={handleChange}
                        min="0"
                        placeholder="Enter total amount"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400">Payment Status <span className="text-red-500">*</span></label>
                      <select
                        name="paymentStatus"
                        value={formData.paymentStatus}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
                      <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400">Verified By <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="verifiedBy"
                        value={formData.verifiedBy}
                        onChange={handleChange}
                        placeholder="Enter verifier name"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400">Order Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        name="orderDate"
                        value={formData.orderDate}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Order Summary Panel */}
              <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm transition-colors duration-300 dark:border-gray-800 dark:bg-gray-950/80">
                <div className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">Order Summary</div>
                <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span>Total Machines</span>
                  <span className="font-bold">{formData.machines.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span>Total Price</span>
                  <span className="font-bold">₹{formData.totalAmount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span>Payment Status</span>
                  <span className="font-bold">{formData.paymentStatus}</span>
                </div>
              </div>
              <div className="h-24" /> {/* Spacer for sticky footer */}
            </form>
            {/* Sticky Footer */}
            <div className="sticky bottom-0 z-20 flex w-full gap-3 border-t border-gray-200 bg-gradient-to-t from-gray-100/95 to-white/70 px-6 py-4 transition-colors duration-300 dark:border-gray-800 dark:from-gray-950/95 dark:to-gray-950/60">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
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
