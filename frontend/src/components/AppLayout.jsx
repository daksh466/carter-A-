import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import useApp from "../hooks/useApp";
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
  const { darkMode, toggleTheme } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const closeSidebar = () => setMobileSidebarOpen(false);

  return (
    <div className={`flex w-full h-screen overflow-hidden ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Sidebar */}
      <aside className={`
        transition-all duration-300 ease-in-out relative z-40
        ${sidebarCollapsed ? 'w-0' : 'w-64'}
        ${darkMode
          ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800'
          : 'bg-gradient-to-b from-white to-slate-100 border-r border-slate-200'}
      `}>
        <div className={`saas-sidebar-header flex items-center justify-between p-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="saas-brand-wrap flex items-center gap-3">
            <div className="saas-brand-dot w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 shadow-lg" />
            <h2 className={`saas-brand text-xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>Carter A++</h2>
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
                      : darkMode
                        ? "text-slate-400 hover:text-white hover:bg-slate-800/50 border-transparent"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 border-transparent"
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
        <header className={`saas-topbar flex items-center justify-between p-4 border-b backdrop-blur-sm sticky top-0 z-30 ${darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/80'}`}>
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
                className={`saas-theme-toggle px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${darkMode ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-300 hover:text-white' : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900'}`}
                onClick={toggleTheme}
              >
                {darkMode ? '☀️ Light' : '🌙 Dark'}
              </button>
            </div>
          </div>
          <div className="text-center">
            <h1 className={`saas-title text-2xl font-black bg-gradient-to-r bg-clip-text ${darkMode ? 'from-slate-100 to-slate-300' : 'from-slate-800 to-slate-600'}`}>Operations Console</h1>
            <p className={`saas-subtitle text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Live operations, inventory, and performance overview</p>
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

