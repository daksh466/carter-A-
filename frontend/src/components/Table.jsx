import React from "react";

export default function Table({ columns, data, loading, emptyText = "No data" }) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <span className="loader"></span>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="flex justify-center items-center h-40 text-gray-400">{emptyText}</div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl shadow-md bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.id || idx}
              className={
                idx % 2 === 0
                  ? "bg-white hover:bg-gray-50 transition"
                  : "bg-gray-50 hover:bg-gray-100 transition"
              }
            >
              {columns.map((col) => (
                <td key={col.key} className="px-6 py-4 whitespace-nowrap text-gray-800">
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
