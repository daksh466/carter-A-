import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';

const toInputDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

export default function ReceiveShipmentModal({
  open,
  shipment,
  onClose,
  onConfirm,
  loading = false,
  error = ''
}) {
  const [receivedBy, setReceivedBy] = useState('');
  const [phone, setPhone] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [showSuccessTick, setShowSuccessTick] = useState(false);

  const defaultReceivedBy = useMemo(() => {
    try {
      return String(localStorage.getItem('lastReceivedBy') || localStorage.getItem('userName') || '').trim();
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setReceivedBy(defaultReceivedBy || '');
    setPhone('');
    setReceivedDate(toInputDateTime(new Date()));
    setNotes('');
    setShowSuccessTick(false);
  }, [open, defaultReceivedBy]);

  if (!open || !shipment) {
    return null;
  }

  const canSubmit = String(receivedBy || '').trim().length > 0 && !loading;

  const handleConfirm = async () => {
    if (!canSubmit) {
      return;
    }

    const payload = {
      received_by: String(receivedBy || '').trim(),
      phone: String(phone || '').trim(),
      received_date: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
      notes: String(notes || '').trim()
    };

    const success = await onConfirm(payload);
    if (success) {
      try {
        localStorage.setItem('lastReceivedBy', payload.received_by);
      } catch {
        // no-op
      }
      setShowSuccessTick(true);
    }
  };

  return (
    <div className="receive-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="receive-modal-title">
      <div className="receive-modal-card">
        <div className="receive-modal-header">
          <div>
            <h3 id="receive-modal-title">Confirm Shipment Receive</h3>
            <p>
              {shipment.fromStoreName || 'Unknown Source'} to {shipment.toStoreName || 'Unknown Destination'}
            </p>
          </div>
          <button type="button" className="receive-modal-close" onClick={onClose} disabled={loading} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="receive-modal-body">
          <label className="receive-modal-field">
            <span>Received By *</span>
            <input
              type="text"
              value={receivedBy}
              onChange={(event) => setReceivedBy(event.target.value)}
              placeholder="Receiver name"
              disabled={loading}
            />
          </label>

          <label className="receive-modal-field">
            <span>Phone</span>
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Optional phone number"
              disabled={loading}
            />
          </label>

          <label className="receive-modal-field">
            <span>Received Date</span>
            <input
              type="datetime-local"
              value={receivedDate}
              onChange={(event) => setReceivedDate(event.target.value)}
              disabled={loading}
            />
          </label>

          <label className="receive-modal-field">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes"
              rows={3}
              disabled={loading}
            />
          </label>

          {error ? <div className="receive-modal-error">{error}</div> : null}
          {showSuccessTick ? (
            <div className="receive-modal-success">
              <CheckCircle2 size={16} />
              <span>Received</span>
            </div>
          ) : null}
        </div>

        <div className="receive-modal-actions">
          <button type="button" className="receive-btn-cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="receive-btn-confirm"
            onClick={handleConfirm}
            disabled={!canSubmit}
            title={String(receivedBy || '').trim() ? 'Confirm shipment receive' : 'Received By is required'}
          >
            {loading ? 'Processing...' : 'Confirm Receive'}
          </button>
        </div>
      </div>
    </div>
  );
}
