import React from "react";

/**
 * Reports page: shows bar and line charts, with filters.
 */
const Reports = () => {
  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold text-slate-900">Reports</h2>
        <div className="flex gap-2">
          <input type="date" className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm" />
          <select className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm">
            <option>All Stores</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-card p-6 flex flex-col">
          <div className="font-semibold mb-2 text-slate-700">Inventory by Category</div>
          <div className="h-64 flex items-center justify-center text-slate-400">
            {/* TODO: Insert Recharts BarChart here */}
            <span>No inventory report data available</span>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-6 flex flex-col">
          <div className="font-semibold mb-2 text-slate-700">Sales Over Time</div>
          <div className="h-64 flex items-center justify-center text-slate-400">
            {/* TODO: Insert Recharts LineChart here */}
            <span>No sales trend data available</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
