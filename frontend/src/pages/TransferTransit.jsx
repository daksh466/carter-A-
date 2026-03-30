import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { ArrowLeftRight, CheckCircle2, Clock3, PackageCheck } from 'lucide-react';
import useApp from '../hooks/useApp';
import { getTransfers, markTransferReceived } from '../services/api';
import ShipmentReceiveModal from '../components/ShipmentReceiveModal.jsx';

const toDateInputValue = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
};

const TransferTransit = () => {
  const navigate = useNavigate();
  const { stores, selectedStore, setSelectedStore } = useApp();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [transfers, setTransfers] = useState([]);
  const [activeTransfer, setActiveTransfer] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmForm, setConfirmForm] = useState({
    confirmerName: '',
    confirmationDate: toDateInputValue(new Date()),
    notes: ''
  });

  const fetchInTransitTransfers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = {
        type: 'internal',
        status: 'in_transit',
        limit: 100
      };
      if (selectedStore) {
        query.storeId = selectedStore;
      }

      const response = await getTransfers(query);
      if (!response.success) {
        setTransfers([]);
        setError(response.error || 'Failed to load in-transit transfers.');
        return;
      }

      setTransfers(Array.isArray(response.data) ? response.data : []);
    } catch (fetchError) {
      setTransfers([]);
      setError(fetchError?.message || 'Failed to load in-transit transfers.');
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    fetchInTransitTransfers();
  }, [fetchInTransitTransfers]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    const total = transfers.length;
    const totalItems = transfers.reduce((sum, transfer) => sum + Number(transfer.totalItems || transfer.items?.length || 0), 0);
    const destinations = new Set(transfers.map((transfer) => transfer.toStoreId).filter(Boolean)).size;
    return { total, totalItems, destinations };
  }, [transfers]);

  const openConfirmation = (transfer) => {
    setActiveTransfer(transfer);
    setConfirmForm({
      confirmerName: '',
      confirmationDate: toDateInputValue(new Date()),
      notes: ''
    });
    setError('');
    setConfirmOpen(true);
  };

  const handleConfirm = async (event) => {
    event.preventDefault();
    if (!activeTransfer?.id) {
      setError('Please choose a transfer to confirm.');
      return;
    }

    const confirmerName = String(confirmForm.confirmerName || '').trim();
    if (!confirmerName) {
      setError('Confirmer name is required.');
      return;
    }

    if (!confirmForm.confirmationDate) {
      setError('Confirmation date is required.');
      return;
    }

    const shouldProceed = window.confirm('Confirm this transfer now? Destination inventory will be updated.');
    if (!shouldProceed) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await markTransferReceived(activeTransfer.id, {
        confirmationBy: confirmerName,
        confirmationDate: confirmForm.confirmationDate,
        receivedBy: confirmerName,
        receivedDate: confirmForm.confirmationDate,
        notes: confirmForm.notes
      });

      if (!response.success) {
        setError(response.error || 'Failed to confirm transfer.');
        return;
      }

      setConfirmOpen(false);
      setActiveTransfer(null);
      setToast('Transfer confirmed and destination inventory updated.');

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
            transferId: response.data?.id,
            status: response.data?.status || 'received',
            updatedAt: Date.now()
          }
        })
      );

      await fetchInTransitTransfers();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-[radial-gradient(circle_at_8%_8%,rgba(34,197,94,0.2),transparent_34%),radial-gradient(circle_at_90%_16%,rgba(20,184,166,0.26),transparent_30%),linear-gradient(145deg,#f8fbff_0%,#f0fdfa_42%,#ecfeff_100%)] px-4 py-6 sm:px-7"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-3xl border border-emerald-200/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(13,148,136,0.12)] backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Transfer Transit Desk</h1>
              <p className="mt-1 text-sm text-slate-600">
                Confirm in-transit transfers. Stock was already deducted at source and will be credited to destination only after confirmation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard/transfers')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back To Transfers
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">In Transit</p>
              <p className="mt-1 text-2xl font-black text-emerald-900">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Item Lines</p>
              <p className="mt-1 text-2xl font-black text-cyan-900">{stats.totalItems}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Destinations</p>
              <p className="mt-1 text-2xl font-black text-amber-900">{stats.destinations}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <label htmlFor="transit-store-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store Filter</label>
              <select
                id="transit-store-filter"
                value={selectedStore || ''}
                onChange={(event) => setSelectedStore(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                <option value="">All stores</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Items</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Dispatch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">ETA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Loading in-transit transfers...</td>
                  </tr>
                )}

                {!loading && transfers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      No in-transit transfers found for this filter.
                    </td>
                  </tr>
                )}

                {!loading && transfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <ArrowLeftRight className="h-4 w-4 text-teal-600" />
                        {transfer.fromStoreName || 'Unknown Source'} to {transfer.toStoreName || 'Unknown Destination'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {(transfer.items || []).map((item) => `${item.itemName || item.sparePartName} x${item.quantity}`).join(', ') || 'No items'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{transfer.dispatchDate ? new Date(transfer.dispatchDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{transfer.expectedDeliveryDate ? new Date(transfer.expectedDeliveryDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        <Clock3 className="h-3.5 w-3.5" />
                        In Transit
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openConfirmation(transfer)}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-300/40 transition hover:brightness-105"
                      >
                        <PackageCheck className="h-4 w-4" />
                        Confirm Arrival
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ShipmentReceiveModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        formId="transfer-transit-confirm-form"
        title="Confirm Transfer Arrival"
        subtitle="Destination inventory will be credited only after this confirmation."
        summaryTitle={activeTransfer ? `${activeTransfer.fromStoreName || 'Source'} to ${activeTransfer.toStoreName || 'Destination'}` : 'Transfer'}
        summaryItems={(activeTransfer?.items || []).map((item) => item.itemName || item.sparePartName).join(', ') || 'Transfer items'}
        receivedBy={confirmForm.confirmerName}
        onReceivedByChange={(value) => setConfirmForm((prev) => ({ ...prev, confirmerName: value }))}
        receivedDate={confirmForm.confirmationDate}
        onReceivedDateChange={(value) => setConfirmForm((prev) => ({ ...prev, confirmationDate: value }))}
        notes={confirmForm.notes}
        onNotesChange={(value) => setConfirmForm((prev) => ({ ...prev, notes: value }))}
        onSubmit={handleConfirm}
        submitting={submitting}
        submitLabel="Confirm And Receive"
        submittingLabel="Confirming transfer..."
        receivedByLabel="Confirmer Name"
        receivedDateLabel="Confirmation Date"
        notesLabel="Confirmation Notes (optional)"
        error={error}
      />

      <AnimatePresence>
        {toast && (
          <Motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed right-4 top-4 z-[100] inline-flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-400/50 sm:right-6 sm:top-6"
          >
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
};

export default TransferTransit;
