import React from 'react';

const SmartTable = ({ 
  data, 
  columns, 
  loading, 
  emptyText = "No data", 
  onRowClick,
  pinnedColumns = [],
  expandable = false,
  expandedId,
  setExpandedId,
  rowActions
}) => {
  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 8, padding: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="erp-skeleton" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 18, marginBottom: 6 }}>{emptyText}</div>
      </div>
    );
  }

  return (
    <div className="erp-table-wrap">
      <table className="erp-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th 
                key={col.key}
                className={pinnedColumns.includes(col.key) ? `erp-pin-${col.key}` : ''}
                style={col.style}
              >
                {col.title}
              </th>
            ))}
            <th style={{ width: 140 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
  {data.map((row) => {
            const rowId = String(row.id);
            const isExpanded = expandable && expandedId === rowId;
            const colData = columns.map(c => row[c.key] ?? '');

            return (
              <React.Fragment key={rowId}>
                <tr 
                  onClick={() => onRowClick?.(rowId)}
                  className="erp-row-hover"
                >
                  {colData.map((cell, cIdx) => (
                    <td 
                      key={cIdx}
                      className={pinnedColumns.includes(columns[cIdx].key) ? `erp-pin-${columns[cIdx].key}` : ''}
                      style={columns[cIdx].style}
                    >
                      {cell}
                    </td>
                  ))}
                  <td>
                    <div className="erp-row-actions">
                      {rowActions?.(row)}
                      {expandable && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? '' : rowId);
                          }}
                        >
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={columns.length + 1}>
                      <div className="erp-subcard">
                        {rowActions?.expanded?.(row)}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SmartTable;

