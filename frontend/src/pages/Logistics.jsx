import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useApp from '../hooks/useApp';
import { getTransfers } from '../services/api';
import IncomingShipmentDrawer from '../components/IncomingShipmentDrawer';
import OutgoingShipmentDrawer from '../components/OutgoingShipmentDrawer';
import ShipmentConfirmReceiveModal from '../components/ShipmentConfirmReceiveModal';
import './erp.css';

const sanitizeItemName = (transfer = {}) => {
  const names = (transfer.items || [])
    .map((item) => item.itemName || item.sparePartName || item.item_name || item.spare_part_name || '')
    .filter(Boolean);
  return names.slice(0, 2).join(', ') || 'Items';
};

const mapShipmentStatus = (transfer = {}) => {
  const status = String(transfer.status || '').toLowerCase();
  if (status === 'received' || status === 'completed') return { label: 'Received', icon: '✔️', tone: 'green' };
  if (status === 'in_transit') return { label: 'In Transit', icon: '🚚', tone: 'blue' };
  if (status === 'cancelled') return { label: 'Out of Stock', icon: '❌', tone: 'red' };
  if (status === 'pending') return { label: 'Low Stock', icon: '⚠️', tone: 'orange' };
  return { label: 'In Stock', icon: '✅', tone: 'gray' };
};

