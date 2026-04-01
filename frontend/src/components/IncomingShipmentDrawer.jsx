import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { createIncomingTransfer, getSpareParts } from '../services/api';
import useApp from '../hooks/useApp';

const TRANSPORT_MODES = ['Truck', 'Air', 'Ship', 'Train', 'Local'];

const toDateInputValue = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
  return date.toISOString().split('T')[0];
};

const buildInitialForm = (fallbackStoreId) => ({
  sourceType: 'external',
  fromStoreId: '',
  externalSource: '',
  toStoreId: fallbackStoreId || '',
  items: [{ itemId: '', quantity: '' }],
  driverName: '',
  driverPhone: '',
  driverId: '',
  modeOfTransport: 'Truck',
  vehicleNumber: '',
  distance: '',
  dispatchDate: toDateInputValue(new Date()),
  expectedDeliveryDate: '',
  notes: ''
});

const glassInputClass = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none dark:border-sky-300/20 dark:bg-slate-900/45 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-300/60';
const glassPanelClass = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-md backdrop-blur-md transition-colors duration-300 dark:border-sky-200/15 dark:bg-gradient-to-br dark:from-slate-900/65 dark:via-slate-900/55 dark:to-slate-800/45 dark:shadow-[0_18px_45px_rgba(2,8,26,0.45)]';

const getEntityId = (entity) => String(entity?.id ?? entity?._id ?? '').trim();

