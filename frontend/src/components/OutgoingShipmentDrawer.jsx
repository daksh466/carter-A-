import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { createTransfer, getSpareParts } from '../services/api';
import useApp from '../hooks/useApp';

const TRANSPORT_MODES = ['Truck', 'Air', 'Ship', 'Train', 'Local'];

const toDateInputValue = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
  return date.toISOString().split('T')[0];
};

const getStoreName = (stores, id) => stores.find((store) => String(store.id) === String(id))?.name || 'Unknown Store';

const buildInitialForm = (fallbackStoreId) => ({
  fromStoreId: fallbackStoreId || '',
  destinationType: 'internal',
  toStoreId: '',
  externalDestination: '',
  items: [{ itemId: '', quantity: '' }],
  driverName: '',
  driverPhone: '',
  driverId: '',
  modeOfTransport: 'Truck',
  vehicleNumber: '',
  distance: '',
  dispatchDate: toDateInputValue(new Date()),
  expectedDeliveryDate: '',
  requiresConfirmation: true,
  notes: ''
});

const glassInputClass = 'w-full rounded-xl border border-sky-300/20 bg-slate-900/45 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-sky-300/60 focus:ring-2 focus:ring-sky-300/20 focus:outline-none';
const glassPanelClass = 'rounded-2xl border border-sky-200/15 bg-gradient-to-br from-slate-900/65 via-slate-900/55 to-slate-800/45 p-5 shadow-[0_18px_45px_rgba(2,8,26,0.45)] backdrop-blur-md';

