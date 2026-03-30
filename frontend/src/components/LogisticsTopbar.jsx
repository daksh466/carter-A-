import React, { useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';

const LogisticsTopbar = ({ onIncoming, onOutgoing }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.matches('input, textarea, select, [contenteditable="true"]') || target.isContentEditable)
      ) {
        return;
      }

      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
        return;
      }

      const key = String(event.key || '').toLowerCase();
      if (key === 'i') {
        event.preventDefault();
        onIncoming?.();
      }
      if (key === 'o') {
        event.preventDefault();
        onOutgoing?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onIncoming, onOutgoing]);

  return (
    <div className="sticky top-0 z-40 rounded-2xl border border-white/15 bg-white/5 p-3 backdrop-blur-md shadow-[0_14px_36px_rgba(2,8,28,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Shipments</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={onIncoming}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-all duration-200 hover:shadow-lg"
            title="Incoming (I)"
          >
            <ArrowDown className="h-4 w-4" />
            <span>+ Incoming</span>
          </Motion.button>

          <Motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={onOutgoing}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-blue-300/25 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-100 transition-all duration-200 hover:shadow-lg"
            title="Outgoing (O)"
          >
            <ArrowUp className="h-4 w-4" />
            <span>+ Outgoing</span>
          </Motion.button>

        </div>
      </div>
    </div>
  );
};

export default LogisticsTopbar;
