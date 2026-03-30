import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import useApp from '../hooks/useApp';
import { createTransfer, getSpareParts, getTransfers, markTransferReceived } from '../services/api';
import ShipmentReceiveModal from '../components/ShipmentReceiveModal.jsx';
import { Truck, Building2, Send, Package } from 'lucide-react';

const toDateInputValue = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
};

const OutgoingShipments = () => {
  const { stores, selectedStore, setSelectedStore } = useApp();

  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [activeShipment, setActiveShipment] = useState(null);
  const [confirmForm, setConfirmForm] = useState({
    receivedBy: 'Current User',
    receivedDate: toDateInputValue(new Date()),
    notes: 'Delivered to customer and confirmed'
  });

  const [form, setForm] = useState({
    destinationName: '',
    approvedBy: '',
    approvedDate: toDateInputValue(new Date()),
    driverName: '',
    driverPhone: '',
    driverId: '',
    modeOfTransport: 'Truck',
    dispatchDate: toDateInputValue(new Date()),
    expectedDeliveryDate: '',
    notes: ''
  });

  const [rows, setRows] = useState([{ itemId: '', quantity: '' }]);
  const [inTransit, setInTransit] = useState([]);

  const fromStore = selectedStore || stores?.[0]?.id || '';
  const activeStoreName = stores.find((store) => store.id === fromStore)?.name || '';

  const selectedItems = useMemo(() => {
    return rows
      .map((row) => {
        const part = inventory.find((item) => item.id === row.itemId);
        return {
          part,
          quantity: Number(row.quantity)
        };
      })
      .filter((entry) => entry.part && Number.isInteger(entry.quantity) && entry.quantity > 0);
  }, [rows, inventory]);

  const outgoingSummary = useMemo(() => {
    const inTransitCount = inTransit.length;
    const uniqueDestinations = new Set(
      inTransit.map((shipment) => String(shipment.toExternalName || shipment.toStoreName || '').trim()).filter(Boolean)
    ).size;
    const openLineItems = inTransit.reduce((sum, shipment) => sum + Number(Array.isArray(shipment.items) ? shipment.items.length : 0), 0);
    return {
      inTransitCount,
      uniqueDestinations,
      openLineItems,
      availableSkus: inventory.length,
    };
  }, [inTransit, inventory]);

  const fetchInventory = async () => {
    if (!fromStore) {
      setInventory([]);
      return;
    }

    setInventoryLoading(true);
    try {
      const response = await getSpareParts({ storeId: fromStore });
      setInventory(response.success ? response.data : []);
    } finally {
      setInventoryLoading(false);
    }
  };

  const fetchInTransit = async () => {
    const response = await getTransfers({
      storeId: fromStore || undefined,
      status: 'in_transit',
      type: 'outgoing'
    });

    if (!response.success) {
      setInTransit([]);
      return;
    }

    const outgoingRows = Array.isArray(response.data)
      ? response.data.filter((shipment) => String(shipment?.type || '').toLowerCase() === 'outgoing')
      : [];

    setInTransit(outgoingRows);
  };

  useEffect(() => {
    fetchInventory();
    fetchInTransit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromStore]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(''), 2300);
    return () => clearTimeout(timer);
  }, [toast]);

  const setRowValue = (index, patch) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addRow = () => setRows((prev) => [...prev, { itemId: '', quantity: '' }]);

  const removeRow = (index) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const validateForm = () => {
    if (!fromStore) return 'Please select source store';
    if (!form.destinationName.trim()) return 'Customer / destination name is required';
    if (!form.approvedBy.trim()) return 'Approved by is required';
    if (!form.approvedDate) return 'Approved date is required';
    if (!form.driverName.trim() || !form.driverPhone.trim() || !form.driverId.trim()) return 'Driver details are required';
    if (!form.expectedDeliveryDate) return 'Expected delivery date is required';
    if (selectedItems.length === 0) return 'Add at least one outgoing item';

    for (const entry of selectedItems) {
      const available = Number(entry.part?.quantity || 0);
      if (entry.quantity > available) {
        return `Quantity for ${entry.part.name} exceeds available stock (${available})`;
      }
    }

    return '';
  };

  const handleCreateOutgoing = async (event) => {
    event.preventDefault();
    const validationMessage = validateForm();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const fromStoreName = stores.find((store) => store.id === fromStore)?.name || 'Unknown Store';
      const payload = {
        type: 'outgoing',
        from_store_id: fromStore,
        from_store_name: fromStoreName,
        to_store_id: '',
        to_store_name: form.destinationName.trim(),
        to_external_name: form.destinationName.trim(),
        approved_by: form.approvedBy.trim(),
        approved_date: form.approvedDate,
        driver: {
          name: form.driverName.trim(),
          phone: form.driverPhone.trim(),
          driverId: form.driverId.trim()
        },
        modeOfTransport: form.modeOfTransport,
        dispatchDate: form.dispatchDate,
        expectedDeliveryDate: form.expectedDeliveryDate,
        status: 'in_transit',
        notes: form.notes,
        items: selectedItems.map((entry) => ({
          spare_part_id: entry.part.id,
          itemId: entry.part.id,
          itemName: entry.part.name,
          quantity: entry.quantity
        }))
      };

      const response = await createTransfer(payload);
      if (!response.success) {
        setError(response.error || 'Failed to create outgoing shipment');
        return;
      }

      setToast('Outgoing shipment created');
      setRows([{ itemId: '', quantity: '' }]);
      setForm((prev) => ({
        ...prev,
        destinationName: '',
        approvedBy: '',
        approvedDate: toDateInputValue(new Date()),
        driverName: '',
        driverPhone: '',
        driverId: '',
        expectedDeliveryDate: '',
        notes: ''
      }));

      await Promise.all([fetchInventory(), fetchInTransit()]);
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirmModal = (shipment) => {
    setActiveShipment(shipment);
    setConfirmForm({
      receivedBy: 'Current User',
      receivedDate: toDateInputValue(new Date()),
      notes: 'Delivered to customer and confirmed'
    });
    setConfirmModalOpen(true);
    setError('');
  };

  const handleConfirmDelivered = async (event) => {
    event.preventDefault();

    if (!activeShipment?.id) {
      return;
    }

    if (!String(confirmForm.receivedBy || '').trim()) {
      setError('Received By is required.');
      return;
    }

    const shouldProceed = window.confirm('Are you sure you want to confirm this delivery as received?');
    if (!shouldProceed) {
      return;
    }

    setConfirming(true);
    setError('');
    try {
      const response = await markTransferReceived(activeShipment.id, {
        receivedDate: confirmForm.receivedDate,
        receivedBy: confirmForm.receivedBy,
        notes: confirmForm.notes
      });

      if (!response.success) {
        setError(response.error || 'Unable to confirm delivery');
        return;
      }

      setConfirmModalOpen(false);
      setActiveShipment(null);
      setToast('Delivery confirmed');

      window.dispatchEvent(
        new CustomEvent('inventory:updated', {
          detail: {
            storeIds: [response.data?.toStoreId].filter(Boolean),
            updatedAt: Date.now()
          }
        })
      );

      window.dispatchEvent(
        new CustomEvent('transfers:updated', {
          detail: {
            transferId: response.data?.id || activeShipment.id,
            status: response.data?.status || 'completed',
            updatedAt: Date.now()
          }
        })
      );

      await fetchInTransit();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,rgba(59,130,246,0.24),transparent_36%),radial-gradient(circle_at_85%_12%,rgba(168,85,247,0.2),transparent_34%),linear-gradient(150deg,#040815_0%,#0a1533_46%,#1a1134_100%)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="space-y-10">
          <Motion.section
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28 }}
            className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-[#0d1b44]/95 via-[#1f2158]/90 to-[#3b1a5f]/90 p-6 shadow-xl shadow-black/40 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl sm:p-8"
          >
            <div className="pointer-events-none absolute -left-16 -top-10 h-44 w-44 rounded-full bg-blue-400/30 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-6 h-40 w-40 rounded-full bg-purple-400/25 blur-3xl" />

            <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-4">
                  <div className="ship-ui-hero-icon-wrap">
                    <div className="ship-ui-hero-icon-glow" />
                    <Truck className="ship-ui-hero-icon" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/80">Outgoing Logistics</span>
                </div>

                <h1 className="ship-ui-hero-title">Outgoing Shipments</h1>
                <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300 sm:text-base">
                  Create outgoing deliveries with approvals, track customer-bound shipments, and confirm final delivery.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Motion.button
                    type="button"
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="ship-ui-btn ship-ui-btn-primary px-4 py-2.5 text-sm"
                  >
                    <Package className="h-4 w-4" />
                    Shipment Builder
                  </Motion.button>
                  <Motion.button
                    type="button"
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="ship-ui-btn ship-ui-btn-success px-4 py-2.5 text-sm"
                  >
                    <Send className="h-4 w-4" />
                    Delivery Pipeline
                  </Motion.button>
                </div>
              </div>

              <Motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05, duration: 0.25 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <div className="mb-3 inline-flex items-center gap-2 text-slate-200">
                  <Building2 className="h-4 w-4 text-blue-200" />
                  <label htmlFor="outgoing-store-select" className="text-sm font-semibold">From Store</label>
                </div>

                <select
                  id="outgoing-store-select"
                  value={fromStore}
                  onChange={(event) => setSelectedStore(event.target.value)}
                  className="ship-ui-input w-full px-3 py-3 text-sm font-semibold"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>

                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  {activeStoreName ? (
                    <span className="font-medium text-emerald-200">📍 Viewing: {activeStoreName}</span>
                  ) : (
                    <span className="font-medium text-amber-200">⚠️ No store selected</span>
                  )}
                </div>
              </Motion.div>
            </div>
          </Motion.section>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-sky-300/25 bg-gradient-to-br from-sky-500/20 to-sky-800/20 p-4 shadow-[0_14px_35px_rgba(2,18,45,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-100/80">In Transit</p>
              <p className="ship-ui-kpi-value">{outgoingSummary.inTransitCount}</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-800/20 p-4 shadow-[0_14px_35px_rgba(37,14,53,0.34)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-100/80">Destinations</p>
              <p className="ship-ui-kpi-value">{outgoingSummary.uniqueDestinations}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-500/20 to-amber-800/20 p-4 shadow-[0_14px_35px_rgba(45,30,2,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100/80">Open Line Items</p>
              <p className="ship-ui-kpi-value">{outgoingSummary.openLineItems}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-500/20 to-emerald-800/20 p-4 shadow-[0_14px_35px_rgba(2,24,28,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100/80">Available SKUs</p>
              <p className="ship-ui-kpi-value">{outgoingSummary.availableSkus}</p>
            </div>
          </section>

          {error && (
            <Motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-red-400/25 bg-red-500/10 px-5 py-4 text-red-200 shadow-xl backdrop-blur-xl"
            >
              {error}
            </Motion.div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <Motion.form
              onSubmit={handleCreateOutgoing}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:shadow-2xl sm:p-6"
            >
              <h2 className="ship-ui-section-title">Create Outgoing Order</h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300 sm:col-span-2">
                  Customer / Destination Name
                  <input
                    type="text"
                    value={form.destinationName}
                    onChange={(event) => setForm((prev) => ({ ...prev, destinationName: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Approved By
                  <input
                    type="text"
                    value={form.approvedBy}
                    onChange={(event) => setForm((prev) => ({ ...prev, approvedBy: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Approved Date
                  <input
                    type="date"
                    value={form.approvedDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, approvedDate: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Driver Name
                  <input
                    type="text"
                    value={form.driverName}
                    onChange={(event) => setForm((prev) => ({ ...prev, driverName: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Driver Phone
                  <input
                    type="text"
                    value={form.driverPhone}
                    onChange={(event) => setForm((prev) => ({ ...prev, driverPhone: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Driver ID
                  <input
                    type="text"
                    value={form.driverId}
                    onChange={(event) => setForm((prev) => ({ ...prev, driverId: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Mode of Transport
                  <input
                    type="text"
                    value={form.modeOfTransport}
                    onChange={(event) => setForm((prev) => ({ ...prev, modeOfTransport: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Dispatch Date
                  <input
                    type="date"
                    value={form.dispatchDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, dispatchDate: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Expected Delivery Date
                  <input
                    type="date"
                    value={form.expectedDeliveryDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, expectedDeliveryDate: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300 sm:col-span-2">
                  Notes (Optional)
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                  />
                </label>
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Items</h3>
                  <button
                    type="button"
                    onClick={addRow}
                    className="ship-ui-btn ship-ui-btn-primary px-3 py-1.5 text-xs"
                  >
                    Add Item
                  </button>
                </div>

                {inventoryLoading ? (
                  <div className="text-sm text-slate-300">Loading inventory...</div>
                ) : rows.map((row, index) => (
                  <div key={`out-row-${index}`} className="mb-2 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                    <select
                      value={row.itemId}
                      onChange={(event) => setRowValue(index, { itemId: event.target.value })}
                      className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                    >
                      <option value="">Select item</option>
                      {inventory.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} (Available: {item.quantity})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(event) => setRowValue(index, { quantity: event.target.value })}
                      placeholder="Qty"
                      className="rounded-lg border border-white/20 bg-slate-900/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-300/70 focus:ring-2 focus:ring-blue-300/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="ship-ui-btn px-3 py-2 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <Motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={submitting}
                  className="ship-ui-btn ship-ui-btn-primary px-4 py-2.5 text-sm disabled:opacity-70"
                >
                  {submitting ? 'Creating...' : 'Create Outgoing Order'}
                </Motion.button>
              </div>
            </Motion.form>

            <Motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:shadow-2xl sm:p-6"
            >
              <h2 className="ship-ui-section-title">In-Transit Outgoing Orders</h2>
              {inTransit.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-3xl">🚚</div>
                  <p className="text-sm text-slate-300">No outgoing orders in transit.</p>
                  <p className="mt-2 text-xs text-slate-400">Use the form to create and dispatch a new outgoing order.</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {inTransit.map((shipment) => (
                    <div key={shipment.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
                      <div className="text-sm font-bold text-white">{shipment.toExternalName || shipment.toStoreName || 'Customer'}</div>
                      <div className="mt-2 text-xs text-slate-300">
                        Approved by: {shipment.approvedBy || '-'} | Approved date: {shipment.approvedDate ? new Date(shipment.approvedDate).toLocaleDateString() : '-'}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Expected: {shipment.expectedDeliveryDate ? new Date(shipment.expectedDeliveryDate).toLocaleDateString() : '-'}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Motion.button
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() => openConfirmModal(shipment)}
                          className="ship-ui-btn ship-ui-btn-success px-3 py-1.5 text-xs"
                        >
                          Confirm Delivered
                        </Motion.button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Future Graph Section</p>
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/20" />
                  <div className="h-24 animate-pulse rounded-xl bg-slate-200/10" />
                </div>
              </div>
            </Motion.section>
          </div>
        </div>
      </div>

      <ShipmentReceiveModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        formId="outgoing-receive-form"
        title="Confirm Delivery"
        subtitle="Mark this outgoing shipment as received by the customer."
        summaryTitle={activeShipment?.toExternalName || activeShipment?.toStoreName || 'Customer'}
        summaryItems={(activeShipment?.items || []).map((item) => item.itemName || item.sparePartName).join(', ') || 'Shipment items'}
        receivedBy={confirmForm.receivedBy}
        onReceivedByChange={(value) => setConfirmForm((prev) => ({ ...prev, receivedBy: value }))}
        receivedDate={confirmForm.receivedDate}
        onReceivedDateChange={(value) => setConfirmForm((prev) => ({ ...prev, receivedDate: value }))}
        notes={confirmForm.notes}
        onNotesChange={(value) => setConfirmForm((prev) => ({ ...prev, notes: value }))}
        onSubmit={handleConfirmDelivered}
        submitting={confirming}
        submitLabel="Confirm Delivered"
        error={error}
      />

      <AnimatePresence>
        {toast && (
          <Motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed right-4 top-4 z-[100] rounded-xl border border-emerald-300/30 bg-emerald-500/90 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-500/40 backdrop-blur-xl sm:right-6 sm:top-6"
          >
            {toast}
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
};

export default OutgoingShipments;