const OutgoingShipmentDrawer = ({
  isOpen,
  stores,
  defaultFromStore,
  onClose,
  onSuccess
}) => {
  const { selectedStore } = useApp();
  const fallbackStoreId = defaultFromStore || selectedStore || '';

  const [form, setForm] = useState(() => buildInitialForm(fallbackStoreId));
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(buildInitialForm(fallbackStoreId));
    setErrors([]);
  }, [isOpen, fallbackStoreId]);

  useEffect(() => {
    if (!isOpen || !form.fromStoreId) {
      setInventory([]);
      return;
    }

    const fetchInventory = async () => {
      setInventoryLoading(true);
      try {
        const response = await getSpareParts({ storeId: form.fromStoreId });
        setInventory(response.success && Array.isArray(response.data) ? response.data : []);
      } finally {
        setInventoryLoading(false);
      }
    };

    fetchInventory();
  }, [isOpen, form.fromStoreId]);

  const destinationStores = useMemo(
    () => stores.filter((store) => String(store.id) !== String(form.fromStoreId)),
    [stores, form.fromStoreId]
  );

  const availableById = useMemo(() => {
    const map = new Map();
    for (const item of inventory) {
      map.set(String(item.id), Number(item.quantity || 0));
    }
    return map;
  }, [inventory]);

  const selectedRows = useMemo(() => {
    const inventoryById = new Map(inventory.map((item) => [String(item.id), item]));
    return form.items
      .map((row) => {
        const quantity = Number(row.quantity || 0);
        const item = inventoryById.get(String(row.itemId));
        return {
          itemId: row.itemId,
          item,
          quantity,
          available: Number(availableById.get(String(row.itemId)) || 0)
        };
      })
      .filter((row) => row.itemId && row.item && Number.isInteger(row.quantity) && row.quantity > 0);
  }, [form.items, inventory, availableById]);

  const updateForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors([]);
  };

  const updateItem = (index, patch) => {
    setForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], ...patch };
      return { ...prev, items: nextItems };
    });
    setErrors([]);
  };

  const addItemRow = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { itemId: '', quantity: '' }] }));
  };

  const removeItemRow = (index) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, currentIndex) => currentIndex !== index) };
    });
  };

  const validate = () => {
    const nextErrors = [];

    if (!form.fromStoreId) {
      nextErrors.push('Source store is required.');
    }

    if (form.destinationType === 'internal') {
      if (!form.toStoreId) {
        nextErrors.push('Destination store is required for internal outgoing shipment.');
      }
      if (form.toStoreId && String(form.toStoreId) === String(form.fromStoreId)) {
        nextErrors.push('Source and destination store cannot be the same.');
      }
    } else if (!String(form.externalDestination || '').trim()) {
      nextErrors.push('External destination is required.');
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
      nextErrors.push('Expected delivery date must be later than dispatch date.');
    }

    if (selectedRows.length === 0) {
      nextErrors.push('Select at least one item with quantity.');
    }

    for (const row of selectedRows) {
      if (row.quantity > row.available) {
        nextErrors.push(`Quantity for ${row.item.name} cannot exceed available stock (${row.available}).`);
      }
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
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const toStoreName = form.destinationType === 'internal'
      ? getStoreName(stores, form.toStoreId)
      : String(form.externalDestination || '').trim();

    const payload = {
      type: 'outgoing',
      from_store_id: form.fromStoreId,
      fromStoreId: form.fromStoreId,
      from_store_name: getStoreName(stores, form.fromStoreId),
      fromStoreName: getStoreName(stores, form.fromStoreId),
      to_store_id: form.destinationType === 'internal' ? form.toStoreId : '',
      toStoreId: form.destinationType === 'internal' ? form.toStoreId : '',
      to_store_name: toStoreName,
      toStoreName: toStoreName,
      to_external_name: form.destinationType === 'external' ? String(form.externalDestination || '').trim() : '',
      toExternalName: form.destinationType === 'external' ? String(form.externalDestination || '').trim() : '',
      items: selectedRows.map((row) => ({
        spare_part_id: row.item.id,
        sparePartId: row.item.id,
        itemId: row.item.id,
        itemName: row.item.name,
        quantity: row.quantity
      })),
      driver: {
        name: String(form.driverName || '').trim(),
        phone: String(form.driverPhone || '').trim(),
        driverId: String(form.driverId || '').trim()
      },
      modeOfTransport: form.modeOfTransport,
      vehicleNumber: String(form.vehicleNumber || '').trim(),
      distance: form.distance === '' ? 0 : Number(form.distance),
      dispatchDate: form.dispatchDate,
      expectedDeliveryDate: form.expectedDeliveryDate,
      status: 'in_transit',
      requiresConfirmation: Boolean(form.requiresConfirmation),
      confirmation_required: Boolean(form.requiresConfirmation),
      notes: form.notes,
      createdBy: 'Current User'
    };

    setSubmitting(true);
    setErrors([]);
    try {
      const response = await createTransfer(payload);
      if (!response.success) {
        setErrors(response.errors?.length ? response.errors : [response.error || 'Failed to dispatch shipment.']);
        return;
      }

      window.dispatchEvent(
        new CustomEvent('inventory:updated', {
          detail: {
            storeIds: [form.fromStoreId, form.toStoreId].filter(Boolean),
            updatedAt: Date.now()
          }
        })
      );

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
            className="fixed inset-0 z-40 bg-black/55"
            onClick={onClose}
          />

          <Motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-6xl bg-[radial-gradient(circle_at_80%_12%,rgba(56,189,248,0.16),transparent_30%),linear-gradient(160deg,#060f24_0%,#091933_55%,#0c1e3d_100%)] text-slate-100 shadow-2xl"
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-sky-200/15 bg-slate-950/35 px-6 py-5 backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-white">Outgoing Shipment</h2>
                    <p className="mt-1 text-sm text-slate-300">Dispatch inventory and track it as in transit.</p>
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

              <form id="outgoing-shipment-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
                {errors.length > 0 && (
                  <div className="mb-4 rounded-xl border border-rose-400/45 bg-rose-900/35 px-4 py-3 text-sm text-rose-100 shadow-[0_10px_30px_rgba(127,29,29,0.35)]">
                    {errors.map((errorMessage, index) => (
                      <div key={`${errorMessage}-${index}`}>• {errorMessage}</div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <section className={glassPanelClass}>
                    <h3 className="mb-4 text-base font-semibold">Shipment Details</h3>

                    <div className="space-y-4">
                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">Source Store *</span>
                        <select
                          value={form.fromStoreId}
                          onChange={(event) => updateForm({ fromStoreId: event.target.value, toStoreId: '', externalDestination: '' })}
                          className={glassInputClass}
                        >
                          <option value="">Select source store</option>
                          {stores.map((store) => (
                            <option key={store.id} value={store.id}>{store.name}</option>
                          ))}
                        </select>
                      </label>

                      <div>
                        <span className="mb-1 block text-sm text-slate-300">Destination</span>
                        <div className="mb-2 flex gap-3 text-sm">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name="destinationType"
                              value="internal"
                              checked={form.destinationType === 'internal'}
                              onChange={() => updateForm({ destinationType: 'internal', externalDestination: '' })}
                            />
                            Internal Store
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name="destinationType"
                              value="external"
                              checked={form.destinationType === 'external'}
                              onChange={() => updateForm({ destinationType: 'external', toStoreId: '' })}
                            />
                            External
                          </label>
                        </div>

                        {form.destinationType === 'internal' ? (
                          <select
                            value={form.toStoreId}
                            onChange={(event) => updateForm({ toStoreId: event.target.value })}
                            className={glassInputClass}
                          >
                            <option value="">Select destination store</option>
                            {destinationStores.map((store) => (
                              <option key={store.id} value={store.id}>{store.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={form.externalDestination}
                            onChange={(event) => updateForm({ externalDestination: event.target.value })}
                            placeholder="e.g. China Warehouse or Vendor"
                            className={glassInputClass}
                          />
                        )}
                      </div>

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

                        {inventoryLoading ? (
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300">
                            Loading source inventory...
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {form.items.map((row, index) => {
                              const available = Number(availableById.get(String(row.itemId)) || 0);
                              const requested = Number(row.quantity || 0);

                              return (
                                <div key={`row-${index}`} className="rounded-xl border border-sky-300/20 bg-slate-900/35 p-3">
                                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_auto]">
                                    <select
                                      value={row.itemId}
                                      onChange={(event) => updateItem(index, { itemId: event.target.value })}
                                      className={glassInputClass}
                                    >
                                      <option value="">Select item</option>
                                      {inventory.map((item) => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                      ))}
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
                                      disabled={form.items.length === 1}
                                      onClick={() => removeItemRow(index)}
                                      className="rounded-xl border border-sky-300/25 bg-slate-900/35 px-3 py-2 text-xs hover:bg-sky-500/15 disabled:opacity-40"
                                    >
                                      Remove
                                    </button>
                                  </div>

                                  <div className="mt-2 text-xs text-slate-300">
                                    Available: {available} | Requested: {Number.isFinite(requested) ? requested : 0}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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

                    <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-emerald-100">Arrival Confirmation</p>
                          <p className="mt-1 text-xs text-emerald-100/80">
                            Keep this enabled to require destination confirmation before destination inventory is credited.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => updateForm({ requiresConfirmation: !form.requiresConfirmation })}
                          className={`relative h-7 w-12 rounded-full border transition-all duration-200 ${form.requiresConfirmation ? 'border-emerald-300/60 bg-emerald-500/80' : 'border-white/25 bg-white/15'}`}
                          aria-pressed={form.requiresConfirmation}
                          title="Toggle arrival confirmation"
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${form.requiresConfirmation ? 'left-6' : 'left-1'}`}
                          />
                        </button>
                      </div>
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
                    form="outgoing-shipment-form"
                    disabled={submitting}
                    className="rounded-xl border border-sky-200/30 bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(2,132,199,0.42)] transition-all duration-200 hover:scale-105 disabled:opacity-60"
                  >
                    {submitting ? 'Dispatching...' : 'Dispatch Shipment'}
                  </button>
                </div>
              </div>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default OutgoingShipmentDrawer;
