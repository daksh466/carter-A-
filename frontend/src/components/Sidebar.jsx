import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useApp from "../hooks/useApp";
import { useNavigate } from "react-router-dom";
import { deleteStore } from "../services/api";

/**
 * Sidebar navigation for main app sections.
 * Collapsible, with active link highlight and branch selector.
 */
const navLinks = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Machines", to: "/dashboard/machines" },
  { label: "Spare Parts", to: "/dashboard/spares" },
  { label: "Orders", to: "/dashboard/orders" },
{ label: "Logistics", to: "/dashboard/logistics" },
  { label: "Alerts", to: "/dashboard/alerts" },
];

const Sidebar = () => {
  const { pathname } = useLocation();
  const { stores, selectedStore, setSelectedStore, totalAlerts } = useApp();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState(null);

  const handleDeleteStore = async (id) => {
    if (!window.confirm('Are you sure you want to delete this store?')) return;
    setDeletingId(id);
    const result = await deleteStore(id);
    if (result.success) {
      window.location.reload(); // Or trigger a state update/refetch
    } else {
      alert('Failed to delete store: ' + (result.error || 'Unknown error'));
    }
    setDeletingId(null);
  };

  return (
    <aside
      style={{
        width: 250,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        background: '#111',
        color: '#fff',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        zIndex: 100,
      }}
    >
      <div>
        <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 32, letterSpacing: 1, textAlign: 'center' }}>Carter A++</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                color: pathname === link.to ? '#6ea8fe' : '#fff',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 17,
                padding: '10px 0 10px 12px',
                borderRadius: 6,
                background: pathname === link.to ? 'rgba(110,168,254,0.08)' : 'none',
                transition: 'background 0.15s, color 0.15s',
                marginBottom: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {link.label}
              {link.label === "Alerts" && totalAlerts > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontWeight: 600,
                }}>
                  {totalAlerts}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
      <div style={{ marginTop: 32 }}>
        <label style={{ fontSize: 12, color: '#aaa', marginBottom: 6, display: 'block' }}>Store</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select 
            style={{ flex: 1, padding: 8, borderRadius: 6, border: 'none', background: '#222', color: '#fff', fontSize: 15 }}
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
          <button
            onClick={() => navigate('/add-store')}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            title="Add Store"
          >+
          </button>
        </div>
        <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>
          {stores.map(store => (
            <div key={store.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, color: '#eee', padding: '2px 0' }}>
              <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/store/${store.id}`)}>{store.name}</span>
              <button
                onClick={() => handleDeleteStore(store.id)}
                disabled={deletingId === store.id}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, cursor: deletingId === store.id ? 'not-allowed' : 'pointer', opacity: deletingId === store.id ? 0.6 : 1 }}
                title="Delete Store"
              >{deletingId === store.id ? 'Deleting...' : 'Delete'}</button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
