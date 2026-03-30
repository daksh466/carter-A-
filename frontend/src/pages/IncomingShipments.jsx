import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import useApp from '../hooks/useApp.js';
import { Truck, AlertTriangle, Plus, PackageCheck, Building2 } from 'lucide-react';
import { getIncomingTransfers, markTransferReceived } from '../services/api';
import IncomingShipmentDrawer from '../components/IncomingShipmentDrawer.jsx';
import ShipmentReceiveModal from '../components/ShipmentReceiveModal.jsx';


const toDateInputValue = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
};

const IncomingShipments = () => {
  const { stores, selectedStore: storeId, setSelectedStore } = useApp();
  const selectedStore = stores.find(s => s.id === storeId);

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeShipment, setActiveShipment] = useState(null);
  const [receiveForm, setReceiveForm] = useState({
    receivedDate: toDateInputValue(new Date()),
    receivedBy: 'Current User',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const fetchIncoming = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getIncomingTransfers(storeId || '');
      if (response.success) {
        setShipments(Array.isArray(response.data) ? response.data : []);
      } else {
        setShipments([]);
        setError(response.error || 'Failed to load incoming shipments');
      }
    } catch (err) {
      setShipments([]);
      setError(err?.message || 'Failed to load incoming shipments');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchIncoming();
  }, [fetchIncoming]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const incomingSummary = useMemo(() => {
    const total = shipments.length;
    const inTransit = shipments.filter((shipment) => String(shipment.status || '').toLowerCase() === 'in_transit').length;
    const completed = shipments.filter((shipment) => ['received', 'completed'].includes(String(shipment.status || '').toLowerCase())).length;
    return { total, inTransit, completed };
  }, [shipments]);

  const openReceiveModal = (shipment) => {
    setActiveShipment(shipment);
    setReceiveForm((prev) => ({ ...prev, receivedDate: toDateInputValue(new Date()) }));
    setReceiveModalOpen(true);
    setError('');
  };

  const handleConfirmReceive = async (event) => {
    event.preventDefault();
    if (!activeShipment?.id) {
      setError('Please choose a shipment to receive.');
      return;
    }

    if (!String(receiveForm.receivedBy || '').trim()) {
      setError('Received By is required.');
      return;
    }

    const shouldProceed = window.confirm('Are you sure you want to mark this shipment as received?');
    if (!shouldProceed) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await markTransferReceived(activeShipment.id, {
        receivedDate: receiveForm.receivedDate,
        receivedBy: receiveForm.receivedBy,
        notes: receiveForm.notes
      });

      if (!response.success) {
        setError(response.error || 'Failed to update inventory while marking shipment as received.');
        return;
      }

      setReceiveModalOpen(false);
      setActiveShipment(null);
      setToast('Shipment received and inventory updated ✅');

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

      await fetchIncoming();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[radial-gradient(circle_at_14%_5%,rgba(59,130,246,0.25),transparent_38%),radial-gradient(circle_at_88%_15%,rgba(168,85,247,0.24),transparent_34%),linear-gradient(150deg,#040815_0%,#0a1533_46%,#1a1134_100%)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <Motion.section
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-[#0d1b44]/95 via-[#1f2158]/90 to-[#3b1a5f]/90 p-6 shadow-xl shadow-black/40 backdrop-blur-xl sm:p-8"
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
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/80">Incoming Logistics</span>
              </div>
              <h1 className="ship-ui-hero-title">Incoming Shipments</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300 sm:text-base">
                Receive stock from stores or external sources with full visibility and controlled confirmation.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Motion.button
                  type="button"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDrawerOpen(true)}
                  className="ship-ui-btn ship-ui-btn-primary px-4 py-2.5 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Incoming
                </Motion.button>
                <Motion.button
                  type="button"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="ship-ui-btn ship-ui-btn-success px-4 py-2.5 text-sm"
                >
                  <PackageCheck className="h-4 w-4" />
                  Receive Queue
                </Motion.button>
              </div>
            </div>

            <Motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.25 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-xl"
            >
              <div className="mb-3 inline-flex items-center gap-2 text-slate-200">
                <Building2 className="h-4 w-4 text-blue-200" />
                <label htmlFor="incoming-store-select" className="text-sm font-semibold">To Store</label>
              </div>
              <select
                id="incoming-store-select"
                value={storeId || ''}
                onChange={(event) => setSelectedStore(event.target.value)}
                className="ship-ui-input w-full rounded-xl px-4 py-3 text-sm font-semibold"
              >
                <option value="">Search or select store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                {selectedStore?.name ? (
                  <span className="font-medium text-emerald-200">📍 Viewing: {selectedStore.name}</span>
                ) : (
                  <span className="font-medium text-amber-200">⚠️ No store selected</span>
                )}
              </div>
            </Motion.div>
          </div>
        </Motion.section>

        {error && (
          <Motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </Motion.div>
        )}

        {storeId && (
          <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-sky-300/25 bg-gradient-to-br from-sky-500/20 to-sky-800/20 p-4 shadow-[0_14px_35px_rgba(2,18,45,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-100/80">Total Incoming</p>
              <p className="ship-ui-kpi-value">{incomingSummary.total}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-500/20 to-amber-800/20 p-4 shadow-[0_14px_35px_rgba(45,30,2,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100/80">In Transit</p>
              <p className="ship-ui-kpi-value">{incomingSummary.inTransit}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-500/20 to-emerald-800/20 p-4 shadow-[0_14px_35px_rgba(2,24,28,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100/80">Received</p>
              <p className="ship-ui-kpi-value">{incomingSummary.completed}</p>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="ship-ui-section-title">Incoming Shipments Queue</h2>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="ship-ui-btn ship-ui-btn-primary px-3 py-2 text-xs"
            >
              New Incoming
            </button>
          </div>

          {!storeId ? (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center">
              <p className="text-xl font-bold text-white">No Store Selected</p>
              <p className="text-sm text-slate-300">Select a store to view incoming shipments.</p>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              <div className="h-16 animate-pulse rounded-xl bg-slate-200/10" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-200/10" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-200/10" />
            </div>
          ) : shipments.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-slate-300">
              No incoming shipments found for this store.
            </div>
          ) : (
            <div className="grid gap-3">
              {shipments.slice(0, 8).map((shipment) => (
                <div key={shipment.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{shipment.fromStoreName || shipment.fromExternalName || 'Source'}</p>
                      <p className="text-xs text-slate-300">
                        Dispatch: {shipment.dispatchDate ? new Date(shipment.dispatchDate).toLocaleDateString() : '-'} | Expected: {shipment.expectedDeliveryDate ? new Date(shipment.expectedDeliveryDate).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                        {shipment.status || 'in_transit'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openReceiveModal(shipment)}
                        className="ship-ui-btn ship-ui-btn-success px-3 py-1.5 text-xs"
                      >
                        Receive
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ShipmentReceiveModal
        isOpen={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        formId="incoming-receive-form"
        title="Receive Shipment"
        subtitle="Confirm shipment receipt to update inventory."
        summaryTitle={activeShipment?.toStoreName || 'Destination Store'}
        summaryItems={(activeShipment?.items || []).map((item) => item.itemName || item.sparePartName).join(', ') || 'Shipment items'}
        receivedBy={receiveForm.receivedBy}
        onReceivedByChange={(value) => setReceiveForm((prev) => ({ ...prev, receivedBy: value }))}
        receivedDate={receiveForm.receivedDate}
        onReceivedDateChange={(value) => setReceiveForm((prev) => ({ ...prev, receivedDate: value }))}
        notes={receiveForm.notes}
        onNotesChange={(value) => setReceiveForm((prev) => ({ ...prev, notes: value }))}
        onSubmit={handleConfirmReceive}
        submitting={submitting}
        submitLabel="Confirm Receive"
        error={error}
      />

      <IncomingShipmentDrawer 
        isOpen={drawerOpen}
        stores={stores}
        defaultToStore={storeId}
        onClose={() => setDrawerOpen(false)}
        onSuccess={fetchIncoming}
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

export default IncomingShipments;
