import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';

export default function AddSparePartModal({ isOpen, onClose, onSuccess }) {
  const { stores, machines, handleCreateSparePart, createSpareLoading, createSpareError } = useApp();

  const getEntityId = (entity) => String(entity?.id || entity?._id || '').trim();
  const firstMachineId = getEntityId(machines?.[0]);
  const firstStoreId = getEntityId(stores?.[0]);

  const defaultFormState = {
    name: '',
    size: '',
    type: '',
    unit: 'pcs',
    machine_id: firstMachineId,
    machine_ids: firstMachineId ? [firstMachineId] : [],
    store_id: '',
    quantity_available: '',
    minimum_required: '',
    warranty_expiry_date: '',
    batch_number: '',
    expiry_date: ''
  };

  const [formData, setFormData] = useState({
    ...defaultFormState
  });
  const [validationErrors, setValidationErrors] = useState([]);

  const hasErrors = createSpareError || validationErrors.length > 0;
  const quantityNum = Number(formData.quantity_available || 0);
  const minNum = Number(formData.minimum_required || 0);
  const isLowStockPreview = Number.isFinite(quantityNum) && Number.isFinite(minNum) && quantityNum <= minNum;

  const labelClass = 'block text-xs font-semibold text-slate-300 mb-1.5 tracking-wide';
  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-slate-900/85 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition';
  const sectionCardClass = 'rounded-xl border border-slate-700/80 bg-slate-900/55 p-4';

  // Always sync store_id to first available store if stores change
  React.useEffect(() => {
    if (firstStoreId && !formData.store_id) {
      setFormData((prev) => {
        if (prev.store_id === firstStoreId) return prev;
        return { ...prev, store_id: firstStoreId };
      });
    }
  }, [firstStoreId, formData.store_id]);

  React.useEffect(() => {
    if (firstMachineId && (!formData.machine_id || !Array.isArray(formData.machine_ids) || formData.machine_ids.length === 0)) {
      setFormData((prev) => {
        const currentFirst = Array.isArray(prev.machine_ids) ? String(prev.machine_ids[0] || '').trim() : '';
        if (prev.machine_id === firstMachineId && currentFirst === firstMachineId) return prev;
        return { ...prev, machine_id: firstMachineId, machine_ids: [firstMachineId] };
      });
    }
  }, [firstMachineId, formData.machine_id, formData.machine_ids]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'machine_ids') {
      const selected = Array.from(e.target.selectedOptions || []).map((option) => option.value).filter(Boolean);
      setFormData(prev => ({
        ...prev,
        machine_ids: selected,
        machine_id: selected[0] || ''
      }));
      setValidationErrors([]);
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear validation errors when user starts typing
    setValidationErrors([]);
  };

  const validateForm = () => {
    const errors = [];
    if (!formData.name.trim()) errors.push('Spare part name is required');
    if (!formData.size.trim()) errors.push('Size is required (e.g. 10mm)');
    if (!Array.isArray(formData.machine_ids) || formData.machine_ids.length === 0) errors.push('At least one machine is required');
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
    if (formData.type && !formData.type.trim()) errors.push('Type cannot be empty');
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
    const payload = {
      ...formData,
      machine_id: formData.machine_ids?.[0] || formData.machine_id || '',
      machine_ids: Array.isArray(formData.machine_ids) ? formData.machine_ids : [],
      machines: Array.isArray(formData.machine_ids) ? formData.machine_ids : []
    };

    if (import.meta.env.DEV) {
      console.log("Sending data:", payload);
    }

    const result = await handleCreateSparePart(payload);
    if (result.success) {
      setFormData({
        ...defaultFormState,
        machine_id: firstMachineId,
        machine_ids: firstMachineId ? [firstMachineId] : [],
        store_id: firstStoreId
      });
      setValidationErrors([]);
      onSuccess?.();
      onClose();
    } else {
      setValidationErrors(result.errors || [result.error]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-[0_30px_100px_rgba(8,47,73,0.55)]">
        <div className="border-b border-slate-700 bg-gradient-to-r from-cyan-900/35 via-slate-900 to-amber-900/25 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-100">Add New Spare Part</h2>
              <p className="mt-1 text-sm text-slate-300">
                Fill the basics first, then inventory and optional lot details.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-700"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-400/35 bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-200">
              Required: Name, Size, Machine, Store, Quantity, Min Required
            </span>
            <span className="rounded-full border border-emerald-400/35 bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
              Stock Preview: {isLowStockPreview ? 'Low Stock Risk' : 'Healthy'}
            </span>
          </div>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-6 py-5">
          {hasErrors && (
            <div className="mb-4 rounded-xl border border-rose-500/70 bg-rose-900/20 p-3 text-sm text-rose-100">
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-rose-200">Please fix these issues</div>
            {createSpareError && <div>{createSpareError}</div>}
            {validationErrors.map((err, idx) => (
              <div key={idx}>• {err}</div>
            ))}
          </div>
        )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <section className={sectionCardClass}>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-cyan-900/40 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-200">Step 1</span>
                <h3 className="text-sm font-bold text-slate-200">Part Identity</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelClass}>Spare Part Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Bearing"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Size *</label>
                  <input
                    type="text"
                    name="size"
                    value={formData.size}
                    onChange={handleChange}
                    placeholder="e.g., 10mm, M10"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Type (Optional)</label>
                  <input
                    type="text"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    placeholder="e.g., Steel, Rubber"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Unit *</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="m">Meters (m)</option>
                    <option value="l">Liters (l)</option>
                  </select>
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-emerald-900/40 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-200">Step 2</span>
                <h3 className="text-sm font-bold text-slate-200">Location and Stock</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Machine Usage * (Select one or more)</label>
                  <select
                    name="machine_ids"
                    value={formData.machine_ids}
                    onChange={handleChange}
                    className={inputClass}
                    multiple
                    size={Math.min(6, Math.max(3, machines?.length || 3))}
                  >
                    {machines?.map(machine => (
                      <option key={getEntityId(machine)} value={getEntityId(machine)}>
                        {machine?.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-slate-400">Hold Ctrl/Cmd to select multiple machines</div>
                </div>

                <div>
                  <label className={labelClass}>Store *</label>
                  <select
                    name="store_id"
                    value={formData.store_id}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    {stores?.map(store => (
                      <option key={getEntityId(store)} value={getEntityId(store)}>
                        {store?.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Quantity Available *</label>
                  <input
                    type="number"
                    name="quantity_available"
                    value={formData.quantity_available}
                    onChange={handleChange}
                    min="0"
                    placeholder="e.g., 24"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Minimum Required *</label>
                  <input
                    type="number"
                    name="minimum_required"
                    value={formData.minimum_required}
                    onChange={handleChange}
                    min="0"
                    placeholder="e.g., 8"
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-amber-900/40 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200">Step 3</span>
                <h3 className="text-sm font-bold text-slate-200">Warranty and Lot Details (Optional)</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Warranty Expiry Date</label>
                  <input
                    type="date"
                    name="warranty_expiry_date"
                    value={formData.warranty_expiry_date}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Batch / Lot Number</label>
                  <input
                    type="text"
                    name="batch_number"
                    value={formData.batch_number}
                    onChange={handleChange}
                    placeholder="Auto-generated if left blank"
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>Batch Expiry Date</label>
                  <input
                    type="date"
                    name="expiry_date"
                    value={formData.expiry_date}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            <div className="sticky bottom-0 -mx-6 flex gap-3 border-t border-slate-700 bg-slate-950/95 px-6 py-4 backdrop-blur">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createSpareLoading}
                className="flex-1 rounded-lg border border-cyan-400/60 bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-bold text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createSpareLoading ? 'Creating Spare Part...' : 'Create Spare Part'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