export default function IncomingShipmentDrawer({
  isOpen,
  stores,
  defaultToStore,
  onClose,
  onSuccess
}) {
  const { spareParts, selectedStore } = useApp();
  const fallbackStoreId = defaultToStore || selectedStore || '';

  const [form, setForm] = useState(() => buildInitialForm(fallbackStoreId));
  const [destinationInventory, setDestinationInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(buildInitialForm(fallbackStoreId));
    setErrors([]);
  }, [isOpen, fallbackStoreId]);

  useEffect(() => {
    if (!isOpen || !form.toStoreId) {
      setDestinationInventory([]);
      return;
    }

    const fetchInventory = async () => {
      setInventoryLoading(true);
      try {
        const response = await getSpareParts({ storeId: form.toStoreId });
        setDestinationInventory(response.success && Array.isArray(response.data) ? response.data : []);
      } finally {
        setInventoryLoading(false);
      }
    };

    fetchInventory();
  }, [isOpen, form.toStoreId]);

  const sourceStores = useMemo(
    () => stores.filter((store) => getEntityId(store) !== String(form.toStoreId)),
    [stores, form.toStoreId]
  );

  const availableById = useMemo(() => {
    const map = new Map();
    for (const item of destinationInventory) {
      map.set(getEntityId(item), Number(item.quantity || 0));
    }
    return map;
  }, [destinationInventory]);

  const selectedRows = useMemo(() => {
    const partById = new Map((spareParts || []).map((item) => [getEntityId(item), item]));
    return form.items
      .map((row) => {
        const quantity = Number(row.quantity || 0);
        const part = partById.get(String(row.itemId));
        return {
          ...row,
          quantity,
          part,
          available: Number(availableById.get(String(row.itemId)) || 0)
        };
      })
      .filter((row) => row.itemId && Number.isInteger(row.quantity) && row.quantity > 0);
  }, [form.items, spareParts, availableById]);

  const updateForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors([]);
  };

  const updateItem = (index, patch) => {
    setForm((prev) => {
      const next = [...prev.items];
      next[index] = { ...next[index], ...patch };
      return { ...prev, items: next };
    });
    setErrors([]);
  };

  const addItemRow = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { itemId: '', quantity: '' }] }));
  };

  const removeItemRow = (index) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  };

  const validate = () => {
    const nextErrors = [];

    if (!form.toStoreId) {
      nextErrors.push('Destination store is required.');
    }

    if (form.sourceType === 'internal') {
      if (!form.fromStoreId) {
        nextErrors.push('Source store is required for internal incoming shipments.');
      }
      if (form.fromStoreId && form.toStoreId && String(form.fromStoreId) === String(form.toStoreId)) {
        nextErrors.push('Source and destination store cannot be the same.');
      }
    }

    if (form.sourceType === 'external' && !String(form.externalSource || '').trim()) {
      nextErrors.push('External source is required.');
    }

    if (!String(form.driverName || '').trim() || !String(form.driverPhone || '').trim() || !String(form.driverId || '').trim()) {
      nextErrors.push('Driver name, phone, and driver ID are required.');
    }

    if (!form.expectedDeliveryDate) {
      nextErrors.push('Expected delivery date is required.');
    }

    const dispatch = new Date(form.dispatchDate);
    const expected = new Date(form.expectedDeliveryDate);
    if (!Number.isNaN(dispatch.getTime()) && !Number.isNaN(expected.getTime()) && expected <= dispatch) {
      nextErrors.push('Expected delivery date must be after dispatch date.');
    }

    if (selectedRows.length === 0) {
      nextErrors.push('Add at least one shipment item with quantity.');
    }

    const selectedIds = selectedRows.map((row) => row.itemId);
    if (new Set(selectedIds).size !== selectedIds.length) {
      nextErrors.push('Duplicate item rows are not allowed.');
    }

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validate();
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    const sourceStoreName = stores.find((store) => getEntityId(store) === String(form.fromStoreId))?.name || '';
    const destinationStoreName = stores.find((store) => getEntityId(store) === String(form.toStoreId))?.name || '';

    const payload = {
      type: 'incoming',
      from_store_id: form.sourceType === 'internal' ? form.fromStoreId : '',
      source_store_id: form.sourceType === 'internal' ? form.fromStoreId : '',
      from_store_name: form.sourceType === 'internal' ? sourceStoreName : String(form.externalSource || '').trim(),
      from_external_name: form.sourceType === 'external' ? String(form.externalSource || '').trim() : '',
      to_store_id: form.toStoreId,
      destination_store_id: form.toStoreId,
      to_store_name: destinationStoreName,
      items: selectedRows.map((row) => ({
        spare_part_id: row.itemId,
        quantity: row.quantity
      })),
      driver: {
        name: String(form.driverName || '').trim(),
        phone: String(form.driverPhone || '').trim(),
        driver_id: String(form.driverId || '').trim()
      },
      mode_of_transport: form.modeOfTransport,
      vehicle_number: String(form.vehicleNumber || '').trim(),
      distance_km: form.distance === '' ? 0 : Number(form.distance),
      dispatch_date: form.dispatchDate,
      expected_delivery_date: form.expectedDeliveryDate,
      status: 'in_transit',
      notes: form.notes
    };

    setSubmitting(true);
    setErrors([]);
    try {
      const response = await createIncomingTransfer(payload);
      if (!response.success) {
        setErrors([response.error || 'Failed to create incoming shipment.']);
        return;
      }

      onClose();
      await onSuccess?.(response.data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={onClose}
          />

          <Motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-6xl bg-slate-100 text-slate-900 shadow-2xl transition-colors duration-300 dark:bg-[radial-gradient(circle_at_80%_12%,rgba(56,189,248,0.16),transparent_30%),linear-gradient(160deg,#060f24_0%,#091933_55%,#0c1e3d_100%)] dark:text-slate-100"
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-gray-200 bg-white/80 px-6 py-5 backdrop-blur transition-colors duration-300 dark:border-sky-200/15 dark:bg-slate-950/35">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Incoming Shipment</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create and track incoming stock movement.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-sky-300/30 bg-slate-900/45 px-3 py-1.5 text-sm text-slate-100 hover:bg-sky-500/15"
                  >
                    Close
                  </button>
                </div>
              </div>

              <form id="incoming-shipment-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
                {errors.length > 0 && (
                  <div className="mb-4 rounded-xl border border-rose-400/45 bg-rose-900/35 px-4 py-3 text-sm text-rose-100 shadow-[0_10px_30px_rgba(127,29,29,0.35)]">
                    {errors.map((message, index) => (
                      <div key={`${message}-${index}`}>• {message}</div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <section className={glassPanelClass}>
                    <h3 className="mb-4 text-base font-semibold">Shipment Details</h3>

                    <div className="space-y-4">
                      <div>
                        <span className="mb-2 block text-sm text-slate-300">Source</span>
                        <div className="mb-2 flex gap-3 text-sm">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name="sourceType"
                              value="internal"
                              checked={form.sourceType === 'internal'}
                              onChange={() => updateForm({ sourceType: 'internal', externalSource: '' })}
                            />
                            Internal Store
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name="sourceType"
                              value="external"
                              checked={form.sourceType === 'external'}
                              onChange={() => updateForm({ sourceType: 'external', fromStoreId: '' })}
                            />
                            External
                          </label>
                        </div>

                        {form.sourceType === 'internal' ? (
                          <select
                            value={form.fromStoreId}
                            onChange={(event) => updateForm({ fromStoreId: event.target.value })}
                            className={glassInputClass}
                          >
                            <option value="">Select source store</option>
                            {sourceStores.map((store, index) => {
                              const storeId = getEntityId(store);
                              return (
                              <option key={`source-store-${storeId || index}`} value={storeId}>{store.name}</option>
                              );
                            })}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={form.externalSource}
                            onChange={(event) => updateForm({ externalSource: event.target.value })}
                            placeholder="External supplier or warehouse"
                            className={glassInputClass}
                          />
                        )}
                      </div>

                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">Destination Store *</span>
                        <select
                          value={form.toStoreId}
                          onChange={(event) => updateForm({ toStoreId: event.target.value })}
                          className={glassInputClass}
                        >
                          <option value="">Select destination store</option>
                          {stores.map((store, index) => {
                            const storeId = getEntityId(store);
                            return (
                            <option key={`destination-store-${storeId || index}`} value={storeId}>{store.name}</option>
                            );
                          })}
                        </select>
                      </label>

                      <p className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
                        Stock will be added to selected destination store after receiving.
                      </p>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Items</h4>
                          <button
                            type="button"
                            onClick={addItemRow}
                            className="rounded-xl border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
                          >
                            + Add Item
                          </button>
                        </div>

                        <div className="space-y-2">
                          {form.items.map((row, index) => {
                            const available = Number(availableById.get(String(row.itemId)) || 0);
                            const requested = Number(row.quantity || 0);

                            return (
                                <div key={`incoming-row-${index}`} className="rounded-xl border border-sky-300/20 bg-slate-900/35 p-3">
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_auto]">
                                  <select
                                    value={row.itemId}
                                    onChange={(event) => updateItem(index, { itemId: event.target.value })}
                                      className={glassInputClass}
                                  >
                                    <option value="">Select item</option>
                                    {spareParts.map((part, partIndex) => {
                                      const partId = getEntityId(part);
                                      return (
                                      <option key={`incoming-part-${partId || partIndex}`} value={partId}>{part.name}</option>
                                      );
                                    })}
                                  </select>

                                  <input
                                    type="number"
                                    min="1"
                                    value={row.quantity}
                                    onChange={(event) => updateItem(index, { quantity: event.target.value })}
                                    placeholder="Qty"
                                      className={glassInputClass}
                                  />

                                  <button
                                    type="button"
                                    onClick={() => removeItemRow(index)}
                                    disabled={form.items.length === 1}
                                    className="rounded-xl border border-sky-300/25 bg-slate-900/35 px-3 py-2 text-xs hover:bg-sky-500/15 disabled:opacity-40"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="mt-2 text-xs text-slate-300">
                                  Available: {inventoryLoading ? '...' : available} | Requested: {Number.isFinite(requested) ? requested : 0}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={glassPanelClass}>
                    <h3 className="mb-4 text-base font-semibold">Driver & Transport</h3>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="text-sm md:col-span-2">
                        <span className="mb-1 block text-slate-300">Driver Name *</span>
                        <input
                          type="text"
                          value={form.driverName}
                          onChange={(event) => updateForm({ driverName: event.target.value })}
                          className={glassInputClass}
                        />
                      </label>

                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">Phone *</span>
                        <input
                          type="text"
                          value={form.driverPhone}
                          onChange={(event) => updateForm({ driverPhone: event.target.value })}
                          className={glassInputClass}
                        />
                      </label>

                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">Driver ID *</span>
                        <input
                          type="text"
                          value={form.driverId}
                          onChange={(event) => updateForm({ driverId: event.target.value })}
                          className={glassInputClass}
                        />
                      </label>

                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">Vehicle</span>
                        <input
                          type="text"
                          value={form.vehicleNumber}
                          onChange={(event) => updateForm({ vehicleNumber: event.target.value })}
                          className={glassInputClass}
                        />
                      </label>

                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">Mode</span>
                        <select
                          value={form.modeOfTransport}
                          onChange={(event) => updateForm({ modeOfTransport: event.target.value })}
                          className={glassInputClass}
                        >
                          {TRANSPORT_MODES.map((mode) => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <section className={glassPanelClass}>
                    <h3 className="mb-4 text-base font-semibold">Timeline</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">Dispatch Date</span>
                        <input
                          type="date"
                          value={form.dispatchDate}
                          onChange={(event) => updateForm({ dispatchDate: event.target.value })}
                          className={glassInputClass}
                        />
                      </label>

                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">Expected Date *</span>
                        <input
                          type="date"
                          value={form.expectedDeliveryDate}
                          onChange={(event) => updateForm({ expectedDeliveryDate: event.target.value })}
                          className={glassInputClass}
                        />
                      </label>

                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">Distance (KM)</span>
                        <input
                          type="number"
                          min="0"
                          value={form.distance}
                          onChange={(event) => updateForm({ distance: event.target.value })}
                          className={glassInputClass}
                        />
                      </label>
                    </div>
                  </section>

                  <section className={glassPanelClass}>
                    <h3 className="mb-4 text-base font-semibold">Notes</h3>
                    <textarea
                      value={form.notes}
                      onChange={(event) => updateForm({ notes: event.target.value })}
                      rows={5}
                      className={glassInputClass}
                    />
                  </section>
                </div>
              </form>

              <div className="border-t border-sky-200/15 bg-slate-950/65 px-6 py-4 backdrop-blur">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-sky-300/30 bg-slate-900/45 px-5 py-2 text-sm text-slate-100 hover:bg-sky-500/15"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="incoming-shipment-form"
                    disabled={submitting}
                    className="rounded-xl border border-sky-200/30 bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(2,132,199,0.42)] transition-all duration-200 hover:scale-105 disabled:opacity-60"
                  >
                    {submitting ? 'Creating...' : 'Create Shipment'}
                  </button>
                </div>
              </div>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
