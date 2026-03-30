import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import useApp from '../hooks/useApp';
import { createTransfer, getSpareParts, getTransfers } from '../services/api';

const Transfers = () => {
  const navigate = useNavigate();
  const { stores, selectedStore } = useApp();
  
  const [fromStore, setFromStore] = useState('');
  const [toStore, setToStore] = useState('');
  const [transferItems, setTransferItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [quantityErrors, setQuantityErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [updatedPartIds, setUpdatedPartIds] = useState([]);

  // Set initial from store
  useEffect(() => {
    if (selectedStore && !fromStore) {
      setFromStore(selectedStore);
    }
  }, [selectedStore, fromStore]);

  // Fetch spare parts when from store changes
  useEffect(() => {
    if (!fromStore) return;
    
    const fetchParts = async () => {
      setLoading(true);
      try {
        const response = await getSpareParts({ storeId: fromStore });
        if (response.success) {
          setTransferItems(response.data);
          setQuantities({});
          setQuantityErrors({});
        }
      } catch (err) {
        console.error('Error fetching spare parts:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchParts();
  }, [fromStore]);

  // Fetch recent transfers
  useEffect(() => {
    const fetchTransfers = async () => {
      setTransfersLoading(true);
      try {
        const response = await getTransfers({ limit: 5 });
        if (response.success) {
          setRecentTransfers(response.data);
        }
      } catch (err) {
        console.error('Error fetching transfers:', err);
      } finally {
        setTransfersLoading(false);
      }
    };
    
    fetchTransfers();
  }, []);

  // Filter out same store from to-store dropdown
  const availableToStores = useMemo(() => {
    return stores.filter(store => store.id !== fromStore);
  }, [stores, fromStore]);

  useEffect(() => {
    if (toStore && toStore === fromStore) {
      setToStore('');
    }
  }, [fromStore, toStore]);

  // Handle quantity change
  const handleQuantityChange = (itemId, quantity) => {
    const item = transferItems.find(i => i.id === itemId);
    const maxQty = Number(item?.quantity || 0);
    const nextValue = String(quantity);

    setQuantities(prev => ({
      ...prev,
      [itemId]: nextValue
    }));

    if (nextValue === '') {
      setQuantityErrors(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      return;
    }

    const parsed = Number(nextValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setQuantityErrors(prev => ({ ...prev, [itemId]: 'Enter a whole number greater than 0.' }));
      return;
    }
    if (parsed > maxQty) {
      setQuantityErrors(prev => ({ ...prev, [itemId]: `Cannot exceed available quantity (${maxQty}).` }));
      return;
    }

    setQuantityErrors(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const selectedItems = useMemo(() => {
    return transferItems
      .map((item) => ({
        item,
        quantity: Number(quantities[item.id])
      }))
      .filter(({ item, quantity }) => Number.isInteger(quantity) && quantity > 0 && quantity <= Number(item.quantity || 0));
  }, [transferItems, quantities]);

  // Handle transfer submission
  const handleTransfer = async () => {
    if (!fromStore || !toStore) {
      setError('Please select both source and destination stores');
      return;
    }

    if (fromStore === toStore) {
      setError('Source and destination stores must be different');
      return;
    }

    if (Object.keys(quantityErrors).length > 0) {
      setError('Please correct invalid transfer quantities before submitting');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Please select at least one item to transfer');
      return;
    }

    const fromStoreData = stores.find(s => s.id === fromStore);
    const toStoreData = stores.find(s => s.id === toStore);

    const items = selectedItems.map(({ item, quantity }) => ({
      spare_part_id: item.id,
      sparePartId: item.id,
      quantity
    }));

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await createTransfer({
        type: 'internal',
        isInstant: false,
        status: 'in_transit',
        from_store_id: fromStore,
        fromStoreId: fromStore,
        from_store_name: fromStoreData?.name || 'Unknown Store',
        fromStoreName: fromStoreData?.name || 'Unknown Store',
        to_store_id: toStore,
        toStoreId: toStore,
        to_store_name: toStoreData?.name || 'Unknown Store',
        toStoreName: toStoreData?.name || 'Unknown Store',
        items,
        transferred_by: 'Current User'
      });

      if (response.success) {
        setSuccess(response.message);
        setQuantities({});
        setQuantityErrors({});
        setUpdatedPartIds(items.map((item) => item.spare_part_id));

        window.dispatchEvent(
          new CustomEvent('inventory:updated', {
            detail: {
              storeIds: [fromStore],
              updatedAt: Date.now()
            }
          })
        );
        setTimeout(() => setUpdatedPartIds([]), 2000);
        
        // Refresh data
        const partsResponse = await getSpareParts({ storeId: fromStore });
        if (partsResponse.success) {
          setTransferItems(partsResponse.data);
        }
        
        const transfersResponse = await getTransfers({ limit: 5 });
        if (transfersResponse.success) {
          setRecentTransfers(transfersResponse.data);
        }
      } else {
        setError(response.error || 'Transfer failed');
        if (response.errors && response.errors.length > 0) {
          setError(response.errors.join(', '));
        }
      }
    } catch (err) {
      setError(err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  // Get selected items count
  const selectedCount = selectedItems.length;

  return (
    <Motion.div
      style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          Stock Transfers
        </h1>
        <p style={{ color: '#666', marginTop: 8, fontSize: 16 }}>
          Create transfer consignments. Source inventory is deducted now and destination updates after confirmation.
        </p>
        <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/dashboard/transfers/transit')}
            style={{
              border: 'none',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #22c55e 100%)',
              color: '#fff',
              padding: '10px 18px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(13, 148, 136, 0.25)'
            }}
          >
            Open Transfer Transit Screen
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence>
      {error && (
        <Motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ color: '#dc2626', fontSize: 20 }}>!</span>
          <span style={{ color: '#dc2626' }}>{error}</span>
          <button 
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
          >
            ×
          </button>
        </Motion.div>
      )}

      {success && (
        <Motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ color: '#16a34a', fontSize: 20 }}>OK</span>
          <span style={{ color: '#16a34a' }}>{success}</span>
          <button 
            onClick={() => setSuccess(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
          >
            ×
          </button>
        </Motion.div>
      )}
      </AnimatePresence>

      {/* Store Selection */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#1a1a1a' }}>
          Select Stores
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* From Store */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
              From Store
            </label>
            <select
              value={fromStore}
              onChange={(e) => {
                setFromStore(e.target.value);
                setQuantities({});
                setQuantityErrors({});
              }}
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
              <option value="">Select source store</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          {/* To Store */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
              To Store
            </label>
            <select
              value={toStore}
              onChange={(e) => setToStore(e.target.value)}
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
              <option value="">Select destination store</option>
              {availableToStores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
            {fromStore && toStore && fromStore === toStore && (
              <p style={{ marginTop: 8, color: '#dc2626', fontSize: 13 }}>
                Source and destination cannot be the same.
              </p>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 12, fontSize: 13, color: '#4b5563' }}>
          Lot allocation is automatic using FEFO (earliest expiry first).
        </div>
      </div>

      {/* Items Table */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
            Available Items
          </h2>
          {selectedCount > 0 && (
            <span style={{
              background: '#dbeafe',
              color: '#1d4ed8',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 500
            }}>
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>

        {!fromStore ? (
          <div style={{
            textAlign: 'center',
            padding: 48,
            color: '#9ca3af'
          }}>
            <p style={{ fontSize: 16 }}>Please select a source store to view available items</p>
          </div>
        ) : loading ? (
          <div style={{
            textAlign: 'center',
            padding: 48,
            color: '#9ca3af'
          }}>
            <p style={{ fontSize: 16 }}>Loading items...</p>
          </div>
        ) : transferItems.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 48,
            color: '#9ca3af'
          }}>
            <p style={{ fontSize: 16 }}>No items available in this store</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Item Name
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Available Quantity
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Transfer Quantity
                  </th>
                </tr>
              </thead>
              <tbody>
                {transferItems.map((item, index) => (
                  <tr 
                    key={item.id}
                    style={{ 
                      borderBottom: '1px solid #e5e7eb',
                      background: updatedPartIds.includes(item.id)
                        ? '#ecfdf5'
                        : (index % 2 === 0 ? '#fff' : '#f9fafb'),
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1a1a1a' }}>
                      <div>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        Lots: {Array.isArray(item.batches) ? item.batches.length : 0}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: item.quantity <= (item.minimumRequired || 5) ? '#fef2f2' : '#f0fdf4',
                        color: item.quantity <= (item.minimumRequired || 5) ? '#dc2626' : '#16a34a',
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 14,
                        fontWeight: 500
                      }}>
                        {item.quantity}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={quantities[item.id] ?? ''}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        placeholder="0"
                        style={{
                          width: 120,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: quantityErrors[item.id] ? '1px solid #dc2626' : '1px solid #d1d5db',
                          fontSize: 14
                        }}
                      />
                      {quantityErrors[item.id] && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>
                          {quantityErrors[item.id]}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
        <button
          onClick={handleTransfer}
          disabled={loading || !fromStore || !toStore || selectedCount === 0 || Object.keys(quantityErrors).length > 0}
          style={{
            background: loading || !fromStore || !toStore || selectedCount === 0 || Object.keys(quantityErrors).length > 0 ? '#9ca3af' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 600,
            cursor: loading || !fromStore || !toStore || selectedCount === 0 || Object.keys(quantityErrors).length > 0 ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {loading ? 'Processing...' : `Transfer ${selectedCount} Item${selectedCount !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Recent Transfers */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
            Recent Transfers
          </h2>
          <button
            onClick={() => navigate('/dashboard/transfer-history')}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            View All →
          </button>
        </div>

        {transfersLoading ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
            Loading transfers...
          </div>
        ) : recentTransfers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
            No transfers yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Item
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Quantity
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    From Store
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    To Store
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Date
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 14 }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentTransfers.map((transfer, index) => (
                  <tr 
                    key={transfer.id}
                    style={{ 
                      borderBottom: '1px solid #e5e7eb',
                      background: index % 2 === 0 ? '#fff' : '#f9fafb'
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1a1a1a' }}>
                      {transfer.items.map(item => item.sparePartName).join(', ')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {transfer.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>
                      {transfer.fromStoreName}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>
                      {transfer.toStoreName}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#666', fontSize: 14 }}>
                      {new Date(transfer.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          background: transfer.status === 'in_transit' ? '#fef3c7' : '#dcfce7',
                          color: transfer.status === 'in_transit' ? '#92400e' : '#166534',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '4px 10px'
                        }}
                      >
                        {transfer.status === 'in_transit' ? 'In Transit' : (transfer.status || 'Unknown')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Motion.div>
  );
};

export default Transfers;
