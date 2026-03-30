import React, { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  Gauge,
  GitCompareArrows,
  Menu,
  PackageSearch,
  PackageCheck,
  Store,
  ArrowRightLeft,
  Warehouse,
  ChevronRight,
  ChevronLeft as ChevronLeftIcon,
} from "lucide-react";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/dashboard/machines", label: "Machines", icon: Boxes },
  { to: "/dashboard/spares", label: "Spare Parts", icon: PackageSearch },
  { to: "/dashboard/inventory", label: "Inventory", icon: Warehouse },
  { to: "/dashboard/shipments", label: "Shipments", icon: GitCompareArrows },
  { to: "/dashboard/transfers", label: "Transfers", icon: ArrowRightLeft },
  { to: "/dashboard/transfers/transit", label: "Confirm Transfers", icon: PackageCheck },
  { to: "/dashboard/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/dashboard/stores", label: "Stores", icon: Store },
];

const AppLayout = () => {
  const isDark = localStorage.getItem('darkMode') === 'true';
  const [darkMode, setDarkMode] = useState(isDark);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode') === 'true';
      document.documentElement.classList.toggle('dark', saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', darkMode);
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  const closeSidebar = () => setMobileSidebarOpen(false);

  return (
    <div className="flex w-full h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        transition-all duration-300 ease-in-out relative z-40
        ${sidebarCollapsed ? 'w-0' : 'w-64'}
        bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800
      `}>
        <div className="saas-sidebar-header flex items-center justify-between p-4 border-b border-slate-800">
          <div className="saas-brand-wrap flex items-center gap-3">
            <div className="saas-brand-dot w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 shadow-lg" />
            <h2 className="saas-brand text-xl font-bold text-white tracking-tight">Carter A++</h2>
          </div>
          <button 
            className="saas-sidebar-close p-1 rounded-lg hover:bg-slate-800 transition-colors" 
            onClick={() => setSidebarCollapsed(true)} 
            aria-label="Collapse sidebar"
          >
            <ChevronLeftIcon className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <nav className="saas-nav p-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/dashboard"}
                className={({ isActive }) =>
                  `saas-nav-link flex items-center gap-3 p-3 rounded-xl transition-all group ${
                    isActive
                      ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/40 text-white shadow-lg"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50 border-transparent"
                  }`
                }
                onClick={closeSidebar}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={18}
                      className={isActive ? "text-white shadow-sm" : "group-hover:scale-110"}
                    />
                    <span className="font-medium text-sm">{link.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="saas-topbar flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              className="saas-mobile-toggle p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all md:hidden" 
              onClick={() => setMobileSidebarOpen(true)} 
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>
            {!sidebarCollapsed && (
              <button
                className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all hidden md:flex items-center justify-center w-10 h-10"
                onClick={() => setSidebarCollapsed(true)}
                aria-label="Collapse sidebar"
              >
                <ChevronLeftIcon size={18} />
              </button>
            )}
            {sidebarCollapsed && (
              <button
                className="p-2 rounded-xl bg-blue-600/90 hover:bg-blue-500 border border-blue-500 text-white transition-all hidden md:flex items-center justify-center w-10 h-10 shadow-lg hover:shadow-xl"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <ChevronRight size={18} />
              </button>
            )}
            <div className="saas-topbar-actions flex items-center gap-2">
              <button
                className="saas-theme-toggle px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-sm font-medium text-slate-300 hover:text-white transition-all"
                onClick={() => setDarkMode(prev => !prev)}
              >
                {darkMode ? '☀️ Light' : '🌙 Dark'}
              </button>
            </div>
          </div>
          <div className="text-center">
            <h1 className="saas-title text-2xl font-black bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text">Operations Console</h1>
            <p className="saas-subtitle text-sm text-slate-400 mt-1">Live operations, inventory, and performance overview</p>
          </div>
          <div className="w-20" /> {/* Spacer for balance */}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-0 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={closeSidebar}
          aria-label="Close sidebar overlay"
        />
      )}
    </div>
  );
};

export default AppLayout;

