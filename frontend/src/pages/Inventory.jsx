import React, { useCallback, useEffect, useMemo, useState } from "react";
import useApp from "../hooks/useApp";
import { getSpareParts } from "../services/api";

const Inventory = () => {
  const { selectedStore, setSelectedStore, stores, machines, storeLoading } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");

  const selectedStoreName = useMemo(() => {
    const match = stores.find((store) => String(store.id || store._id) === String(selectedStore || ""));
    return match?.name || "";
  }, [stores, selectedStore]);

  const machineOptions = useMemo(
    () => (Array.isArray(machines) ? machines : []).map((machine, index) => ({
      id: String(machine?.id || machine?._id || `machine-${index}`),
      name: machine?.name || `Machine ${index + 1}`
    })),
    [machines]
  );

  const selectedMachineName = useMemo(() => {
    const match = machineOptions.find((machine) => machine.id === String(selectedMachineId || ""));
    return match?.name || "";
  }, [machineOptions, selectedMachineId]);

  const filteredItems = useMemo(() => {
    if (!selectedMachineId) return items;

    return items.filter((item) => {
      const linkedMachineIds = [
        ...(Array.isArray(item.machine_ids) ? item.machine_ids : []),
        ...(Array.isArray(item.machines)
          ? item.machines.map((machine) => machine?.id || machine?._id)
          : []),
        item.machine_id,
        item.machineId,
      ]
        .map((id) => String(id || "").trim())
        .filter(Boolean);

      return linkedMachineIds.includes(String(selectedMachineId));
    });
  }, [items, selectedMachineId]);

  const loadInventory = useCallback(async ({ silent = false } = {}) => {
    if (!selectedStore) {
      setItems([]);
      setError("");
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await getSpareParts({ storeId: selectedStore });
      if (!response.success) {
        setItems([]);
        setError(response.error || "Failed to load inventory.");
        return;
      }

      setItems(Array.isArray(response.data) ? response.data : []);
      setError("");
    } catch (err) {
      setItems([]);
      setError(err?.message || "Failed to load inventory.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    setSelectedMachineId("");
  }, [selectedStore]);

  useEffect(() => {
    const handleInventoryUpdate = (event) => {
      const updatedStoreIds = event?.detail?.storeIds || [];
      if (!selectedStore || updatedStoreIds.length === 0 || updatedStoreIds.includes(selectedStore)) {
        loadInventory({ silent: true });
      }
    };

    window.addEventListener("inventory:updated", handleInventoryUpdate);
    return () => window.removeEventListener("inventory:updated", handleInventoryUpdate);
  }, [loadInventory, selectedStore]);

  if (loading) {
    return (
      <section className="card" style={{ minHeight: 260, display: "grid", placeItems: "center", gap: 10 }}>
        <div className="saas-spinner" />
        <p style={{ color: "#cbd5e1" }}>Loading inventory...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card" style={{ minHeight: 240, display: "grid", placeItems: "center", gap: 12 }}>
        <p style={{ color: "#fecaca" }}>{error}</p>
        <button className="saas-btn saas-btn-primary" style={{ padding: "8px 12px" }} onClick={() => loadInventory()}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 24 }}>Inventory</h2>
          <p style={{ marginTop: 4, color: "#94a3b8", fontSize: 13 }}>
            {selectedStoreName ? `${selectedStoreName} stock overview` : "Stock overview"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={selectedStore || ""}
            onChange={(event) => setSelectedStore(event.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(148, 163, 184, 0.45)",
              background: "rgba(15, 23, 42, 0.45)",
              color: "#e2e8f0",
              minWidth: 220,
            }}
          >
            <option value="">Select Store</option>
            {stores.map((store, index) => {
              const storeId = String(store?.id || store?._id || `store-${index}`);
              return (
                <option key={storeId} value={storeId}>
                  {store?.name || `Store ${index + 1}`}
                </option>
              );
            })}
          </select>
          <button
            className="saas-btn"
            style={{ padding: "8px 12px" }}
            type="button"
            onClick={() => loadInventory({ silent: true })}
            disabled={refreshing || !selectedStore}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {!selectedStore ? (
        <div style={{ minHeight: 160, display: "grid", placeItems: "center", color: "#94a3b8" }}>
          Select a store to view machines and spare parts.
        </div>
      ) : (
        <>
          <div
            style={{
              marginBottom: 12,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Machines:</span>
            <button
              type="button"
              onClick={() => setSelectedMachineId("")}
              style={{
                borderRadius: 999,
                border: selectedMachineId ? "1px solid rgba(148, 163, 184, 0.45)" : "1px solid rgba(59, 130, 246, 0.7)",
                background: selectedMachineId ? "rgba(15, 23, 42, 0.35)" : "rgba(29, 78, 216, 0.25)",
                color: "#e2e8f0",
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              All Machines
            </button>
            {storeLoading && machineOptions.length === 0 ? (
              <span style={{ color: "#94a3b8", fontSize: 12 }}>Loading machines...</span>
            ) : machineOptions.length === 0 ? (
              <span style={{ color: "#94a3b8", fontSize: 12 }}>No machines found for this store.</span>
            ) : (
              machineOptions.map((machine) => (
                <button
                  key={machine.id}
                  type="button"
                  onClick={() => setSelectedMachineId(machine.id)}
                  style={{
                    borderRadius: 999,
                    border: selectedMachineId === machine.id ? "1px solid rgba(59, 130, 246, 0.7)" : "1px solid rgba(148, 163, 184, 0.45)",
                    background: selectedMachineId === machine.id ? "rgba(29, 78, 216, 0.25)" : "rgba(15, 23, 42, 0.35)",
                    color: "#e2e8f0",
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {machine.name}
                </button>
              ))
            )}
          </div>

          {filteredItems.length === 0 ? (
        <div style={{ minHeight: 180, display: "grid", placeItems: "center", color: "#94a3b8" }}>
          {selectedMachineId
            ? `No spare parts found for ${selectedMachineName || "selected machine"}.`
            : "No inventory items found for this store."}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.25)", color: "#93c5fd", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Item</th>
                <th style={{ padding: "10px 8px" }}>Size</th>
                <th style={{ padding: "10px 8px" }}>Used In Machine(s)</th>
                <th style={{ padding: "10px 8px" }}>Quantity</th>
                <th style={{ padding: "10px 8px" }}>Min Required</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => {
                const quantity = Number(item.availableQty ?? item.available_qty ?? item.quantity ?? item.quantity_available ?? item.stockQuantity ?? 0);
                const minRequired = Number(item.minRequired ?? item.min_required ?? item.minimumRequired ?? item.minimum_required ?? 0);
                const size = item.size ?? "N/A";
                const isLow = minRequired > 0 && quantity < minRequired;
                const machineNames = [
                  ...(Array.isArray(item.machine_names) ? item.machine_names : []),
                  ...(Array.isArray(item.machines)
                    ? item.machines.map((machine) => machine?.name).filter(Boolean)
                    : []),
                  item.machineName,
                  item.machine_name
                ]
                  .map((name) => String(name || "").trim())
                  .filter(Boolean)
                  .filter((name, nameIndex, list) => list.indexOf(name) === nameIndex);

                return (
                  <tr
                    key={String(item.id || item._id || item.itemCode || item.name || `inv-${index}`)}
                    style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.15)" }}
                  >
                    <td style={{ padding: "12px 8px", color: "#f8fafc" }}>{item.itemName || item.name || "-"}</td>
                    <td style={{ padding: "12px 8px", color: "#e2e8f0" }}>{size}</td>
                    <td style={{ padding: "12px 8px", color: "#e2e8f0" }}>
                      {machineNames.length > 0 ? machineNames.join(", ") : "-"}
                    </td>
                    <td style={{ padding: "12px 8px", color: "#e2e8f0" }}>{quantity}</td>
                    <td style={{ padding: "12px 8px", color: "#e2e8f0" }}>{minRequired}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          border: isLow ? "1px solid rgba(248, 113, 113, 0.45)" : "1px solid rgba(74, 222, 128, 0.35)",
                          background: isLow ? "rgba(127, 29, 29, 0.4)" : "rgba(20, 83, 45, 0.3)",
                          color: isLow ? "#fecaca" : "#bbf7d0"
                        }}
                      >
                        {isLow ? "Low Stock" : "Healthy"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </section>
  );
};

export default Inventory;
