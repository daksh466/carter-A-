import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useApp from '../hooks/useApp';
import { getTransfers, getTransferStats } from '../services/api';
import OutgoingShipmentDrawer from '../components/OutgoingShipmentDrawer';

const formatDate = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString();
};

const getLogisticsStatus = (transfer) => {
  const rawStatus = String(transfer.status || '').toLowerCase();
  if (rawStatus === 'completed') {
    return 'completed';
  }

  if (rawStatus === 'in_transit') {
    const expected = transfer.expectedDeliveryDate ? new Date(transfer.expectedDeliveryDate) : null;
    if (expected && !Number.isNaN(expected.getTime()) && Date.now() > expected.getTime()) {
      return 'delayed';
    }
    return 'in_transit';
  }

  return rawStatus || 'in_transit';
};

const statusTheme = {
  in_transit: { bg: '#ffedd5', color: '#9a3412', label: 'In Transit' },
  completed: { bg: '#dcfce7', color: '#166534', label: 'Completed' },
  delayed: { bg: '#fee2e2', color: '#b91c1c', label: 'Delayed' }
};

const TransferHistory = () => {
  const navigate = useNavigate();
  const { stores } = useApp();
  const safeStores = Array.isArray(stores) ? stores : [];
  
  const [transfers, setTransfers] = useState([]);
  const [stats, setStats] = useState({
    totalTransfers: 0,
    outgoingTransfers: 0,
    incomingTransfers: 0,
    totalItemsTransferred: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterStore, setFilterStore] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState('');

  const openOutgoingDrawer = () => {
    setDrawerOpen(true);
  };

  const openOutgoingScreen = () => {
    navigate('/dashboard/outgoing');
  };

  const openIncomingWorkflow = () => {
    navigate('/dashboard/incoming');
  };

  // Fetch transfers and stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const transferOptions = {};
      if (filterStore) {
        transferOptions.storeId = filterStore;
      }
      if (statusFilter && statusFilter !== 'all' && statusFilter !== 'delayed') {
        transferOptions.status = statusFilter;
      }
      if (dateFrom) {
        transferOptions.dateFrom = dateFrom;
      }
      if (dateTo) {
        transferOptions.dateTo = dateTo;
      }

      const statsOptions = {};
      if (filterStore) {
        statsOptions.storeId = filterStore;
      }
      if (dateFrom) {
        statsOptions.dateFrom = dateFrom;
      }
      if (dateTo) {
        statsOptions.dateTo = dateTo;
      }

      const [transfersRes, statsRes] = await Promise.all([
        getTransfers(transferOptions),
        getTransferStats(statsOptions)
      ]);

      if (transfersRes.success) {
        setTransfers(transfersRes.data);
      }

      if (statsRes.success) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error('Error fetching transfer data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filterStore, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleTransfersUpdated = () => {
      fetchData();
    };

    window.addEventListener('transfers:updated', handleTransfersUpdated);
    return () => {
      window.removeEventListener('transfers:updated', handleTransfersUpdated);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  const filteredTransfers = useMemo(() => {
    if (statusFilter !== 'delayed') {
      return transfers;
    }

    return transfers.filter((transfer) => getLogisticsStatus(transfer) === 'delayed');
  }, [statusFilter, transfers]);

  const toggleRow = (transferId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [transferId]: !prev[transferId]
    }));
  };

  const defaultFromStore = filterStore || safeStores?.[0]?.id || '';

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          Transfer History
        </h1>
        <p style={{ color: '#666', marginTop: 8, fontSize: 16 }}>
          View all stock transfers between stores
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: 20,
        marginBottom: 32 
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 16,
          padding: 24,
          color: '#fff'
        }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Total Transfers</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.totalTransfers}</div>
        </div>

        <button
          type="button"
          onClick={openOutgoingDrawer}
          style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: 16,
          padding: 24,
          color: '#fff',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer'
        }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Outgoing</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.outgoingTransfers}</div>
          <div style={{ marginTop: 10 }}>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                openOutgoingScreen();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  openOutgoingScreen();
                }
              }}
              style={{
                border: '1px solid rgba(255,255,255,0.7)',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.16)',
                color: '#fff',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-block'
              }}
            >
              Add Outgoing
            </span>
          </div>
          <div style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>Click to dispatch shipment</div>
        </button>

        <button
          type="button"
          onClick={openIncomingWorkflow}
          style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: 16,
          padding: 24,
          color: '#fff',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer'
        }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Incoming</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.incomingTransfers}</div>
          <div style={{ marginTop: 10 }}>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                openIncomingWorkflow();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  openIncomingWorkflow();
                }
              }}
              style={{
                border: '1px solid rgba(255,255,255,0.7)',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.16)',
                color: '#fff',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-block'
              }}
            >
              Add Incoming
            </span>
          </div>
          <div style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>Click to open receiving workflow</div>
        </button>

        <div style={{
          background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
          borderRadius: 16,
          padding: 24,
          color: '#fff'
        }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Items Transferred</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.totalItemsTransferred}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {/* Store Filter */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
              Filter by Store
            </label>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: 15,
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">All Stores</option>
              {safeStores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: 15,
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
            </select>
          </div>

          {/* Date From */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: 15,
                background: '#fff'
              }}
            />
          </div>

          {/* Date To */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: 15,
                background: '#fff'
              }}
            />
          </div>
        </div>
      </div>

      {/* Transfers Table */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#1a1a1a' }}>
          All Transfers ({filteredTransfers.length})
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            Loading transfers...
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            <p style={{ fontSize: 16 }}>No transfers found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1450 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Item Names
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Total Quantity
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    From Store
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    To Store
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Driver Name
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Driver ID
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Mode of Transport
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Distance (KM)
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Dispatch Date
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Expected Date
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Received Date
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((transfer, index) => {
                  const status = getLogisticsStatus(transfer);
                  const theme = statusTheme[status] || statusTheme.in_transit;
                  const isExpanded = Boolean(expandedRows[transfer.id]);
                  const totalQty = (transfer.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                  const driverName = transfer.driver?.name || '-';
                  const driverId = transfer.driver?.driverId || '-';

                  return (
                    <React.Fragment key={transfer.id}>
                      <tr
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          background: index % 2 === 0 ? '#fff' : '#f9fafb',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            type="button"
                            onClick={() => toggleRow(transfer.id)}
                            style={{
                              border: '1px solid #d1d5db',
                              borderRadius: 8,
                              background: '#fff',
                              width: 28,
                              height: 28,
                              cursor: 'pointer',
                              color: '#374151',
                              fontWeight: 700
                            }}
                            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                            title={isExpanded ? 'Collapse item breakdown' : 'Expand item breakdown'}
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#1f2937' }}>
                          <div style={{ display: 'grid', gap: 4 }}>
                            {(transfer.items || []).map((item) => (
                              <div key={`${transfer.id}-${item.id || item.itemId}`} style={{ fontWeight: 600, fontSize: 13 }}>
                                {item.itemName || item.itemRef?.name || item.sparePartName || (item.itemId ? `Item ${item.itemId}` : 'Unknown Item')}
                              </div>
                            ))}
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: '#dbeafe',
                            color: '#1d4ed8',
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: 14,
                            fontWeight: 700
                          }}>
                            {totalQty}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                          {transfer.fromStoreName || '-'}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                          {transfer.toStoreName || transfer.toExternalName || 'External'}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                          <span title={`Driver: ${driverName} | Phone: ${transfer.driver?.phone || '-'}`} style={{ borderBottom: '1px dashed #94a3b8', cursor: 'help' }}>
                            {driverName}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                          <span title={`Driver ID: ${driverId}`} style={{ borderBottom: '1px dashed #94a3b8', cursor: 'help' }}>
                            {driverId}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                          {transfer.modeOfTransport || '-'}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                          {Number(transfer.distance || 0).toFixed(1)}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                          {formatDate(transfer.dispatchDate || transfer.createdAt)}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                          {formatDate(transfer.expectedDeliveryDate)}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                          {formatDate(transfer.receivedDate)}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <Motion.span
                            initial={{ opacity: 0.6, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.22 }}
                            style={{
                              background: theme.bg,
                              color: theme.color,
                              padding: '5px 12px',
                              borderRadius: 999,
                              fontSize: 13,
                              fontWeight: 700
                            }}
                          >
                            {theme.label}
                          </Motion.span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                          <td colSpan={13} style={{ padding: '12px 16px 14px 56px' }}>
                            <div style={{ fontSize: 13, color: '#334155', fontWeight: 700, marginBottom: 8 }}>
                              Item Breakdown
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              {(transfer.items || []).map((item) => (
                                <div key={`${transfer.id}-breakdown-${item.id || item.itemId}`} style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: '#fff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 10,
                                  padding: '8px 12px'
                                }}>
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.itemName || item.itemRef?.name || item.sparePartName || (item.itemId ? `Item ${item.itemId}` : 'Unknown Item')}</div>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>Item ID: {item.itemId || item.sparePartId || '-'}</div>
                                  </div>
                                  <div style={{ fontWeight: 700, color: '#1d4ed8' }}>Qty: {Number(item.quantity || 0)}</div>
                                </div>
                              ))}
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
        )}
      </div>

      <OutgoingShipmentDrawer
        isOpen={drawerOpen}
        stores={safeStores}
        defaultFromStore={defaultFromStore}
        onClose={() => setDrawerOpen(false)}
        onSuccess={async () => {
          setToast('Shipment Dispatched 🚚');
          await fetchData();
        }}
      />

      <AnimatePresence>
        {toast && (
          <Motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              zIndex: 60,
              background: '#16a34a',
              color: '#fff',
              borderRadius: 10,
              padding: '10px 14px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              fontWeight: 600
            }}
          >
            {toast}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransferHistory;