const Logistics = () => {
  const navigate = useNavigate();
  const { stores, darkMode, toggleTheme } = useApp();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState([]);
  const [activeStoreId, setActiveStoreId] = useState('');
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [filters, setFilters] = useState({ category: '', stockStatus: '', importance: '' });
  const [selectedTransferId, setSelectedTransferId] = useState('');
  const [expandedTransferId, setExpandedTransferId] = useState('');
  const [incomingDrawerOpen, setIncomingDrawerOpen] = useState(false);
  const [outgoingDrawerOpen, setOutgoingDrawerOpen] = useState(false);
  const [confirmReceiveModalOpen, setConfirmReceiveModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [toast, setToast] = useState('');

  const savedFilters = ['Low Stock', 'Critical Items', 'In Transit'];
  const suggestions = ['low stock bearing', 'incoming last 7 days', 'store: delhi'];

  const loadTransfers = useCallback(async () => {
    if (!activeStoreId) {
      setTransfers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await getTransfers({ storeId: activeStoreId });
      setTransfers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load shipments:', error);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const key = String(event.key || '').toLowerCase();
      if (key === 'i') setIncomingDrawerOpen(true);
      if (key === 'o') setOutgoingDrawerOpen(true);
      if (key === 'r' && selectedShipment) setConfirmReceiveModalOpen(true);
      if (key === 't') navigate('/dashboard/transfers');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, selectedShipment]);

  const getDirection = useCallback((transfer) => {
    const transferType = String(transfer?.type || '').toLowerCase();
    if (transferType === 'incoming') return 'Incoming';
    if (transferType === 'outgoing') return 'Outgoing';
    if (String(transfer.toStoreId) === String(activeStoreId)) return 'Incoming';
    if (String(transfer.fromStoreId) === String(activeStoreId)) return 'Outgoing';
    return 'Internal';
  }, [activeStoreId]);

  const rows = useMemo(() => {
    return transfers
      .map((transfer) => {
        const totalQty = (transfer.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        return {
          ...transfer,
          itemName: sanitizeItemName(transfer),
          totalQty,
          direction: getDirection(transfer),
          statusMeta: mapShipmentStatus(transfer),
        };
      })
      .sort((a, b) => new Date(b.dispatchDate || b.createdAt || 0).getTime() - new Date(a.dispatchDate || a.createdAt || 0).getTime());
  }, [transfers, getDirection]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      const searchText = `${row.itemName} ${row.fromStoreName || ''} ${row.toStoreName || ''} ${row.modeOfTransport || ''}`.toLowerCase();
      const searchOk = !q
        || searchText.includes(q)
        || (q.includes('incoming') && row.direction === 'Incoming')
        || (q.includes('last 7 days') && (Date.now() - new Date(row.dispatchDate || row.createdAt || 0).getTime()) < 7 * 24 * 60 * 60 * 1000);

      const categoryOk = !filters.category || row.direction === filters.category;
      const statusOk = !filters.stockStatus || row.statusMeta.label === filters.stockStatus;
      const importanceOk = !filters.importance
        || (filters.importance === 'High' ? row.totalQty >= 20 : row.totalQty < 20);
      const quickOk = !quickFilter
        || (quickFilter === 'Low Stock' && row.statusMeta.label === 'Low Stock')
        || (quickFilter === 'Critical Items' && row.statusMeta.label === 'Out of Stock')
        || (quickFilter === 'In Transit' && row.statusMeta.label === 'In Transit');

      return searchOk && categoryOk && statusOk && importanceOk && quickOk;
    });
  }, [rows, search, filters, quickFilter]);

  const selectedTransfer = useMemo(
    () => filteredRows.find((row) => String(row.id) === String(selectedTransferId)) || null,
    [filteredRows, selectedTransferId]
  );

  const insights = useMemo(() => ({
    topUsed: filteredRows[0]?.itemName || '-',
    mostTransferred: filteredRows[1]?.itemName || '-',
    lowStock: filteredRows.filter((row) => row.statusMeta.label === 'Low Stock').length,
    deadStock: filteredRows.filter((row) => row.statusMeta.label === 'Out of Stock').length,
  }), [filteredRows]);

  const handleIncomingCreated = async () => {
    setToast('Shipment created');
    await loadTransfers();
  };

  const handleOutgoingCreated = async () => {
    setToast('Shipment created');
    await loadTransfers();
  };

  const handleReceiveSuccess = async () => {
    setToast('Stock updated');
    setConfirmReceiveModalOpen(false);
    setSelectedShipment(null);
    await loadTransfers();
  };

  const etaDays = (row) => {
    const date = new Date(row.expectedDeliveryDate || row.dispatchDate || row.createdAt || Date.now());
    const days = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return Number.isFinite(days) ? days : 0;
  };

  return (
    <div className={`erp-page ${darkMode ? 'dark' : ''}`}>
      {toast && <div className="erp-toast">{toast}</div>}

      <div className="erp-shell">
        <div className="erp-card erp-topbar">
          <div>
            <h1 className="erp-page-title">Shipments</h1>
            <div className="erp-muted">Smart action-driven receiving and dispatch control</div>
          </div>

          <div className="erp-search-wrap">
            <input
              className="erp-search"
              value={search}
              list="erp-shipment-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Smart Search: incoming last 7 days | store: delhi"
            />
            <datalist id="erp-shipment-search">
              {suggestions.map((item) => <option key={item} value={item} />)}
            </datalist>
          </div>

          <div className="erp-actions">
            <button type="button" className="erp-btn erp-btn-orange" onClick={() => setOutgoingDrawerOpen(true)}>Out / Issue</button>
            <button type="button" className="erp-btn erp-btn-green" onClick={() => setIncomingDrawerOpen(true)}>In / Receive</button>
            <button type="button" className="erp-btn erp-btn-primary" onClick={() => navigate('/dashboard/spares')}>Add Item</button>
            <button type="button" className="erp-btn" onClick={() => setToast('Import queued')}>Import</button>
            {filteredRows.some((row) => row.statusMeta.label === 'Low Stock') && (
              <button type="button" className="erp-btn" onClick={() => setToast('Reorder suggestions prepared')}>Reorder</button>
            )}
            <button type="button" className="erp-btn" onClick={toggleTheme}>
              {darkMode ? 'Light' : 'Dark'} Mode
            </button>
          </div>
        </div>

        <div className="erp-card" style={{ padding: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="erp-chip">I {'->'} Incoming</button>
          <button type="button" className="erp-chip">O {'->'} Outgoing</button>
          <button type="button" className="erp-chip">R {'->'} Receive</button>
          <button type="button" className="erp-chip">T {'->'} Transfer</button>
        </div>

        <div className="erp-card erp-filters">
          <div className="erp-filter-row">
            <select value={activeStoreId} onChange={(event) => setActiveStoreId(event.target.value)}>
              <option value="">Store</option>
              {stores.map((store) => (
                <option key={store.id || store._id} value={store.id || store._id}>{store.name || store.storeHead}</option>
              ))}
            </select>

            <select value={filters.category} onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}>
              <option value="">Category</option>
              <option value="Incoming">Incoming</option>
              <option value="Outgoing">Outgoing</option>
              <option value="Internal">Internal</option>
            </select>

            <select value={filters.stockStatus} onChange={(event) => setFilters((prev) => ({ ...prev, stockStatus: event.target.value }))}>
              <option value="">Stock status</option>
              <option value="In Transit">In Transit</option>
              <option value="Received">Received</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>

            <select value={filters.importance} onChange={(event) => setFilters((prev) => ({ ...prev, importance: event.target.value }))}>
              <option value="">Importance</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
            </select>
          </div>

          <div className="erp-chip-row">
            {savedFilters.map((chip) => (
              <button
                key={chip}
                type="button"
                className={`erp-chip ${quickFilter === chip ? 'active' : ''}`}
                onClick={() => setQuickFilter((current) => (current === chip ? '' : chip))}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="erp-card erp-analytics">
          <div className="erp-kpi"><h4>Top used items</h4><p>{insights.topUsed}</p></div>
          <div className="erp-kpi"><h4>Most transferred</h4><p>{insights.mostTransferred}</p></div>
          <div className="erp-kpi"><h4>Low stock count</h4><p>{insights.lowStock}</p></div>
          <div className="erp-kpi"><h4>Dead stock</h4><p>{insights.deadStock}</p></div>
        </div>

        {!activeStoreId && (
          <div className="erp-card" style={{ padding: 16 }}>
            <strong>First-time setup</strong>
            <div className="erp-muted" style={{ marginTop: 6 }}>Create your first store {'->'} Add your first item {'->'} Create first shipment.</div>
          </div>
        )}

        <div className="erp-layout-split">
          <div className="erp-card" style={{ padding: 10 }}>
            {loading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="erp-skeleton" />
                <div className="erp-skeleton" />
                <div className="erp-skeleton" />
                <div className="erp-skeleton" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 30 }}>🚚</div>
                <h3 style={{ marginBottom: 6 }}>No shipments yet</h3>
                <div className="erp-muted">Create first incoming or outgoing shipment.</div>
                <button type="button" className="erp-btn erp-btn-green" style={{ marginTop: 12 }} onClick={() => setIncomingDrawerOpen(true)}>Create first shipment</button>
              </div>
            ) : (
              <>
                <div className="erp-table-wrap">
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th className="erp-pin-item" style={{ width: 250 }}>Item Name</th>
                        <th style={{ width: 120 }}>Code</th>
                        <th style={{ width: 120 }}>Category</th>
                        <th className="erp-pin-qty" style={{ width: 100 }}>Quantity</th>
                        <th style={{ width: 170 }}>Status</th>
                        <th style={{ width: 180 }}>Usage (machines)</th>
                        <th style={{ width: 140 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => {
                        const rowId = String(row.id);
                        const isExpanded = expandedTransferId === rowId;
                        const usageLabel = `${row.fromStoreName || 'External'} -> ${row.toStoreName || row.toExternalName || '-'}`;
                        return (
                          <React.Fragment key={rowId}>
                            <tr onClick={() => setSelectedTransferId(rowId)}>
                              <td className="erp-pin-item" style={{ fontWeight: 700 }}>{row.itemName}</td>
                              <td>{rowId.slice(0, 8)}</td>
                              <td>{row.direction}</td>
                              <td className="erp-pin-qty">{row.totalQty}</td>
                              <td>
                                <span className={`erp-status ${row.statusMeta.tone}`}>
                                  <span>{row.statusMeta.icon}</span>
                                  <span>{row.statusMeta.label}</span>
                                  <span>{etaDays(row) < 0 ? '↓' : '↑'}</span>
                                </span>
                                <div className="erp-muted" style={{ marginTop: 4 }}>ETA in {Math.max(0, etaDays(row))} days</div>
                              </td>
                              <td>
                                <button type="button" className="erp-chip" onClick={(event) => { event.stopPropagation(); setSelectedTransferId(rowId); }}>
                                  {usageLabel}
                                </button>
                              </td>
                              <td>
                                <div className="erp-row-actions">
                                  <button type="button" onClick={(event) => { event.stopPropagation(); setExpandedTransferId((current) => current === rowId ? '' : rowId); }}>Expand</button>
                                  {row.statusMeta.label === 'In Transit' && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedShipment(row);
                                        setConfirmReceiveModalOpen(true);
                                      }}
                                    >
                                      Receive
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={7}>
                                  <div className="erp-subcard">
                                    <strong>Expanded Details</strong>
                                    <div className="erp-muted" style={{ marginTop: 4 }}>
                                      Transfer history: {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'N/A'} | Notes: {row.notes || 'No notes'}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="erp-mobile-cards">
                  {filteredRows.map((row) => (
                    <div key={`mobile-${row.id}`} className="erp-mobile-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{row.itemName}</strong>
                        <span className={`erp-status ${row.statusMeta.tone}`}>{row.statusMeta.icon} {row.statusMeta.label}</span>
                      </div>
                      <div className="erp-muted" style={{ marginTop: 6 }}>Qty: {row.totalQty} | {row.direction}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <aside className="erp-card erp-detail">
            {!selectedTransfer ? (
              <>
                <h3>Detail Panel</h3>
                <div className="erp-muted">Select a shipment to inspect movement history, transfers, and stock changes.</div>
              </>
            ) : (
              <>
                <h3>{selectedTransfer.itemName}</h3>
                <div className="erp-subcard">
                  <div><strong>Shipment Code:</strong> {String(selectedTransfer.id).slice(0, 8)}</div>
                  <div><strong>Direction:</strong> {selectedTransfer.direction}</div>
                  <div><strong>Status:</strong> {selectedTransfer.statusMeta.label}</div>
                  <div><strong>Quantity:</strong> {selectedTransfer.totalQty}</div>
                </div>

                <div className="erp-subcard">
                  <strong>Movement History</strong>
                  <div className="erp-muted" style={{ marginTop: 6 }}>Dispatch: {selectedTransfer.dispatchDate ? new Date(selectedTransfer.dispatchDate).toLocaleString() : 'N/A'}</div>
                  <div className="erp-muted">Expected delivery: {selectedTransfer.expectedDeliveryDate ? new Date(selectedTransfer.expectedDeliveryDate).toLocaleString() : 'N/A'}</div>
                </div>

                <div className="erp-subcard">
                  <strong>Transfers</strong>
                  <div className="erp-muted" style={{ marginTop: 6 }}>From: {selectedTransfer.fromStoreName || 'External'}</div>
                  <div className="erp-muted">To: {selectedTransfer.toStoreName || selectedTransfer.toExternalName || '-'}</div>
                </div>

                <div className="erp-subcard">
                  <strong>Stock changes</strong>
                  <div className="erp-muted" style={{ marginTop: 6 }}>Will update inventory on receive confirmation.</div>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      <IncomingShipmentDrawer
        isOpen={incomingDrawerOpen}
        stores={stores}
        defaultToStore={activeStoreId}
        onClose={() => setIncomingDrawerOpen(false)}
        onSuccess={handleIncomingCreated}
      />

      <OutgoingShipmentDrawer
        isOpen={outgoingDrawerOpen}
        stores={stores}
        defaultFromStore={activeStoreId}
        onClose={() => setOutgoingDrawerOpen(false)}
        onSuccess={handleOutgoingCreated}
      />

      <ShipmentConfirmReceiveModal
        isOpen={confirmReceiveModalOpen}
        shipment={selectedShipment}
        onClose={() => {
          setConfirmReceiveModalOpen(false);
          setSelectedShipment(null);
        }}
        onSuccess={handleReceiveSuccess}
      />
    </div>
  );
};

export default Logistics;
