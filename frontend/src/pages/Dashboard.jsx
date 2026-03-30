import React, { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Cog,
  Package,
  Sparkles,
  Activity,
  Box,
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart2,
  PieChart,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import useApp from "../hooks/useApp";

// Premium SaaS Progress Bar Component
const ProgressBar = ({ value = 0, max = 100, color = "emerald", label }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const colors = {
    emerald: "bg-gradient-to-r from-emerald-400 to-green-500",
    amber: "bg-gradient-to-r from-amber-400 to-yellow-500",
    red: "bg-gradient-to-r from-red-400 to-rose-500",
    blue: "bg-gradient-to-r from-blue-400 to-sky-500",
  };
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs font-medium text-slate-400 w-16">{label}</span>}
      <div className="flex-1 bg-slate-800/50 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ${colors[color] || colors.emerald}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-300 w-12 text-right">{value}/{max}</span>
    </div>
  );
};

// Premium Card Wrapper
const PremiumCard = ({ title, children, className = "", action }) => (
  <div className="bg-gradient-to-b from-slate-800/95 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl hover:border-blue-500/30 transition-all duration-300">
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700/50">
      <h3 className="text-lg font-black bg-gradient-to-r from-slate-200 to-slate-100 bg-clip-text">{title}</h3>
      {action}
    </div>
    <div className={className}>{children}</div>
  </div>
);

