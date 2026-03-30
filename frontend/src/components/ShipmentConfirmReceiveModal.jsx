import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { X, Check, Truck } from 'lucide-react';
import { markTransferReceived } from '../services/api';

export default function ShipmentConfirmReceiveModal({
  isOpen,
  shipment,
  onClose,
  onSuccess
}) {
  const [approverName, setApproverName] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const transferType = String(shipment?.type || '').toLowerCase();
  const isOutgoing = transferType === 'outgoing';
  const modalTitle = isOutgoing ? 'Confirm Shipment Arrival' : 'Confirm Shipment Receipt';
  const modalSubtitle = isOutgoing
    ? 'Confirm this outgoing shipment has reached destination before inventory is credited there.'
    : 'Confirm this shipment has been received so destination inventory can be updated.';
  const confirmationLabel = isOutgoing
    ? 'I confirm this shipment has reached the destination store/customer.'
    : 'I confirm the destination store has received this shipment.';
  const submitLabel = isOutgoing ? 'Confirm Arrival' : 'Confirm Receipt';

  useEffect(() => {
    if (!isOpen) {
      setApproverName('');
      setNotes('');
      setConfirmationChecked(false);
      setError('');
    }
  }, [isOpen]);

  const handleConfirm = async (event) => {
    event.preventDefault();
    
    if (!approverName.trim()) {
      setError('Approver name is required');
      return;
    }

    if (!shipment?.id) {
      setError('Invalid shipment');
      return;
    }

    if (!confirmationChecked) {
      setError('Please confirm shipment arrival before submitting.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await markTransferReceived(shipment.id, {
        receivedBy: approverName.trim(),
        approved_by: approverName.trim(),
        notes: notes.trim()
      });

      if (!response.success) {
        setError(response.error || 'Failed to mark shipment as received');
        return;
      }

      onSuccess?.();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !approverName.trim() || !confirmationChecked || loading;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          <Motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 shadow-2xl">
              <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{modalTitle}</h2>
                  <p className="mt-1 text-xs text-slate-300">{modalSubtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleConfirm} className="space-y-5 p-6">
                {error && (
                  <div className="rounded-xl border border-rose-500/60 bg-rose-900/30 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-100">
                    Shipment Details
                  </label>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">From:</span>
                      <span className="font-medium text-white">{shipment?.fromStoreName || 'External'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">To:</span>
                      <span className="font-medium text-white">{shipment?.toStoreName || shipment?.toExternalName || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Items:</span>
                      <span className="font-medium text-white">{shipment?.items?.length || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Total Quantity:</span>
                      <span className="font-medium text-white">
                        {(shipment?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
                      </span>
                    </div>
                    <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                      <div className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5" />
                        Destination inventory will update only after this confirmation.
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-100">
                    Confirmed By <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    placeholder="Enter your name"
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                  <input
                    type="checkbox"
                    checked={confirmationChecked}
                    onChange={(event) => setConfirmationChecked(event.target.checked)}
                    disabled={loading}
                    className="mt-0.5 h-4 w-4 rounded border-white/30 bg-white/10"
                  />
                  <span>{confirmationLabel}</span>
                </label>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-100">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes..."
                    disabled={loading}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-white placeholder-slate-400 resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 font-semibold text-white transition-all duration-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDisabled}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-emerald-500/50 hover:scale-105 disabled:scale-100 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {loading ? 'Processing...' : submitLabel}
                  </button>
                </div>
              </form>
            </div>
          </Motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
