import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteStore } from "../services/api";
import AddStore from "./AddStore";
import EditStore from "./EditStore";
import { Pencil, Plus, Store, Trash2 } from "lucide-react";
import useApp from "../hooks/useApp";
import { motion as Motion } from 'framer-motion';

export default function StoreList() {
  const { stores, loading, error, refreshStores } = useApp();
  const [backendDown, setBackendDown] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const navigate = useNavigate();

  const handleDelete = async id => {
    if (!window.confirm("Delete this store?")) return;
    const res = await deleteStore(id);
    if (res.success) {
      await refreshStores();
    } else {
      alert(res.error || "Delete failed");
    }
  };

  React.useEffect(() => {
    if (error && error.toLowerCase().includes('backend')) setBackendDown(true);
    else setBackendDown(false);
  }, [error]);

  return (
    <div className="store-page-wrap">
      {backendDown && (
        <div className="store-error-banner" style={{ background: '#fee2e2', color: '#991b1b', marginBottom: 16 }}>
          Backend unavailable
        </div>
      )}
      <div className="store-page-header">
        <div>
          <h2 className="store-page-title">Stores</h2>
          <p className="store-page-subtitle">Manage all store locations and contacts</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="saas-btn saas-btn-primary store-add-btn">
          <Plus size={16} />
          <span>{showAdd ? "Close" : "Add Store"}</span>
        </button>
      </div>
      {showAdd && <AddStore onSuccess={() => { setShowAdd(false); refreshStores(); }} onCancel={() => setShowAdd(false)} />}
      {editStore && <EditStore store={editStore} onSuccess={() => { setEditStore(null); refreshStores(); }} onCancel={() => setEditStore(null)} />}
      {loading ? (
        <div className="store-loader-wrap">
          <div className="saas-spinner" />
          <p>Loading stores...</p>
        </div>
      ) : (
        <>
          {error && <div className="store-error-banner">{error}</div>}

          {(!stores || stores.length === 0) ? (
            <div className="store-empty-state">
              <Store size={42} />
              <h3>No data available</h3>
              <p>Add your first store to begin tracking inventory by location.</p>
            </div>
          ) : (
            <div className="store-grid">
              {stores?.map((store, index) => (
                <Motion.div
                  key={store?._id || store?.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/dashboard/stores/${store?._id || store?.id}`)}
                  className="store-card"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/dashboard/stores/${store?._id || store?.id}`);
                    }
                  }}
                >
                  <div className="store-card-header">
                    <Store size={18} />
                    <h3 className="store-card-title">{store?.state || "Unknown Location"}</h3>
                  </div>

                  <div className="store-card-body">
                    <div className="store-field">
                      <span className="store-field-label">Store Head</span>
                      <span className="store-field-value">{store?.storeHead || store?.name || "-"}</span>
                    </div>
                    <div className="store-field">
                      <span className="store-field-label">Contact</span>
                      <span className="store-field-value">{store?.contact || store?.phone || "-"}</span>
                    </div>
                  </div>

                  <div className="store-actions" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); setEditStore(store); }} className="saas-btn saas-btn-warn store-action-btn" type="button">
                      <Pencil size={14} />
                      <span>Edit</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(store?._id || store?.id); }} className="saas-btn saas-btn-danger store-action-btn" type="button">
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </Motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
