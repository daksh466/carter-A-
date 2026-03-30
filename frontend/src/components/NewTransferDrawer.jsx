import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { createTransfer, getSpareParts } from '../services/api';

const TRANSPORT_MODES = ['Truck', 'Air', 'Rail'];

const toDateInputValue = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
};

const getStoreId = (store) => String(store?.id || store?._id || '');

const getStoreName = (stores, id) => {
  const safeId = String(id || '');
  const matched = stores.find((store) => getStoreId(store) === safeId);
  return matched?.name || matched?.storeHead || 'Unknown Store';
};

const buildInitialForm = (defaultFromStore) => ({
  fromStoreId: defaultFromStore || '',
  toStoreId: '',
  transferType: 'instant',
  items: [{ itemId: '', quantity: '' }],
  driverName: '',
  driverPhone: '',
  driverId: '',
  modeOfTransport: 'Truck',
  dispatchDate: toDateInputValue(new Date()),
  expectedDeliveryDate: '',
  distance: '',
  notes: ''
});

const NewTransferDrawer = ({
  isOpen,
  stores = [],
  defaultFromStore,
  onClose,
  onSuccess
}) => {
  const [form, setForm] = useState(() => buildInitialForm(defaultFromStore));
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(buildInitialForm(defaultFromStore));
    setErrors([]);
  }, [isOpen, defaultFromStore]);

  useEffect(() => {
    if (!isOpen || !form.fromStoreId) return;

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
    () => stores.filter((store) => getStoreId(store) !== String(form.fromStoreId || '')),
    [stores, form.fromStoreId]
  );

  const availableById = useMemo(() => {
    const map = new Map();
    for (const item of inventory) {
      map.set(String(item.id || item._id), Number(item.quantity || 0));
    }
    return map;
  }, [inventory]);

  const selectedRows = useMemo(() => {
    return form.items
      .map((entry) => {
        const quantity = Number(entry.quantity);
        const selected = inventory.find((item) => String(item.id || item._id) === String(entry.itemId));
        return {
          ...entry,
          quantity,
          item: selected || null,
          available: Number(availableById.get(entry.itemId) || 0)
        };
      })
      .filter((entry) => entry.item && Number.isInteger(entry.quantity) && entry.quantity > 0);
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
      return {
        ...prev,
        items: prev.items.filter((_, currentIndex) => currentIndex !== index)
      };
    });
  };

  const validate = () => {
    const nextErrors = [];

    if (!form.fromStoreId) {
      nextErrors.push('From store is required.');
    }

    if (!form.toStoreId) {
      nextErrors.push('To store is required.');
    }

    if (form.toStoreId && form.toStoreId === form.fromStoreId) {
      nextErrors.push('From and To store cannot be the same.');
    }

    if (selectedRows.length === 0) {
      nextErrors.push('Select at least one item with quantity.');
    }

    for (const row of selectedRows) {
      if (row.quantity > row.available) {
        nextErrors.push(`Quantity for ${row.item.name} cannot exceed available stock (${row.available}).`);
      }
    }

    const chosenIds = selectedRows.map((row) => row.itemId).filter(Boolean);
    if (new Set(chosenIds).size !== chosenIds.length) {
      nextErrors.push('Duplicate item rows are not allowed.');
    }

    if (form.transferType === 'shipment') {
      if (!form.driverName.trim() || !form.driverPhone.trim() || !form.driverId.trim()) {
        nextErrors.push('Driver name, phone, and ID are required for shipment transfer.');
      }

      if (!form.expectedDeliveryDate) {
        nextErrors.push('Expected delivery date is required for shipment transfer.');
      }

      const dispatch = new Date(form.dispatchDate);
      const expected = new Date(form.expectedDeliveryDate);
      if (!Number.isNaN(dispatch.getTime()) && !Number.isNaN(expected.getTime()) && expected <= dispatch) {
        nextErrors.push('Expected delivery date must be later than dispatch date.');
      }
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

    const isShipmentTransfer = form.transferType === 'shipment';
    const payload = {
      type: 'internal',
      from_store_id: form.fromStoreId,
      fromStoreId: form.fromStoreId,
      from_store_name: getStoreName(stores, form.fromStoreId),
      fromStoreName: getStoreName(stores, form.fromStoreId),
      to_store_id: form.toStoreId,
      toStoreId: form.toStoreId,
      to_store_name: getStoreName(stores, form.toStoreId),
      toStoreName: getStoreName(stores, form.toStoreId),
      items: selectedRows.map((row) => ({
        spare_part_id: row.item.id || row.item._id,
        sparePartId: row.item.id || row.item._id,
        itemId: row.item.id || row.item._id,
        itemName: row.item.name,
        quantity: row.quantity
      })),
      isInstant: !isShipmentTransfer,
      status: isShipmentTransfer ? 'in_transit' : 'completed',
      createdBy: 'Current User',
      notes: form.notes.trim()
    };

    if (isShipmentTransfer) {
      payload.driver = {
        name: form.driverName.trim(),
        phone: form.driverPhone.trim(),
        driverId: form.driverId.trim()
      };
      payload.modeOfTransport = form.modeOfTransport;
      payload.dispatchDate = form.dispatchDate;
      payload.expectedDeliveryDate = form.expectedDeliveryDate;
      payload.distance = form.distance === '' ? 0 : Number(form.distance);
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const response = await createTransfer(payload);
      if (!response.success) {
        setErrors(response.errors?.length ? response.errors : [response.error || 'Failed to create transfer.']);
        return;
      }

      window.dispatchEvent(
        new CustomEvent('inventory:updated', {
          detail: {
            storeIds: [form.fromStoreId, !isShipmentTransfer ? form.toStoreId : null].filter(Boolean),
            updatedAt: Date.now()
          }
        })
      );

      onSuccess?.(response.data, form.transferType);
      onClose();
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
            className="fixed inset-y-0 right-0 z-50 w-full bg-slate-950 text-slate-100 shadow-2xl"
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-800 px-5 py-4 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Inter-Store Transfer</h2>
                    <p className="mt-1 text-sm text-slate-300">Move stock instantly or send it as an in-transit shipment.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 sm:px-8">
                {errors.length > 0 && (
                  <div className="mb-4 rounded-lg border border-rose-500/60 bg-rose-900/30 px-4 py-3 text-sm text-rose-100">
                    {errors.map((errorMessage, index) => (
                      <div key={`${errorMessage}-${index}`}>- {errorMessage}</div>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <h3 className="mb-3 text-base font-semibold">Transfer Details</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">From Store</span>
                        <select
                          value={form.fromStoreId}
                          disabled
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                        >
                          <option value="">Select store</option>
                          {stores.map((store) => {
                            const storeId = getStoreId(store);
                            return <option key={storeId} value={storeId}>{store.name || store.storeHead}</option>;
                          })}
                        </select>
                      </label>

                      <label className="text-sm">
                        <span className="mb-1 block text-slate-300">To Store</span>
                        <select
                          value={form.toStoreId}
                          onChange={(event) => updateForm({ toStoreId: event.target.value })}
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                        >
                          <option value="">Select destination store</option>
                          {destinationStores.map((store) => {
                            const storeId = getStoreId(store);
                            return <option key={storeId} value={storeId}>{store.name || store.storeHead}</option>;
                          })}
                        </select>
                      </label>
                    </div>

                    <div className="mt-4">
                      <span className="mb-1 block text-sm text-slate-300">Transfer Type</span>
                      <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1 text-sm">
                        <button
                          type="button"
                          onClick={() => updateForm({ transferType: 'instant' })}
                          className={`rounded-md px-3 py-1.5 ${form.transferType === 'instant' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
                        >
                          Instant Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() => updateForm({ transferType: 'shipment' })}
                          className={`rounded-md px-3 py-1.5 ${form.transferType === 'shipment' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
                        >
                          Shipment Transfer
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-base font-semibold">Items</h3>
                      <button
                        type="button"
                        onClick={addItemRow}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                      >
                        Add Item
                      </button>
                    </div>

                    {inventoryLoading ? (
                      <div className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-3 text-sm text-slate-300">
                        Loading source inventory...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {form.items.map((row, index) => {
                          const available = Number(availableById.get(row.itemId) || 0);
                          return (
                            <div key={`row-${index}`} className="grid gap-2 rounded-md border border-slate-800 bg-slate-800/50 p-2 md:grid-cols-[2fr_auto_1fr_auto]">
                              <select
                                value={row.itemId}
                                onChange={(event) => updateItem(index, { itemId: event.target.value })}
                                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                              >
                                <option value="">Item name</option>
                                {inventory.map((item) => {
                                  const itemId = String(item.id || item._id);
                                  return <option key={itemId} value={itemId}>{item.name}</option>;
                                })}
                              </select>

                              <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                                {available}
                              </div>

                              <input
                                type="number"
                                min="1"
                                value={row.quantity}
                                onChange={(event) => updateItem(index, { quantity: event.target.value })}
                                placeholder="Transfer qty"
                                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                              />

                              <button
                                type="button"
                                disabled={form.items.length === 1}
                                onClick={() => removeItemRow(index)}
                                className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-slate-400">Second column shows available quantity in source store.</p>
                  </section>

                  {form.transferType === 'shipment' && (
                    <>
                      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                        <h3 className="mb-3 text-base font-semibold">Shipment Details</h3>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-sm">
                            <span className="mb-1 block text-slate-300">Driver Name</span>
                            <input
                              type="text"
                              value={form.driverName}
                              onChange={(event) => updateForm({ driverName: event.target.value })}
                              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
                            />
                          </label>

                          <label className="text-sm">
                            <span className="mb-1 block text-slate-300">Driver Phone</span>
                            <input
                              type="text"
                              value={form.driverPhone}
                              onChange={(event) => updateForm({ driverPhone: event.target.value })}
                              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
                            />
                          </label>

                          <label className="text-sm">
                            <span className="mb-1 block text-slate-300">Driver ID</span>
                            <input
                              type="text"
                              value={form.driverId}
                              onChange={(event) => updateForm({ driverId: event.target.value })}
                              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
                            />
                          </label>

                          <label className="text-sm">
                            <span className="mb-1 block text-slate-300">Mode of Transport</span>
                            <select
                              value={form.modeOfTransport}
                              onChange={(event) => updateForm({ modeOfTransport: event.target.value })}
                              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
                            >
                              {TRANSPORT_MODES.map((mode) => (
                                <option key={mode} value={mode}>{mode}</option>
                              ))}
                            </select>
                          </label>

                          <label className="text-sm">
                            <span className="mb-1 block text-slate-300">Dispatch Date</span>
                            <input
                              type="date"
                              value={form.dispatchDate}
                              onChange={(event) => updateForm({ dispatchDate: event.target.value })}
                              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
                            />
                          </label>

                          <label className="text-sm">
                            <span className="mb-1 block text-slate-300">Expected Delivery Date</span>
                            <input
                              type="date"
                              value={form.expectedDeliveryDate}
                              onChange={(event) => updateForm({ expectedDeliveryDate: event.target.value })}
                              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
                            />
                          </label>

                          <label className="text-sm md:col-span-2">
                            <span className="mb-1 block text-slate-300">Distance (optional)</span>
                            <input
                              type="number"
                              min="0"
                              value={form.distance}
                              onChange={(event) => updateForm({ distance: event.target.value })}
                              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
                            />
                          </label>
                        </div>
                      </section>
                    </>
                  )}

                  <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <label className="text-sm">
                      <span className="mb-1 block text-slate-300">Notes (optional)</span>
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(event) => updateForm({ notes: event.target.value })}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
                      />
                    </label>
                  </section>
                </div>

                <div className="sticky bottom-0 mt-5 border-t border-slate-800 bg-slate-950/95 py-4 backdrop-blur">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                    >
                      {submitting ? 'Saving...' : form.transferType === 'shipment' ? 'Create Transfer Shipment' : 'Transfer Instantly'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default NewTransferDrawer;
