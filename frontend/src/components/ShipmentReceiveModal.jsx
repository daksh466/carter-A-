import React from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';

const ShipmentReceiveModal = ({
  isOpen,
  onClose,
  formId,
  title,
  subtitle,
  summaryTitle,
  summaryItems,
  receivedBy,
  onReceivedByChange,
  receivedDate,
  onReceivedDateChange,
  notes,
  onNotesChange,
  onSubmit,
  submitting,
  submitLabel,
  submittingLabel,
  error,
  receivedByLabel = 'Received By',
  receivedDateLabel = 'Received Date',
  notesLabel = 'Notes (optional)',
  shipmentOptions = [],
  selectedShipmentId = '',
  onSelectedShipmentChange
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <Motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-3"
            onClick={onClose}
          >
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl transition-colors duration-300 dark:border-sky-200/20 dark:bg-[radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.16),transparent_36%),linear-gradient(160deg,#08152d_0%,#0b1d3c_55%,#0a1730_100%)]" onClick={(event) => event.stopPropagation()}>
              <form id={formId} onSubmit={onSubmit} className="flex max-h-[90vh] flex-col">
                <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 px-6 py-4 backdrop-blur transition-colors duration-300 dark:border-sky-200/20 dark:bg-slate-950/45">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{subtitle}</p>
                </div>

                <div className="max-h-[90vh] overflow-y-auto px-6 py-4">
                  <div className="space-y-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 transition-colors duration-300 dark:border-sky-300/20 dark:bg-slate-900/35 dark:text-slate-200">
                      <div className="font-semibold text-gray-900 dark:text-white">{summaryTitle || 'Shipment'}</div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">{summaryItems || 'Shipment items'}</div>
                    </div>

                    {shipmentOptions.length > 0 && onSelectedShipmentChange && (
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Select Shipment</span>
                        <select
                          value={selectedShipmentId}
                          onChange={(event) => onSelectedShipmentChange(event.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-sky-300/20 dark:bg-slate-900/45 dark:text-slate-100 dark:focus:border-sky-300/60"
                        >
                          <option value="">Select a shipment</option>
                          {shipmentOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{receivedByLabel}</span>
                      <input
                        type="text"
                        value={receivedBy}
                        onChange={(event) => onReceivedByChange(event.target.value)}
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-sky-300/20 dark:bg-slate-900/45 dark:text-slate-100 dark:focus:border-sky-300/60"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{receivedDateLabel}</span>
                      <input
                        type="date"
                        value={receivedDate}
                        onChange={(event) => onReceivedDateChange(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-sky-300/20 dark:bg-slate-900/45 dark:text-slate-100 dark:focus:border-sky-300/60"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{notesLabel}</span>
                      <textarea
                        value={notes}
                        onChange={(event) => onNotesChange(event.target.value)}
                        rows={3}
                        className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-sky-300/20 dark:bg-slate-900/45 dark:text-slate-100 dark:focus:border-sky-300/60"
                      />
                    </label>

                    {error && (
                      <div className="rounded-lg border border-rose-400/40 bg-rose-900/35 px-3 py-2 text-sm text-rose-100">
                        {error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-gray-200 bg-white/90 px-6 py-4 backdrop-blur transition-colors duration-300 dark:border-sky-200/20 dark:bg-slate-950/55">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-sky-300/30 bg-slate-900/45 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-sky-500/15"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form={formId}
                    disabled={submitting}
                    className="rounded-lg border border-sky-200/30 bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(2,132,199,0.42)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (submittingLabel || 'Marking as received...') : submitLabel}
                  </button>
                </div>
              </form>
            </div>
          </Motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShipmentReceiveModal;
