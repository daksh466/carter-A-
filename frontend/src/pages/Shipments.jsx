import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../hooks/useApp';
import { getTransfers } from '../services/api';
import IncomingShipmentDrawer from '../components/IncomingShipmentDrawer.jsx';
import OutgoingShipmentDrawer from '../components/OutgoingShipmentDrawer.jsx';
import ShipmentChart from '../components/charts/ShipmentsChart.jsx';
import { Building2, Package, ChevronDown, Truck, Plus } from 'lucide-react';

const Shipments = () => {
  const { stores } = useApp();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStoreId, setActiveStoreId] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [timeRange, setTimeRange] = useState(7);
  const [incomingDrawerOpen, setIncomingDrawerOpen] = useState(false);
  const [outgoingDrawerOpen, setOutgoingDrawerOpen] = useState(false);
  const storeDropdownRef = useRef(null);

  const selectedStore = useMemo(
    () => stores.find((store) => String(store.id || store._id) === String(activeStoreId)) || null,
    [stores, activeStoreId]
  );

  const loadTransfers = useCallback(async () => {
    if (!activeStoreId) {
      setTransfers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await getTransfers({ storeId: activeStoreId });
      setTransfers(response.success ? (response.data || []) : []);
    } catch (error) {
      console.error('Failed to load transfers:', error);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const filteredStores = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();
    return stores.filter((store) => {
      if (!query) return true;
      return String(store.name || '').toLowerCase().includes(query);
    });
  }, [stores, storeSearch]);

  useEffect(() => {
    setStoreSearch(selectedStore?.name || '');
  }, [selectedStore]);

  useEffect(() => {
    if (!storeMenuOpen) return;
    const handleOutsideClick = (event) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target)) {
        setStoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [storeMenuOpen]);

  const chartData = useMemo(() => {
    if (!activeStoreId) return [];
    const points = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let offset = timeRange - 1; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - offset);
      const key = date.toISOString().split('T')[0];
      points.push({
        key,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        incoming: 0,
        outgoing: 0,
        delivered: 0
      });
    }
    const pointMap = new Map(points.map((point) => [point.key, point]));
    for (const transfer of transfers) {
      const sourceDate = transfer.dispatchDate || transfer.createdAt;
      if (!sourceDate) continue;
      const day = new Date(sourceDate);
      if (Number.isNaN(day.getTime())) continue;
      const key = day.toISOString().split('T')[0];
      const bucket = pointMap.get(key);
      if (!bucket) continue;
      const direction = transfer.toStoreId === activeStoreId ? 'incoming' : 'outgoing';
      bucket[direction] += 1;
      if (['completed', 'received'].includes(String(transfer.status || '').toLowerCase())) {
        bucket.delivered += 1;
      }
    }
    return points;
  }, [activeStoreId, timeRange, transfers]);

  const shipmentSummary = useMemo(() => {
    const total = transfers.length;
    let incoming = 0;
    let outgoing = 0;
    let delivered = 0;

    for (const transfer of transfers) {
      if (String(transfer.toStoreId || '') === String(activeStoreId)) {
        incoming += 1;
      } else {
        outgoing += 1;
      }

      if (['completed', 'received'].includes(String(transfer.status || '').toLowerCase())) {
        delivered += 1;
      }
    }

    return { total, incoming, outgoing, delivered };
  }, [transfers, activeStoreId]);

  const handleIncomingCreated = async () => {
    await loadTransfers();
  };

  const handleOutgoingCreated = async () => {
    await loadTransfers();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-600/10 animate-pulse" />
      
      <div className="relative z-10 max-w-7xl mx-auto p-8">
        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-2xl mb-4">
            Shipments 🚚
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Track and manage all shipments across stores
          </p>
        </Motion.div>

        <Motion.section
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-r from-[#0d1f4f]/90 via-[#1b1f5a]/85 to-[#34145e]/85 shadow-[0_25px_90px_rgba(11,16,45,0.6)] backdrop-blur-xl p-4 sm:p-7"
        >
          <div className="pointer-events-none absolute -left-24 -top-20 h-52 w-52 rounded-full bg-blue-400/30 blur-3xl" />
          <div className="pointer-events-none absolute right-4 top-1 h-36 w-36 rounded-full bg-violet-400/25 blur-3xl" />
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="relative z-10">
              <div className="absolute -left-3 top-3 h-14 w-14 rounded-full bg-violet-400/25 blur-2xl" />
              <h1 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Shipments</h1>
              <p className="mt-2 text-sm text-blue-100/90 sm:text-base">Track and manage all shipments across stores</p>
            </div>
            <div className="relative z-10 rounded-xl border border-white/20 bg-white/10 p-2.5 shadow-lg backdrop-blur">
              <Building2 className="h-5 w-5 text-blue-100" />
            </div>
          </div>

          <div className="relative z-10 mt-6 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:mt-7 sm:p-5">
            <label className="mb-2 block text-sm font-semibold text-slate-100">Select Store</label>
            <div ref={storeDropdownRef} className="relative max-w-xl">
              <div className="group flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-slate-900/35 px-3 shadow-[0_8px_30px_rgba(8,11,30,0.55)] transition duration-200 focus-within:border-blue-300/70 focus-within:ring-2 focus-within:ring-blue-300/20">
                <Package className="h-4 w-4 text-blue-200" />
                <input
                  value={storeSearch}
                  onChange={(event) => {
                    setStoreSearch(event.target.value);
                    setStoreMenuOpen(true);
                  }}
                  onFocus={() => setStoreMenuOpen(true)}
                  placeholder="Search or select store"
                  className="h-full w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-300/70 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setStoreMenuOpen((open) => !open)}
                  className="rounded-md p-1 text-slate-300 transition hover:bg-white/10"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <AnimatePresence>
                {storeMenuOpen && (
                  <Motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-white/15 bg-[#0d1b3f]/95 p-1 shadow-[0_24px_50px_rgba(5,10,30,0.7)] backdrop-blur-xl"
                  >
                    {filteredStores.length > 0 ? (
                      filteredStores.map((store) => {
                        const storeId = String(store.id || store._id);
                        const active = storeId === activeStoreId;
                        return (
                          <button
                            key={storeId}
                            type="button"
                            onClick={() => {
                              setActiveStoreId(storeId);
                              setStoreSearch(store.name || '');
                              setStoreMenuOpen(false);
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${active ? 'bg-blue-500/20 text-blue-100' : 'text-slate-100 hover:bg-white/10'}`}
                          >
                            {store.name}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-4 text-sm text-slate-300">No stores match this search.</div>
                    )}
                  </Motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.9)]" />
              <span className="text-emerald-100/90">📍 Showing data for:</span>
              <span>{selectedStore?.name || 'None'}</span>
            </div>
          </div>
        </Motion.section>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        {!activeStoreId ? (
          <Motion.section
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="rounded-2xl border border-white/15 bg-white/5 p-8 text-center shadow-[0_24px_70px_rgba(4,8,30,0.45)] backdrop-blur-xl sm:p-14"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-blue-500/10 sm:h-20 sm:w-20">
              <Truck className="h-9 w-9 text-blue-200 sm:h-11 sm:w-11" />
            </div>
            <p className="mt-6 text-2xl font-bold tracking-tight text-white">No Store Selected</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300 sm:text-base">Select a store to view analytics</p>
          </Motion.section>
        ) : (
          <>
            <section className="rounded-2xl border border-white/15 bg-white/5 p-4 shadow-[0_18px_55px_rgba(5,10,30,0.45)] backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setIncomingDrawerOpen(true)}
                  className="ship-ui-btn ship-ui-btn-success group inline-flex h-10 w-full px-4 text-sm sm:w-auto"
                >
                  <Plus className="h-4 w-4 transition group-hover:rotate-90" />
                  Add Incoming
                </Motion.button>
                <Motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setOutgoingDrawerOpen(true)}
                  className="ship-ui-btn ship-ui-btn-primary group inline-flex h-10 w-full px-4 text-sm sm:w-auto"
                >
                  <Plus className="h-4 w-4 transition group-hover:rotate-90" />
                  Add Outgoing
                </Motion.button>
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="ship-ui-section-title">Shipment Analytics</h2>
                  <p className="mt-1 text-sm text-slate-300">Incoming vs Outgoing trend for {selectedStore?.name}</p>
                </div>
                <div className="inline-flex rounded-lg border border-white/20 bg-white/10 p-1 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setTimeRange(7)}
                    className={`ship-ui-chip ${timeRange === 7 ? 'active' : ''}`}
                  >
                    7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeRange(30)}
                    className={`ship-ui-chip ${timeRange === 30 ? 'active' : ''}`}
                  >
                    30 Days
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="h-[280px] animate-pulse rounded-xl border border-white/10 bg-slate-200/10" />
              ) : chartData.length === 0 ? (
                <div className="h-[280px] rounded-xl border border-white/10 bg-[#0b132f]/60 flex items-center justify-center">
                  <p className="text-slate-400">No data for selected period</p>
                </div>
              ) : (
                <div className="h-[280px] rounded-xl border border-white/10 bg-[#0b132f]/60 p-2">
                  <ShipmentChart data={chartData} />
                </div>
              )}
            </section>

            <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-sky-300/25 bg-gradient-to-br from-sky-500/20 to-sky-800/20 p-4 shadow-[0_14px_35px_rgba(2,18,45,0.35)]">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-100/80">Total Shipments</p>
                <p className="ship-ui-kpi-value">{shipmentSummary.total}</p>
              </div>
              <div className="rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-500/20 to-emerald-800/20 p-4 shadow-[0_14px_35px_rgba(2,24,28,0.35)]">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100/80">Incoming</p>
                <p className="ship-ui-kpi-value">{shipmentSummary.incoming}</p>
              </div>
              <div className="rounded-2xl border border-blue-300/25 bg-gradient-to-br from-blue-500/20 to-blue-800/20 p-4 shadow-[0_14px_35px_rgba(6,22,58,0.35)]">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-100/80">Outgoing</p>
                <p className="ship-ui-kpi-value">{shipmentSummary.outgoing}</p>
              </div>
              <div className="rounded-2xl border border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-800/20 p-4 shadow-[0_14px_35px_rgba(37,14,53,0.34)]">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-100/80">Delivered</p>
                <p className="ship-ui-kpi-value">{shipmentSummary.delivered}</p>
              </div>
            </section>

            <div className="mt-8 p-6 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl">
              <h3 className="text-xl font-bold text-white mb-4">Recent Shipments</h3>
              {transfers.length === 0 ? (
                <p className="text-slate-400">No recent shipments</p>
              ) : (
                <div className="space-y-3">
                  {transfers.slice(0, 5).map((transfer) => (
                    <div key={transfer.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-gradient-to-r from-white/10 to-white/5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-300/25">
                          <Package className="h-6 w-6 text-blue-300" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{transfer.items?.[0]?.itemName || 'Shipment Items'}</p>
                          <p className="text-sm text-slate-300">{transfer.fromStoreName || 'Source'} to {transfer.toStoreName || transfer.toExternalName || 'Destination'}</p>
                        </div>
                      </div>
                      <div>
                        <span className="ship-ui-pill">
                          {transfer.status || 'In Transit'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

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
      </div>
    </div>
  );
};

export default Shipments;
