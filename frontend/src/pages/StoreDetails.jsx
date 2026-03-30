import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { 
  ArrowLeft, Package, Truck, History, ClipboardCheck,
  AlertTriangle, CheckCircle, AlertCircle,
  MapPin, User, Phone, Warehouse
} from "lucide-react";
import {
  getSpareParts,
  getMachinesByStore,
  getTransfers,
  markTransferReceived,
  getStoreOrders,
  confirmStoreOrderReceive,
  confirmStoreOrderDispatch
} from "../services/api";
import ReceiveShipmentModal from "../components/ReceiveShipmentModal";
import useApp from "../hooks/useApp";

const Motion = motion;

// Tab components
const InventoryTab = ({ inventory, loading }) => {
  if (loading) {
    return (
      <div className="store-inventory-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="store-inventory-card skeleton-card">
            <div className="skeleton-title"></div>
            <div className="skeleton-text"></div>
            <div className="skeleton-badge"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!inventory || inventory.length === 0) {
    return (
      <div className="store-empty-state">
        <Package size={48} />
        <h3>No inventory found</h3>
        <p>This store doesn't have any spare parts in inventory.</p>
      </div>
    );
  }

  return (
    <Motion.div 
      className="store-inventory-grid"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {inventory.map((item, index) => {
        const status = item.minimumRequired > 0 && item.quantity < item.minimumRequired 
          ? 'low' 
          : item.minimumRequired > 0 && item.quantity < item.minimumRequired * 1.5 
            ? 'medium' 
            : 'healthy';
            
        return (
          <Motion.div
            key={item.id}
            className="store-inventory-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <div className="store-inventory-card-header">
              <h4>{item.name}</h4>
              <span className={`status-badge status-${status}`}>
                {status === 'low' && <AlertTriangle size={12} />}
                {status === 'medium' && <AlertCircle size={12} />}
                {status === 'healthy' && <CheckCircle size={12} />}
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            <div className="store-inventory-card-body">
              <div className="inventory-stat">
                <span className="label">Quantity</span>
                <span className="value">{item.quantity || 0}</span>
              </div>
              <div className="inventory-stat">
                <span className="label">Min Required</span>
                <span className="value">{item.minimumRequired || 0}</span>
              </div>
            </div>
            {status === 'low' && (
              <div className="low-stock-alert">
                <AlertTriangle size={14} />
                <span>Low stock! Order soon.</span>
              </div>
            )}
          </Motion.div>
        );
      })}
    </Motion.div>
  );
};

const normalizeTransferType = (type) => {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'internal') {
    return 'transfer';
  }
  return normalized;
};

