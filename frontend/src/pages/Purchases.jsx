import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Cpu, Eye, Plus, Trash2, X } from "lucide-react";
import useApp from "../hooks/useApp";

const pageCardStyle = {
  background: "linear-gradient(135deg, rgba(15, 23, 42, 0.78), rgba(17, 24, 39, 0.62))",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: 18,
  backdropFilter: "blur(14px)",
  boxShadow: "0 18px 42px rgba(2, 6, 23, 0.32)",
};

const buildInitialLine = (storeId = "") => ({
  itemType: "Spare Part",
  spare_id: "",
  name: "",
  machine_id: "",
  store_id: storeId,
  quantity: 1,
  unitPrice: "",
});

const getEntityId = (entity) => String(entity?.id ?? entity?._id ?? "").trim();

const getPartMachineIds = (part) => {
  if (!part) return [];
  const ids = [
    ...(Array.isArray(part.machine_ids) ? part.machine_ids : []),
    ...(Array.isArray(part.machines)
      ? part.machines.map((machine) => machine?.id ?? machine?._id)
      : []),
    part.machine_id,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return [...new Set(ids)];
};

const Purchases = () => {
  const {
    stores,
    machines,
    selectedStore,
    setSelectedStore,
    spareParts,
    purchases,
    purchasesLoading,
    purchasesError,
    createPurchaseLoading,
    createPurchaseError,
    deletePurchaseLoading,
    handleCreatePurchaseOrder,
    handleDeletePurchaseOrder,
    refreshPurchases,
  } = useApp();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activePurchase, setActivePurchase] = useState(null);
  const [filters, setFilters] = useState({
    storeId: selectedStore || "",
    fromDate: "",
    toDate: "",
    sparePartId: "",
  });

  const [formData, setFormData] = useState({
    supplier: "",
    purchasedBy: "",
    poDate: new Date().toISOString().slice(0, 10),
    notes: "",
    items: [buildInitialLine(selectedStore || "")],
  });
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    const query = {
      storeId: filters.storeId || selectedStore || undefined,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      sparePartId: filters.sparePartId || undefined,
    };
    refreshPurchases(query);
    // refreshPurchases identity is recreated by context; filter inputs are the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.storeId, filters.fromDate, filters.toDate, filters.sparePartId, selectedStore]);

  const storeMap = useMemo(() => {
    const map = new Map();
    stores.forEach((store) => {
      map.set(getEntityId(store), store.storeHead || store.name || "Store");
    });
    return map;
  }, [stores]);

  const machineMap = useMemo(() => {
    const map = new Map();
    (machines || []).forEach((machine, index) => {
      const machineId = getEntityId(machine);
      if (!machineId) return;
      map.set(machineId, machine?.name || `Machine ${index + 1}`);
    });
    return map;
  }, [machines]);

  const sparePartMap = useMemo(() => {
    const map = new Map();
    spareParts.forEach((part) => {
      map.set(getEntityId(part), part);
    });
    return map;
  }, [spareParts]);

  const sortedPurchases = useMemo(() => {
    return [...purchases].sort((a, b) => new Date(b.poDate || b.createdAt) - new Date(a.poDate || a.createdAt));
  }, [purchases]);

  const calculateTotal = useMemo(() => {
    return formData.items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unitPrice || 0);
      return sum + qty * price;
    }, 0);
  }, [formData.items]);

  const onFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const onFormChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationErrors([]);
  };

  const onItemChange = (index, field, value) => {
    setFormData((prev) => {
      const nextItems = [...prev.items];
      const target = { ...nextItems[index], [field]: value };

      if (field === "spare_id") {
        const selectedPart = sparePartMap.get(value);
        const partMachineIds = getPartMachineIds(selectedPart);
        target.name = selectedPart?.name || "";
        target.machine_id = partMachineIds[0] || "";
        target.store_id = selectedStore || selectedPart?.store_id || "";
      }

      nextItems[index] = target;
      return { ...prev, items: nextItems };
    });
    setValidationErrors([]);
  };

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, buildInitialLine(selectedStore || "")],
    }));
  };

  const removeLineItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.supplier.trim()) errors.push("Supplier Name is required");
    if (!formData.purchasedBy.trim()) errors.push("Purchased By is required");
    if (!selectedStore) errors.push("Store context is required");
    if (!formData.poDate) errors.push("Purchase Date is required");

    if (!Array.isArray(formData.items) || formData.items.length === 0) {
      errors.push("At least one spare part item is required");
    }

    formData.items.forEach((item, idx) => {
      if (!item.spare_id) errors.push(`Item ${idx + 1}: Spare Part is required`);
      if (!item.name?.trim()) errors.push(`Item ${idx + 1}: Spare Part name is required`);
      if (!item.machine_id?.trim()) errors.push(`Item ${idx + 1}: Machine mapping missing`);
      if (Number(item.quantity) <= 0) errors.push(`Item ${idx + 1}: Quantity must be greater than 0`);
      if (Number(item.unitPrice) <= 0) errors.push(`Item ${idx + 1}: Cost price must be greater than 0`);
    });

    return errors;
  };

  const resetForm = () => {
    setFormData({
      supplier: "",
      purchasedBy: "",
      poDate: new Date().toISOString().slice(0, 10),
      notes: "",
      items: [buildInitialLine(selectedStore || "")],
    });
    setValidationErrors([]);
  };

  const submitPurchase = async (event) => {
    event.preventDefault();
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const payload = {
      supplier: formData.supplier,
      supplierName: formData.supplier,
      purchasedBy: formData.purchasedBy,
      storeId: selectedStore,
      store_id: selectedStore,
      poDate: formData.poDate,
      notes: formData.notes,
      status: "Ordered",
      totalAmount: calculateTotal,
      items: formData.items.map((item) => ({
        category: "spare",
        spare_id: item.spare_id,
        name: item.name,
        machine_id: item.machine_id,
        store_id: selectedStore,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      })),
    };

    const result = await handleCreatePurchaseOrder(payload);
    if (result.success) {
      setIsAddOpen(false);
      resetForm();
    } else {
      setValidationErrors(result.errors || [result.error || "Failed to create purchase order"]);
    }
  };

  const deletePurchase = async (purchaseId) => {
    if (!window.confirm("Delete this purchase order record?")) return;
    await handleDeletePurchaseOrder(purchaseId);
  };

  return (
    <div style={{ width: "100%", minHeight: "calc(100vh - 80px)", padding: "10px 0 24px" }}>
      <Motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        style={{ ...pageCardStyle, padding: 24 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 30, color: "#f8fafc", letterSpacing: 0.4 }}>Purchase Orders</h2>
            <p style={{ margin: "6px 0 0", color: "#cbd5e1" }}>Track and manage company purchases</p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="saas-btn saas-btn-primary"
            style={{ minWidth: 200 }}
          >
            <Plus size={16} /> + Add Purchase Order
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <select
            value={filters.storeId}
            onChange={(e) => {
              setSelectedStore(e.target.value);
              onFilterChange("storeId", e.target.value);
            }}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(148, 163, 184, 0.3)",
              background: "rgba(15, 23, 42, 0.8)",
              color: "#f8fafc",
              padding: "10px 12px",
            }}
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.storeHead || store.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => onFilterChange("fromDate", e.target.value)}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(148, 163, 184, 0.3)",
              background: "rgba(15, 23, 42, 0.8)",
              color: "#f8fafc",
              padding: "10px 12px",
            }}
          />

          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => onFilterChange("toDate", e.target.value)}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(148, 163, 184, 0.3)",
              background: "rgba(15, 23, 42, 0.8)",
              color: "#f8fafc",
              padding: "10px 12px",
            }}
          />

          <select
            value={filters.sparePartId}
            onChange={(e) => onFilterChange("sparePartId", e.target.value)}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(148, 163, 184, 0.3)",
              background: "rgba(15, 23, 42, 0.8)",
              color: "#f8fafc",
              padding: "10px 12px",
            }}
          >
            <option value="">All spare parts</option>
            {spareParts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name}
              </option>
            ))}
          </select>
        </div>

        {purchasesError && (
          <div style={{ marginTop: 14, color: "#fecaca", background: "rgba(127, 29, 29, 0.24)", border: "1px solid rgba(248, 113, 113, 0.42)", borderRadius: 10, padding: 12 }}>
            {purchasesError}
          </div>
        )}

        <div style={{ marginTop: 18, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 980 }}>
            <thead>
              <tr style={{ color: "#93c5fd", textAlign: "left" }}>
                <th style={{ fontWeight: 600, padding: "0 10px" }}>Date</th>
                <th style={{ fontWeight: 600, padding: "0 10px" }}>Spare Part Name</th>
                <th style={{ fontWeight: 600, padding: "0 10px" }}>Quantity</th>
                <th style={{ fontWeight: 600, padding: "0 10px" }}>Supplier</th>
                <th style={{ fontWeight: 600, padding: "0 10px" }}>Purchased By</th>
                <th style={{ fontWeight: 600, padding: "0 10px" }}>Total Cost</th>
                <th style={{ fontWeight: 600, padding: "0 10px" }}>Store</th>
                <th style={{ fontWeight: 600, padding: "0 10px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPurchases.map((purchase) => {
                const totalQty = (purchase.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                const firstItemName = purchase.items?.[0]?.name || "-";
                const storeName = storeMap.get(purchase.storeId || purchase.store_id) || "Store";

                return (
                  <Motion.tr
                    key={purchase.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      background: "linear-gradient(120deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.78))",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                    }}
                  >
                    <td style={{ padding: "14px 10px", borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}>
                      {new Date(purchase.poDate || purchase.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "14px 10px" }}>
                      {firstItemName}
                      {purchase.items?.length > 1 ? ` +${purchase.items.length - 1} more` : ""}
                    </td>
                    <td style={{ padding: "14px 10px" }}>{totalQty}</td>
                    <td style={{ padding: "14px 10px" }}>{purchase.supplier || purchase.supplierName || "-"}</td>
                    <td style={{ padding: "14px 10px" }}>{purchase.purchasedBy || "-"}</td>
                    <td style={{ padding: "14px 10px" }}>₹{Number(purchase.totalAmount || 0).toFixed(2)}</td>
                    <td style={{ padding: "14px 10px" }}>{storeName}</td>
                    <td style={{ padding: "14px 10px", borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="saas-btn"
                          style={{ background: "rgba(59, 130, 246, 0.2)", color: "#dbeafe", border: "1px solid rgba(96, 165, 250, 0.4)", padding: "7px 10px" }}
                          onClick={() => setActivePurchase(purchase)}
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          type="button"
                          className="saas-btn"
                          style={{ background: "rgba(185, 28, 28, 0.24)", color: "#fecaca", border: "1px solid rgba(248, 113, 113, 0.4)", padding: "7px 10px" }}
                          disabled={deletePurchaseLoading}
                          onClick={() => deletePurchase(purchase.id)}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </Motion.tr>
                );
              })}
            </tbody>
          </table>

          {!purchasesLoading && sortedPurchases.length === 0 && (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "36px 8px" }}>
              No purchase history found for the selected filters.
            </div>
          )}
        </div>
      </Motion.div>

      <AnimatePresence>
        {isAddOpen && (
          <Motion.div
            className="fixed inset-0"
            style={{ background: "rgba(2, 6, 23, 0.72)", zIndex: 70, display: "flex", alignItems: "stretch", justifyContent: "center" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddOpen(false)}
          >
            <Motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.24 }}
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "min(1100px, 100vw)",
                height: "100vh",
                overflowY: "auto",
                padding: 20,
                background: "linear-gradient(140deg, rgba(15, 23, 42, 0.96), rgba(17, 24, 39, 0.96))",
                borderLeft: "1px solid rgba(148, 163, 184, 0.24)",
                borderRight: "1px solid rgba(148, 163, 184, 0.24)",
              }}
            >
              <form onSubmit={submitPurchase} style={{ maxWidth: 980, margin: "0 auto", color: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 28 }}>Add Purchase Order</h3>
                    <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>Create and stock spare parts into inventory automatically</p>
                  </div>
                  <button type="button" onClick={() => setIsAddOpen(false)} className="saas-btn" style={{ background: "rgba(30, 41, 59, 0.7)", color: "#dbeafe" }}>
                    <X size={16} /> Close
                  </button>
                </div>

                {(createPurchaseError || validationErrors.length > 0) && (
                  <div style={{ marginBottom: 14, color: "#fecaca", background: "rgba(127, 29, 29, 0.24)", border: "1px solid rgba(248, 113, 113, 0.42)", borderRadius: 10, padding: 12 }}>
                    {createPurchaseError && <div>• {createPurchaseError}</div>}
                    {validationErrors.map((error, idx) => (
                      <div key={`${error}-${idx}`}>• {error}</div>
                    ))}
                  </div>
                )}

                <div style={{ ...pageCardStyle, padding: 16, marginBottom: 12 }}>
                  <h4 style={{ marginTop: 0, marginBottom: 12 }}>Section 1: Purchase Info</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    <div>
                      <label>Supplier Name *</label>
                      <input
                        value={formData.supplier}
                        onChange={(e) => onFormChange("supplier", e.target.value)}
                        style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.86)", color: "#f8fafc", padding: "10px 12px" }}
                      />
                    </div>
                    <div>
                      <label>Purchased By *</label>
                      <input
                        value={formData.purchasedBy}
                        onChange={(e) => onFormChange("purchasedBy", e.target.value)}
                        style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.86)", color: "#f8fafc", padding: "10px 12px" }}
                      />
                    </div>
                    <div>
                      <label>Store (context)</label>
                      <input
                        value={storeMap.get(selectedStore) || ""}
                        disabled
                        style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.2)", background: "rgba(30, 41, 59, 0.62)", color: "#cbd5e1", padding: "10px 12px" }}
                      />
                    </div>
                    <div>
                      <label>Purchase Date *</label>
                      <input
                        type="date"
                        value={formData.poDate}
                        onChange={(e) => onFormChange("poDate", e.target.value)}
                        style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.86)", color: "#f8fafc", padding: "10px 12px" }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ ...pageCardStyle, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h4 style={{ margin: 0 }}>Section 2: Items</h4>
                    <button type="button" className="saas-btn saas-btn-primary" onClick={addLineItem}>
                      <Plus size={14} /> Add Spare Part
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {formData.items.map((item, index) => (
                      <div key={`item-${index}`} style={{ border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 12, padding: 12, background: "rgba(15, 23, 42, 0.62)" }}>
                        {(() => {
                          const selectedPart = sparePartMap.get(item.spare_id);
                          const machineIds = getPartMachineIds(selectedPart);
                          const machineNamesFromPart = Array.isArray(selectedPart?.machines)
                            ? selectedPart.machines
                              .map((machine) => String(machine?.name || "").trim())
                              .filter(Boolean)
                            : [];
                          const machineNames = [
                            ...machineIds.map((machineId) => machineMap.get(machineId) || `Machine ${machineId.slice(0, 8)}`),
                            ...machineNamesFromPart,
                          ].filter((name, nameIndex, allNames) => allNames.indexOf(name) === nameIndex);

                          return (
                            <>
                        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                          <div>
                            <label>Spare Part Name *</label>
                            <select
                              value={item.spare_id}
                              onChange={(e) => onItemChange(index, "spare_id", e.target.value)}
                              style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.86)", color: "#f8fafc", padding: "10px 12px" }}
                            >
                              <option value="">Select spare part</option>
                              {spareParts.map((part) => (
                                <option key={getEntityId(part)} value={getEntityId(part)}>{part.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label>Item Type</label>
                            <input
                              value="Spare Part"
                              disabled
                              style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.2)", background: "rgba(30, 41, 59, 0.62)", color: "#cbd5e1", padding: "10px 12px" }}
                            />
                          </div>

                          <div>
                            <label>Quantity *</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => onItemChange(index, "quantity", e.target.value)}
                              style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.86)", color: "#f8fafc", padding: "10px 12px" }}
                            />
                          </div>

                          <div>
                            <label>Cost Price / unit *</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => onItemChange(index, "unitPrice", e.target.value)}
                              style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.86)", color: "#f8fafc", padding: "10px 12px" }}
                            />
                          </div>

                          <div>
                            {formData.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLineItem(index)}
                                className="saas-btn"
                                style={{ background: "rgba(185, 28, 28, 0.24)", color: "#fecaca", border: "1px solid rgba(248, 113, 113, 0.4)", padding: "9px 10px" }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {item.spare_id && machineNames.length > 0 && (
                          <div
                            style={{
                              marginTop: 10,
                              borderRadius: 10,
                              border: "1px solid rgba(56, 189, 248, 0.35)",
                              background: "linear-gradient(120deg, rgba(8, 47, 73, 0.55), rgba(15, 23, 42, 0.72))",
                              padding: "10px 12px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#bae6fd", fontSize: 13, fontWeight: 700 }}>
                              <Cpu size={14} /> Used in machine{machineNames.length > 1 ? "s" : ""}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {machineNames.map((name, nameIndex) => (
                                <span
                                  key={`machine-chip-${index}-${nameIndex}-${name}`}
                                  style={{
                                    fontSize: 12,
                                    color: "#ecfeff",
                                    border: "1px solid rgba(103, 232, 249, 0.35)",
                                    background: "rgba(14, 116, 144, 0.25)",
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    fontWeight: 600,
                                  }}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.spare_id && machineNames.length === 0 && (
                          <div
                            style={{
                              marginTop: 10,
                              borderRadius: 10,
                              border: "1px solid rgba(148, 163, 184, 0.3)",
                              background: "rgba(30, 41, 59, 0.45)",
                              padding: "10px 12px",
                              color: "#cbd5e1",
                              fontSize: 12,
                            }}
                          >
                            Machine mapping not found for this spare part.
                          </div>
                        )}
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", color: "#bfdbfe", fontWeight: 600 }}>
                    Total Cost: ₹{calculateTotal.toFixed(2)}
                  </div>
                </div>

                <div style={{ ...pageCardStyle, padding: 16, marginBottom: 12 }}>
                  <h4 style={{ marginTop: 0, marginBottom: 12 }}>Section 3: Notes (optional)</h4>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => onFormChange("notes", e.target.value)}
                    rows={4}
                    placeholder="Remarks / Notes"
                    style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.86)", color: "#f8fafc", padding: "10px 12px", resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 14 }}>
                  <button type="button" className="saas-btn" onClick={() => setIsAddOpen(false)} style={{ background: "rgba(51, 65, 85, 0.76)", color: "#e2e8f0" }}>
                    Cancel
                  </button>
                  <button type="submit" className="saas-btn saas-btn-primary" disabled={createPurchaseLoading}>
                    {createPurchaseLoading ? "Creating..." : "Create Purchase Order"}
                  </button>
                </div>
              </form>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activePurchase && (
          <Motion.div
            className="fixed inset-0"
            style={{ background: "rgba(2, 6, 23, 0.68)", zIndex: 72, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePurchase(null)}
          >
            <Motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              onClick={(event) => event.stopPropagation()}
              style={{ ...pageCardStyle, width: "min(760px, 100%)", maxHeight: "86vh", overflowY: "auto", padding: 18 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Purchase Details</h3>
                <button type="button" className="saas-btn" onClick={() => setActivePurchase(null)} style={{ background: "rgba(51, 65, 85, 0.76)", color: "#e2e8f0" }}>
                  <X size={14} /> Close
                </button>
              </div>

              <div style={{ marginTop: 12, color: "#cbd5e1", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <div><strong>Supplier:</strong> {activePurchase.supplier || activePurchase.supplierName}</div>
                <div><strong>Purchased By:</strong> {activePurchase.purchasedBy || "-"}</div>
                <div><strong>Date:</strong> {new Date(activePurchase.poDate || activePurchase.createdAt).toLocaleDateString()}</div>
                <div><strong>Store:</strong> {storeMap.get(activePurchase.storeId || activePurchase.store_id) || "Store"}</div>
              </div>

              <div style={{ marginTop: 14 }}>
                <strong style={{ color: "#93c5fd" }}>Items</strong>
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {(activePurchase.items || []).map((item, idx) => (
                    <div key={`view-item-${idx}`} style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.24)", background: "rgba(15, 23, 42, 0.72)" }}>
                      {item.name} - Qty {item.quantity} - ₹{Number(item.unitPrice || 0).toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>

              {activePurchase.notes && (
                <div style={{ marginTop: 14, color: "#cbd5e1" }}>
                  <strong style={{ color: "#93c5fd" }}>Notes:</strong>
                  <div style={{ marginTop: 4 }}>{activePurchase.notes}</div>
                </div>
              )}
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Purchases;
