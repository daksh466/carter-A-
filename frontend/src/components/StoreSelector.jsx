import React from "react";
import "../index.css";
import useApp from "../hooks/useApp";

const StoreSelector = ({ onSelect }) => {
  const { stores, selectedStore } = useApp();
  React.useEffect(() => {
    console.log('[StoreSelector] stores:', stores);
    console.log('[StoreSelector] selectedStore:', selectedStore);
  }, [stores, selectedStore]);
  return (
    <div className="store-selector">
      <label className="store-label">Select Store:</label>
      <select
        className="store-dropdown"
        value={selectedStore || ""}
        onChange={e => onSelect && onSelect(e.target.value)}
      >
        <option value="" disabled>Select...</option>
        {stores.map(store => (
          <option key={store.id || store} value={store.id || store}>
            {store.name || store}
          </option>
        ))}
      </select>
    </div>
  );
};

export default StoreSelector;