const formatStatusLabel = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) {
    return 'Pending';
  }
  return normalized
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const TransfersTab = ({
  transfers,
  loading,
  onOpenReceiveModal,
  successMessage,
  errorMessage
}) => {
  const visibleTransfers = Array.isArray(transfers)
    ? transfers.filter((transfer) => {
        const displayType = normalizeTransferType(transfer?.type);
        return displayType === 'incoming' || displayType === 'outgoing';
      })
    : [];

  if (loading) {
    return (
      <div className="store-table-container">
        <div className="skeleton-table">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-row"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!visibleTransfers.length) {
    return (
      <div className="store-empty-state">
        <Truck size={48} />
        <h3>No transfers found</h3>
        <p>No incoming or outgoing shipments are available for this store.</p>
      </div>
    );
  }

  return (
    <div>
      {successMessage && <div className="store-orders-feedback success">{successMessage}</div>}
      {errorMessage && <div className="store-orders-feedback error">{errorMessage}</div>}
      <div className="store-table-container">
        <table className="store-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Items</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleTransfers.map((transfer, index) => {
              const displayType = normalizeTransferType(transfer.type);
              const status = String(transfer.status || 'pending').toLowerCase();
              const canConfirmReceive = displayType === 'incoming' && status === 'in_transit';

              return (
                <Motion.tr
                  key={transfer.id || index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td>{new Date(transfer.createdAt).toLocaleDateString()}</td>
                  <td>{displayType}</td>
                  <td>{transfer.items?.length || 0}</td>
                  <td>
                    <span className={`status-badge status-${status}`}>
                      {formatStatusLabel(status)}
                    </span>
                  </td>
                  <td>
                    {canConfirmReceive ? (
                      <button
                        type="button"
                        className="store-transfer-confirm-btn"
                        onClick={() => onOpenReceiveModal(transfer)}
                        title="Confirm items received at destination store"
                      >
                        Confirm Receive
                      </button>
                    ) : (
                      <span className="store-orders-meta">-</span>
                    )}
                  </td>
                </Motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const HistoryTab = ({ machines }) => {
  if (!machines || machines.length === 0) {
    return (
      <div className="store-empty-state">
        <History size={48} />
        <h3>No history found</h3>
        <p>No machines have been assigned to this store.</p>
      </div>
    );
  }

  return (
    <div className="store-machines-list">
      {machines.map((machine, index) => (
        <Motion.div
          key={machine.id || index}
          className="store-machine-card"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <div className="machine-icon">
            <Warehouse size={24} />
          </div>
          <div className="machine-info">
            <h4>{machine.name}</h4>
            <p>Quantity: {machine.quantity || 0}</p>
          </div>
        </Motion.div>
      ))}
    </div>
  );
};

const formatOrderDate = (value) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleString();
};

const OrdersTab = ({
  loading,
  orders,
  filters,
  onFiltersChange,
  onConfirmIncoming,
  onConfirmOutgoing,
  processingOrderId,
  message,
  error
}) => {
  const searchTerm = String(filters.search || '').trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
    if (filters.direction !== 'all' && order.direction !== filters.direction) {
      return false;
    }

    if (filters.status !== 'all' && order.status !== filters.status) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    const haystack = [
      order.order_number,
      order.supplier_name,
      order.requested_by,
      ...(order.items || []).map((item) => item.part_name)
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(searchTerm);
  });

  const incomingOrders = filteredOrders.filter((order) => order.direction === 'incoming');
  const outgoingOrders = filteredOrders.filter((order) => order.direction === 'outgoing');

  const nextIncomingPending = incomingOrders.find((order) => order.status === 'pending');
  const nextOutgoingPending = outgoingOrders.find((order) => order.status === 'pending');

  if (loading) {
    return (
      <div className="store-table-container">
        <div className="skeleton-table">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-row"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="store-orders-tab">
      <div className="store-orders-toolbar">
        <div className="store-orders-quick-actions">
          <button
            type="button"
            className="store-orders-action incoming"
            disabled={!nextIncomingPending || processingOrderId === nextIncomingPending?.id}
            onClick={() => onConfirmIncoming(nextIncomingPending)}
          >
            Confirm Incoming
          </button>
          <button
            type="button"
            className="store-orders-action outgoing"
            disabled={!nextOutgoingPending || processingOrderId === nextOutgoingPending?.id}
            onClick={() => onConfirmOutgoing(nextOutgoingPending)}
          >
            Confirm Outgoing
          </button>
        </div>

        <div className="store-orders-filters">
          <input
            className="store-orders-search"
            type="text"
            value={filters.search}
            onChange={(event) => onFiltersChange({ search: event.target.value })}
            placeholder="Search order number, supplier, requester, item"
          />
          <select
            className="store-orders-select"
            value={filters.direction}
            onChange={(event) => onFiltersChange({ direction: event.target.value })}
          >
            <option value="all">All Directions</option>
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
          </select>
          <select
            className="store-orders-select"
            value={filters.status}
            onChange={(event) => onFiltersChange({ status: event.target.value })}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="dispatched">Dispatched</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {message && <div className="store-orders-feedback success">{message}</div>}
      {error && <div className="store-orders-feedback error">{error}</div>}

      <div className="store-orders-split-grid">
        <div className="store-table-container">
          <div className="store-orders-column-header">Incoming Orders</div>
          {incomingOrders.length === 0 ? (
            <div className="store-empty-state">
              <ClipboardCheck size={40} />
              <h3>No incoming orders found</h3>
              <p>No incoming records match the current filters.</p>
            </div>
          ) : (
            <table className="store-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {incomingOrders.map((order) => {
                  const confirmation = order.receive_confirmation || {};
                  return (
                    <tr key={order.id}>
                      <td>
                        <div>{order.order_number || 'No Number'}</div>
                        <div className="store-orders-meta">{order.supplier_name || 'No supplier'}</div>
                      </td>
                      <td>{order.total_quantity || 0}</td>
                      <td>
                        <span className={`status-badge status-${order.status || 'pending'}`}>
                          {order.status || 'pending'}
                        </span>
                        {order.status === 'received' && (
                          <div className="store-orders-meta">
                            {confirmation.confirmed_by || 'System'} at {formatOrderDate(confirmation.confirmed_at)}
                          </div>
                        )}
                      </td>
                      <td>{formatOrderDate(order.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="store-orders-row-action"
                          disabled={order.status !== 'pending' || processingOrderId === order.id}
                          onClick={() => onConfirmIncoming(order)}
                        >
                          {processingOrderId === order.id ? 'Processing...' : 'Confirm Receive'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="store-table-container">
          <div className="store-orders-column-header">Outgoing Orders</div>
          {outgoingOrders.length === 0 ? (
            <div className="store-empty-state">
              <ClipboardCheck size={40} />
              <h3>No outgoing orders found</h3>
              <p>No outgoing records match the current filters.</p>
            </div>
          ) : (
            <table className="store-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {outgoingOrders.map((order) => {
                  const confirmation = order.dispatch_confirmation || {};
                  return (
                    <tr key={order.id}>
                      <td>
                        <div>{order.order_number || 'No Number'}</div>
                        <div className="store-orders-meta">{order.requested_by || 'No requester'}</div>
                      </td>
                      <td>{order.total_quantity || 0}</td>
                      <td>
                        <span className={`status-badge status-${order.status || 'pending'}`}>
                          {order.status || 'pending'}
                        </span>
                        {order.status === 'dispatched' && (
                          <div className="store-orders-meta">
                            {confirmation.confirmed_by || 'System'} at {formatOrderDate(confirmation.confirmed_at)}
                          </div>
                        )}
                      </td>
                      <td>{formatOrderDate(order.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="store-orders-row-action"
                          disabled={order.status !== 'pending' || processingOrderId === order.id}
                          onClick={() => onConfirmOutgoing(order)}
                        >
                          {processingOrderId === order.id ? 'Processing...' : 'Confirm Dispatch'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// Main StoreDetails Component
export default function StoreDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { stores } = useApp();
  
  const [inventory, setInventory] = useState([]);
  const [machines, setMachines] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [storeOrders, setStoreOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  const [ordersFilters, setOrdersFilters] = useState({
    search: '',
    status: 'all',
    direction: 'all'
  });
  const [ordersMessage, setOrdersMessage] = useState('');
  const [ordersError, setOrdersError] = useState('');
  const [processingOrderId, setProcessingOrderId] = useState('');
  const [receivingTransferId, setReceivingTransferId] = useState('');
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [activeTransferForReceive, setActiveTransferForReceive] = useState(null);
  const [transferToast, setTransferToast] = useState('');
  const [transferError, setTransferError] = useState('');

  const store = stores?.find(s => (s?.id || s?._id) === id);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch inventory (spare parts) for this store
        const inventoryRes = await getSpareParts({ storeId: id });
        if (inventoryRes.success && inventoryRes.data) {
          setInventory(inventoryRes.data);
        }

        // Fetch machines for this store
        const machinesRes = await getMachinesByStore(id);
        if (machinesRes.success && machinesRes.data) {
          setMachines(machinesRes.data);
        }

        // Fetch transfers for this store
        const transfersRes = await getTransfers({ storeId: id });
        if (transfersRes.success && transfersRes.data) {
          setTransfers(Array.isArray(transfersRes.data) ? transfersRes.data : transfersRes.data.transfers || []);
        }

        // Fetch isolated store orders for this store
        const ordersRes = await getStoreOrders({ store_id: id });
        if (ordersRes.success && ordersRes.data) {
          setStoreOrders(ordersRes.data);
        }
      } catch (err) {
        console.error('Error fetching store data:', err);
      } finally {
        setLoading(false);
        setOrdersLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const refreshInventoryForStore = async () => {
    const inventoryRes = await getSpareParts({ storeId: id });
    if (inventoryRes.success && inventoryRes.data) {
      setInventory(inventoryRes.data);
    }
  };

  const openReceiveModal = (transfer) => {
    if (!transfer?.id) {
      return;
    }

    setTransferError('');
    setActiveTransferForReceive(transfer);
    setReceiveModalOpen(true);
  };

  const closeReceiveModal = () => {
    if (receivingTransferId) {
      return;
    }
    setReceiveModalOpen(false);
    setActiveTransferForReceive(null);
    setTransferError('');
  };

  const handleConfirmTransferReceive = async (payload) => {
    const transfer = activeTransferForReceive;
    if (!transfer?.id) {
      return false;
    }

    setTransferToast('');
    setTransferError('');
    setReceivingTransferId(transfer.id);

    try {
      const response = await markTransferReceived(transfer.id, payload);

      if (!response.success || !response.data) {
        setTransferError(response.error || 'Failed to confirm incoming shipment');
        return false;
      }

      setTransfers((previous) => previous.map((item) => (
        item.id === response.data.id ? response.data : item
      )));
      setTransferToast('Shipment received successfully');
      await refreshInventoryForStore();
      setReceiveModalOpen(false);
      setActiveTransferForReceive(null);
      return true;
    } catch (error) {
      console.error('Receive shipment error:', error);
      setTransferError('Unable to confirm shipment receive right now');
      return false;
    } finally {
      setReceivingTransferId('');
    }
  };

  const handleConfirmOrder = async (order, mode) => {
    if (!order?.id) {
      return;
    }

    setOrdersMessage('');
    setOrdersError('');

    const defaultName = String(localStorage.getItem('userName') || '').trim();
    const confirmerName = window.prompt('Enter confirmer name', defaultName || 'Store Manager');

    if (confirmerName === null) {
      return;
    }

    setProcessingOrderId(order.id);
    try {
      const payload = { confirmerName: String(confirmerName || '').trim() || 'Store Manager' };
      const response = mode === 'incoming'
        ? await confirmStoreOrderReceive(order.id, payload)
        : await confirmStoreOrderDispatch(order.id, payload);

      if (!response.success || !response.data) {
        setOrdersError(response.error || 'Failed to confirm order');
        return;
      }

      setStoreOrders((previous) => previous.map((existing) => (
        existing.id === response.data.id ? response.data : existing
      )));

      await refreshInventoryForStore();
      setOrdersMessage(response.message || 'Order confirmed successfully');
    } catch (error) {
      console.error('Order confirmation error:', error);
      setOrdersError('Unable to confirm order right now. Please retry.');
    } finally {
      setProcessingOrderId('');
    }
  };

  // Calculate summary stats
  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(i => i.minimumRequired > 0 && i.quantity < i.minimumRequired).length;
  const totalQuantity = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);

  if (!store && !loading) {
    return (
      <div className="store-details-error">
        <h2>Store not found</h2>
        <button onClick={() => navigate('/dashboard/stores')}>Go back to stores</button>
      </div>
    );
  }

  return (
    <Motion.div 
      className="store-details-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Breadcrumb */}
      <div className="store-details-breadcrumb">
        <Link to="/dashboard/stores" className="breadcrumb-link">
          <ArrowLeft size={16} />
          <span>All Stores</span>
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{store?.state || store?.storeHead || 'Store'}</span>
      </div>

      {/* Hero Header */}
      <Motion.div 
        className="store-details-hero"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="store-details-hero-content">
          <div className="store-details-icon">
            <Warehouse size={32} />
          </div>
          <div className="store-details-info">
            <h1>{store?.state || store?.name || 'Store Details'}</h1>
            <div className="store-details-meta">
              {store?.storeHead && (
                <span><User size={14} /> {store.storeHead}</span>
              )}
              {store?.contact && (
                <span><Phone size={14} /> {store.contact}</span>
              )}
              {store?.address && (
                <span><MapPin size={14} /> {store.address}</span>
              )}
            </div>
          </div>
        </div>
        <div className="store-details-hero-gradient"></div>
      </Motion.div>

      {/* Summary Cards */}
      <Motion.div 
        className="store-summary-cards"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="summary-card">
          <div className="summary-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Package size={20} />
          </div>
          <div className="summary-content">
            <span className="summary-value">{totalItems}</span>
            <span className="summary-label">Total Items</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="summary-content">
            <span className="summary-value" style={{ color: lowStockItems > 0 ? '#f5576c' : 'inherit' }}>
              {lowStockItems}
            </span>
            <span className="summary-label">Low Stock Items</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <CheckCircle size={20} />
          </div>
          <div className="summary-content">
            <span className="summary-value">{totalQuantity}</span>
            <span className="summary-label">Total Quantity</span>
          </div>
        </div>
      </Motion.div>

      {/* Tabs */}
      <div className="store-tabs-container">
        <div className="store-tabs">
          <button 
            className={`store-tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={16} />
            <span>Inventory</span>
          </button>
          <button 
            className={`store-tab ${activeTab === 'transfers' ? 'active' : ''}`}
            onClick={() => setActiveTab('transfers')}
          >
            <Truck size={16} />
            <span>Transfers</span>
          </button>
          <button
            className={`store-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ClipboardCheck size={16} />
            <span>Orders</span>
          </button>
          <button 
            className={`store-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="store-tab-content">
        <AnimatePresence mode="wait">
          {activeTab === 'inventory' && (
            <Motion.div
              key="inventory"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <InventoryTab inventory={inventory} loading={loading} />
            </Motion.div>
          )}
          {activeTab === 'transfers' && (
            <Motion.div
              key="transfers"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <TransfersTab
                transfers={transfers}
                loading={loading}
                onOpenReceiveModal={openReceiveModal}
                successMessage={transferToast}
                errorMessage={transferError}
              />
            </Motion.div>
          )}
          {activeTab === 'orders' && (
            <Motion.div
              key="orders"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <OrdersTab
                loading={ordersLoading}
                orders={storeOrders}
                filters={ordersFilters}
                onFiltersChange={(next) => setOrdersFilters((previous) => ({ ...previous, ...next }))}
                onConfirmIncoming={(order) => handleConfirmOrder(order, 'incoming')}
                onConfirmOutgoing={(order) => handleConfirmOrder(order, 'outgoing')}
                processingOrderId={processingOrderId}
                message={ordersMessage}
                error={ordersError}
              />
            </Motion.div>
          )}
          {activeTab === 'history' && (
            <Motion.div
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <HistoryTab machines={machines} />
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      <ReceiveShipmentModal
        open={receiveModalOpen}
        shipment={activeTransferForReceive}
        onClose={closeReceiveModal}
        onConfirm={handleConfirmTransferReceive}
        loading={Boolean(receivingTransferId)}
        error={transferError}
      />
    </Motion.div>
  );
}