const Dashboard = () => {
  const {
    stores = [],
    machines = [],
    spareParts = [],
    orders = [],
    transfers = [],
    lowStockMachines = [],
    lowStockSpareParts = [],
    loading,
    storeLoading,
    error,
    storeError,
  } = useApp();

  // ... (keep all existing useMemo logic for activeLocations, highPrioritySpares, criticalSpares, totalInventoryValue, topSparesDemand, usageTrends, inventoryDistribution, recentTransfers, transferSummary, ordersSummary)
  const highPrioritySpares = useMemo(() => spareParts.filter(part => ["high", "critical", "urgent", "p1"].includes(String(part.importance ?? part.priority ?? part.criticality ?? "").toLowerCase())), [spareParts]);
  const criticalSpares = useMemo(() => lowStockSpareParts.filter(part => highPrioritySpares.some(hp => String(hp.id ?? hp._id) === String(part.id ?? part._id))).length, [highPrioritySpares, lowStockSpareParts]);
  const totalInventoryValue = useMemo(() => spareParts.reduce((sum, part) => {
    const qty = Number(part.quantity ?? part.stock ?? 0) || 0;
    const cost = Number(part.purchase_cost ?? part.purchaseCost ?? part.cost ?? part.costPrice ?? part.unitPrice ?? 0) || 0;
    return sum + qty * cost;
  }, 0), [spareParts]);
  const topSparesDemand = useMemo(() => {
    const demand = new Map();
    for (const order of orders) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const name = String(item.itemName ?? item.name ?? item.sparePartName ?? "Unknown");
        const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
        demand.set(name, (demand.get(name) || 0) + qty);
      }
    }
    if (demand.size === 0) return lowStockSpareParts.slice(0, 5).map(part => ({ name: String(part.name ?? "Unknown"), value: Number(part.minimumRequired ?? part.minRequired ?? 1) || 1 }));
    return [...demand.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [orders, lowStockSpareParts]);
  const usageTrends = useMemo(() => {
    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const monthBuckets = labels.map(label => ({ label, usage: 0 }));
    for (const order of orders) {
      const date = new Date(order.createdAt ?? order.date ?? Date.now());
      const month = date.getMonth();
      const bucketIndex = month % 6;
      const items = Array.isArray(order.items) ? order.items : [];
      const totalQty = items.reduce((s, item) => s + (Number(item.quantity ?? item.qty ?? 1) || 1), 0);
      monthBuckets[bucketIndex].usage += totalQty;
    }
    return monthBuckets;
  }, [orders]);
  const inventoryDistribution = useMemo(() => {
    const buckets = { Critical: 0, Low: 0, Healthy: 0, Surplus: 0 };
    for (const part of spareParts) {
      const qty = Number(part.quantity ?? part.stock ?? 0) || 0;
      const min = Number(part.minimumRequired ?? part.minRequired ?? 5) || 5;
      if (qty <= min) buckets.Critical += 1;
      else if (qty <= Math.ceil(min * 1.5)) buckets.Low += 1;
      else if (qty <= min * 3) buckets.Healthy += 1;
      else buckets.Surplus += 1;
    }
    return [
      { name: "Critical", value: buckets.Critical, fill: "#ef4444" },
      { name: "Low", value: buckets.Low, fill: "#f59e0b" },
      { name: "Healthy", value: buckets.Healthy, fill: "#22c55e" },
      { name: "Surplus", value: buckets.Surplus, fill: "#38bdf8" },
    ];
  }, [spareParts]);
  const recentTransfers = useMemo(() => [...transfers].sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()).slice(0, 5), [transfers]);
  const transferSummary = useMemo(() => {
    let incoming = 0, outgoing = 0, inTransit = 0;
    for (const transfer of transfers) {
      const direction = String(transfer.direction ?? transfer.type ?? transfer.transferType ?? "").toLowerCase();
      if (direction.includes("in")) incoming += 1;
      if (direction.includes("out")) outgoing += 1;
      const status = String(transfer.status ?? "").toLowerCase();
      if (["pending", "in-transit", "in transit", "approved"].includes(status)) inTransit += 1;
    }
    return { incoming, outgoing, inTransit };
  }, [transfers]);
  const ordersSummary = useMemo(() => {
    const total = orders.length;
    const paid = orders.filter(order => order.paymentStatus === "Paid").length;
    const pending = total - paid;
    const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount ?? order.price ?? 0), 0);
    return { total, paid, pending, totalAmount };
  }, [orders]);

  const chartTooltipStyle = {
    background: "rgba(15, 23, 42, 0.98)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: 12,
    color: "#e2e8f0",
    fontSize: 13,
    padding: "12px 16px",
  };

  if (loading || storeLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-2xl border-4 border-cyan-500/30 border-t-cyan-500 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Loading Dashboard Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen px-6 py-4">
      <div className="grid grid-cols-12 gap-4 w-full">
        
        {/* PHASE 2: TOP KPI GRID */}
        <div className="col-span-full grid grid-cols-12 gap-4">
          <div className="col-span-3 bg-slate-800 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Total Stores</p>
            <h2 className="text-2xl font-bold">{stores.length.toLocaleString()}</h2>
          </div>
          <div className="col-span-3 bg-slate-800 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Machines</p>
            <h2 className="text-2xl font-bold">{machines.length.toLocaleString()}</h2>
          </div>
          <div className="col-span-3 bg-slate-800 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Inventory Value</p>
            <h2 className="text-2xl font-bold">${(totalInventoryValue / 1000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}K</h2>
          </div>
          <div className="col-span-3 bg-slate-800 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Critical Spares</p>
            <h2 className="text-2xl font-bold">{criticalSpares}</h2>
          </div>
        </div>

        {/* MAIN GRID PHASE 3 */}
        <div className="col-span-full grid grid-cols-12 gap-4 items-start w-full">
        <div className="col-span-8 min-w-0">
          <div className="space-y-8">
          
          {/* Inventory Insights - Top Items + Charts */}
          <PremiumCard title="Inventory Intelligence">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div>
                <h4 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wide">Top Demand Spares</h4>
                <div className="space-y-3">
                  {topSparesDemand.slice(0,6).map((item, i) => (
                    <div key={i} className="group flex items-center justify-between p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/80 transition-all">
                      <span className="text-sm font-semibold text-slate-200 min-w-0 truncate">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <ProgressBar value={item.value} max={50} color="blue" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={usageTrends}>
                        <defs><linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.1)" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                        <YAxis tickLine={false} axisLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Area type="monotone" dataKey="usage" stroke="#3b82f6" strokeWidth={3} fill="url(#usageGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={inventoryDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3}>
                          {inventoryDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </PremiumCard>

          {/* Orders Overview */}
          <PremiumCard title="Orders & Revenue">
            <div className="grid grid-cols-4 gap-6 p-1">
              <div className="text-center p-6 bg-gradient-to-b from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 rounded-xl">
                <p className="text-sm text-emerald-400 font-semibold uppercase tracking-wide mb-2">Total Orders</p>
                <p className="text-3xl font-black text-emerald-300">{ordersSummary.total}</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-b from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-blue-400 font-semibold uppercase tracking-wide mb-2">Revenue</p>
                <p className="text-3xl font-black text-blue-300">${(ordersSummary.totalAmount/1000).toFixed(1)}K</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-b from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl">
                <p className="text-sm text-amber-400 font-semibold uppercase tracking-wide mb-2">Pending</p>
                <p className="text-3xl font-black text-amber-300">{ordersSummary.pending}</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-b from-slate-500/10 to-slate-600/5 border border-slate-500/30 rounded-xl">
                <p className="text-sm text-slate-400 font-semibold uppercase tracking-wide mb-2">Paid</p>
                <p className="text-3xl font-black text-slate-200">{ordersSummary.paid}</p>
              </div>
            </div>
          </PremiumCard>

          </div>
        </div>

        {/* Right Sidebar col-span-4 */}
        <div className="col-span-4 min-w-0">
          <div className="space-y-8">
          
          {/* Alerts Panel */}
          <PremiumCard title="Live Alerts">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-500/10 to-red-600/5 border border-red-500/30 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="font-bold text-slate-200">Critical Stock Alerts</p>
                  <p className="text-sm text-slate-400">{lowStockSpareParts.length + lowStockMachines.length} items below threshold</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl text-center">
                  <p className="text-2xl font-black text-amber-300 mb-1">{highPrioritySpares.length}</p>
                  <p className="text-xs text-amber-400 uppercase tracking-wide">High Priority</p>
                </div>
                <div className="p-3 bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 rounded-xl text-center">
                  <p className="text-2xl font-black text-emerald-300 mb-1">{transferSummary.inTransit}</p>
                  <p className="text-xs text-emerald-400 uppercase tracking-wide">In Transit</p>
                </div>
              </div>
            </div>
          </PremiumCard>

          {/* Recent Activity */}
          <PremiumCard title="Recent Activity">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {recentTransfers.map((transfer, i) => (
                <div key={i} className="group flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800/80 rounded-xl transition-all border border-slate-700/50 hover:border-slate-600/50">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-sky-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ArrowUpRight className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{transfer.transferCode ?? `Transfer #${i+1}`}</p>
                    <p className="text-sm text-slate-500 truncate">{transfer.fromStoreName || '-'} → {transfer.toStoreName || '-'}</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full whitespace-nowrap">
                    {transfer.status ?? 'Pending'}
                  </span>
                </div>
              ))}
              {recentTransfers.length === 0 && (
                <p className="text-center py-8 text-slate-500 text-sm">No recent transfers</p>
              )}
            </div>
          </PremiumCard>

          {/* Critical Items */}
          <PremiumCard title="Critical Items">
            <div className="space-y-4">
              <div>
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Low Stock Spares</h5>
                {lowStockSpareParts.slice(0,3).map((part, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-300 truncate max-w-[140px]">{part.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${part.priority === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        Critical
                      </span>
                    </div>
                    <ProgressBar value={Number(part.quantity ?? 0)} max={Number(part.minimumRequired ?? 10)} color={Number(part.quantity ?? 0) < 3 ? 'red' : 'amber'} />
                  </div>
                ))}
              </div>
            </div>
          </PremiumCard>
          </div>
        </div>
        </div>
      </div>

      {(error || storeError) && (
        <div className="mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300">{error || storeError}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

