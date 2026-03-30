import React, { useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Plus, CheckCircle, 
         Package, Truck, Send } from 'lucide-react';
import { motion as Motion } from 'framer-motion';


const LogisticsQuickActions = ({
  onIncoming,
  onOutgoing, 
  onTransfer,
  onMarkReceived,
  className = ''
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if input/textarea focused or modifier keys
      if (e.target.matches('input, textarea, select') || 
          e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
        return;
      }

      const key = e.key.toLowerCase();
      switch (key) {
        case 'i':
          e.preventDefault();
          onIncoming?.();
          break;
        case 'o':
          e.preventDefault();
          onOutgoing?.();
          break;
        case 't':
          e.preventDefault();
          onTransfer?.();
          break;
        case 'r':
          e.preventDefault();
          onMarkReceived?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onIncoming, onOutgoing, onTransfer, onMarkReceived]);

  return (
    <Motion.div
      className={`
        sticky top-0 z-40 flex flex-wrap gap-3 p-4 px-6 bg-white/5 backdrop-blur-md 
        border-b border-white/10 shadow-lg ${className}
      `}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Motion.button
        title="Incoming Shipment (Shortcut: I)"
        onClick={onIncoming}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:brightness-105 active:scale-95"
      >
        <ArrowDownToLine className="h-4 w-4" />
        + Incoming
        <span className="ml-1 text-xs opacity-0 group-hover:opacity-100 transition">I</span>
      </Motion.button>

      <Motion.button
        title="Outgoing Shipment (Shortcut: O)"
        onClick={onOutgoing}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:brightness-105 active:scale-95"
      >
        <ArrowUpFromLine className="h-4 w-4" />
        + Outgoing  
        <span className="ml-1 text-xs opacity-0 group-hover:opacity-100 transition">O</span>
      </Motion.button>

      <Motion.button
        title="New Transfer (Shortcut: T)"
        onClick={onTransfer}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:brightness-105 active:scale-95"
      >
        <Plus className="h-4 w-4" />
        + Transfer
        <span className="ml-1 text-xs opacity-0 group-hover:opacity-100 transition">T</span>
      </Motion.button>

      <Motion.button
        title="Mark Received (Shortcut: R)"
        onClick={onMarkReceived}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:brightness-105 active:scale-95"
      >
        <CheckCircle className="h-4 w-4" />
        Mark Received
        <span className="ml-1 text-xs opacity-0 group-hover:opacity-100 transition">R</span>
      </Motion.button>

      <div className="ml-auto flex items-center gap-2 text-xs text-white/70 pl-4 border-l border-white/20">
        <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono">I O T R</kbd>
        <span>Quick Shortcuts</span>
      </div>
    </Motion.div>
  );
};

export default LogisticsQuickActions;

