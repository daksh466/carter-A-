import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useApp from "../hooks/useApp";
import AddSparePartModal from "../components/AddSparePartModal";
import { deleteSparePart, getSpareParts, updateSparePart } from "../services/api";

const quantityPillStyle = (isLowStock) => ({
  padding: "6px 12px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 12,
  display: "inline-block",
  background: isLowStock ? "#fee2e2" : "#dcfce7",
  color: isLowStock ? "#b91c1c" : "#166534",
  border: `1px solid ${isLowStock ? "#fca5a5" : "#86efac"}`,
});

const statCardStyle = (background, borderColor) => ({
  background,
  border: `1px solid ${borderColor}`,
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
});

const tableHeaderStyle = {
  padding: "12px 14px",
  fontSize: 12,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  position: "sticky",
  top: 0,
  zIndex: 1,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const filterInputStyle = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
  background: "#ffffff",
  color: "#334155",
  outline: "none",
};

const editableInputStyle = {
  width: "100%",
  border: "1px solid #3b82f6",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 13,
  background: "linear-gradient(180deg, #f8fbff 0%, #eaf3ff 100%)",
  color: "#1e40af",
  boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.16)",
  outline: "none",
};

const stickyFirstColStyle = {
  position: "sticky",
  left: 0,
  zIndex: 2,
  background: "inherit",
};

const columnMeta = {
  name: { label: "Part", sortableKey: "name", editable: true },
  type: { label: "Type", sortableKey: "typeUnit", editable: true },
  typeUnit: { label: "Type / Unit", sortableKey: "typeUnit", editable: false },
  quantity: { label: "Stock", sortableKey: "quantity", editable: true },
  minRequired: { label: "Min Required", sortableKey: "minRequired", editable: true },
  cost: { label: "Cost", sortableKey: "cost", editable: true },
};

const toDisplayString = (value) => String(value ?? "");

const toNonNegativeNumber = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
};

const getPartCostValue = (part = {}) => {
  const candidates = [
    part.cost,
    part.costPrice,
    part.cost_price,
    part.unitCost,
    part.unit_cost,
    part.unitPrice,
    part.unit_price,
    part.purchasePrice,
    part.purchase_price,
    part.price,
    part.buyPrice,
    part.buy_price,
  ];

  for (const value of candidates) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && numeric >= 0) {
      return numeric;
    }
  }

  return null;
};

const normalizePart = (part = {}) => {
  const quantity = Number(part.availableQty ?? part.available_qty ?? part.quantity ?? part.quantity_available ?? 0);
  const minRequired = Number(part.minRequired ?? part.min_required ?? part.minimumRequired ?? part.minimum_required ?? 0);
  return {
    ...part,
    size: String(part.size || "").trim(),
    quantity,
    quantity_available: quantity,
    availableQty: quantity,
    available_qty: quantity,
    minRequired,
    minimumRequired: minRequired,
    minimum_required: minRequired,
    min_required: minRequired,
  };
};

const formatInr = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "-";
  return `INR ${numeric.toFixed(2)}`;
};

const editableFieldOrder = ["name", "type", "quantity", "minRequired", "cost"];
const getEntityId = (entity, fallback = "") => String(entity?.id || entity?._id || fallback);

const SpareParts = () => {
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [savingCellKey, setSavingCellKey] = useState("");
  const [editingCell, setEditingCell] = useState({ rowId: "", field: "" });
  const [hoveredRowId, setHoveredRowId] = useState("");
  const [draftEdits, setDraftEdits] = useState({});
  const [partOverrides, setPartOverrides] = useState({});
  const [removedPartIds, setRemovedPartIds] = useState({});
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [quickView, setQuickView] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(new Date());
  const [toast, setToast] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [columnFilters, setColumnFilters] = useState({
    name: "",
    typeUnit: "",
    stockStatus: "all",
    minRequired: "",
  });
  const [machineUsagePart, setMachineUsagePart] = useState(null);
  const [machineUsageNameDraft, setMachineUsageNameDraft] = useState("");
  const [isMachineUsageEditingName, setIsMachineUsageEditingName] = useState(false);
  const [machineUsageSavingName, setMachineUsageSavingName] = useState(false);
  const suppressBlurCommitRef = useRef(false);
  const {
    filteredSpareParts,
    searchQuery,
    storeLoading,
    storeError,
    selectedStore,
    setSelectedStore,
    stores,
    machines = [],
  } = useApp();

  const machineNameMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(machines) ? machines : []).forEach((machine, index) => {
      const machineId = getEntityId(machine, `machine-${index}`);
      if (!machineId) return;
      map.set(machineId, toDisplayString(machine.name || machine.machineName || `Machine ${index + 1}`));
    });
    return map;
  }, [machines]);

  const localParts = useMemo(() => {
    const source = Array.isArray(filteredSpareParts) ? filteredSpareParts : [];
    return source
      .filter((part, index) => !removedPartIds[getEntityId(part, `part-${index}`)])
      .map((part, index) => {
        const normalizedId = getEntityId(part, `part-${index}`);
        return {
          ...part,
          id: normalizedId,
          ...(partOverrides[normalizedId] || {}),
        };
      });
  }, [filteredSpareParts, partOverrides, removedPartIds]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!machineUsagePart) {
      setMachineUsageNameDraft("");
      setIsMachineUsageEditingName(false);
      setMachineUsageSavingName(false);
      return;
    }

    setMachineUsageNameDraft(toDisplayString(machineUsagePart.name));
    setIsMachineUsageEditingName(false);
  }, [machineUsagePart]);

  const sortedAndFilteredParts = useMemo(() => {
    const source = Array.isArray(localParts) ? [...localParts] : [];

    const filtered = source.filter((part) => {
      const name = toDisplayString(part.name).toLowerCase();
      const typeUnit = `${toDisplayString(part.type)} ${toDisplayString(part.unit)}`.trim().toLowerCase();
      const quantity = Number(part.quantity) || 0;
      const minRequired = Number(part.minRequired) || 0;
      const isLowStock = quantity <= minRequired;

      const matchesName = !columnFilters.name || name.includes(columnFilters.name.toLowerCase());
      const matchesTypeUnit = !columnFilters.typeUnit || typeUnit.includes(columnFilters.typeUnit.toLowerCase());
      const matchesStockStatus =
        columnFilters.stockStatus === "all" ||
        (columnFilters.stockStatus === "low" && isLowStock) ||
        (columnFilters.stockStatus === "healthy" && !isLowStock);
      const matchesMinRequired =
        !columnFilters.minRequired || toDisplayString(minRequired).includes(columnFilters.minRequired.trim());

      return (
        matchesName &&
        matchesTypeUnit &&
        matchesStockStatus &&
        matchesMinRequired
      );
    });

    filtered.sort((a, b) => {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      const key = sortConfig.key;

      if (key === "quantity" || key === "minRequired") {
        const left = Number(a[key]) || 0;
        const right = Number(b[key]) || 0;
        return (left - right) * dir;
      }

      if (key === "cost") {
        const left = getPartCostValue(a) ?? -1;
        const right = getPartCostValue(b) ?? -1;
        return (left - right) * dir;
      }

      if (key === "typeUnit") {
        const left = `${toDisplayString(a.type)} ${toDisplayString(a.unit)}`.trim().toLowerCase();
        const right = `${toDisplayString(b.type)} ${toDisplayString(b.unit)}`.trim().toLowerCase();
        return left.localeCompare(right) * dir;
      }

      const left = toDisplayString(a[key]).toLowerCase();
      const right = toDisplayString(b[key]).toLowerCase();
      return left.localeCompare(right) * dir;
    });

    return filtered;
  }, [localParts, columnFilters, sortConfig]);

  const productionFilteredParts = useMemo(() => {
    const query = inventoryQuery.trim().toLowerCase();

    return sortedAndFilteredParts.filter((part) => {
      const quantity = Number(part.quantity) || 0;
      const minRequired = Number(part.minRequired) || 0;
      const lotCount = (Array.isArray(part.batches) ? part.batches : []).length;

      const searchable = [
        part.name,
        part.machineName,
        part.type,
        part.size,
        part.unit,
      ]
        .map((item) => toDisplayString(item).toLowerCase())
        .join(" ");

      const queryMatches = !query || searchable.includes(query);
      const quickViewMatches =
        quickView === "all" ||
        (quickView === "critical" && quantity === 0) ||
        (quickView === "low" && quantity <= minRequired) ||
        (quickView === "healthy" && quantity > minRequired) ||
        (quickView === "lots" && lotCount > 0);

      return queryMatches && quickViewMatches;
    });
  }, [sortedAndFilteredParts, inventoryQuery, quickView]);

  const totalPages = useMemo(() => {
    const total = Math.ceil(productionFilteredParts.length / rowsPerPage);
    return Math.max(1, total || 1);
  }, [productionFilteredParts.length, rowsPerPage]);

  const effectivePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedParts = useMemo(() => {
    const start = (effectivePage - 1) * rowsPerPage;
    return productionFilteredParts.slice(start, start + rowsPerPage);
  }, [productionFilteredParts, effectivePage, rowsPerPage]);

  const { totalParts, lowStockCount, healthyStockCount, criticalCount } = useMemo(() => {
    const safeParts = Array.isArray(productionFilteredParts) ? productionFilteredParts : [];
    let low = 0;
    let critical = 0;

    safeParts.forEach((part) => {
      const qty = Number(part.quantity) || 0;
      const min = Number(part.minRequired) || 0;
      if (qty <= min) low += 1;
      if (qty === 0) critical += 1;
    });

    return {
      totalParts: safeParts.length,
      lowStockCount: low,
      healthyStockCount: safeParts.length - low,
      criticalCount: critical,
    };
  }, [productionFilteredParts]);

  const editableRowIds = useMemo(() => paginatedParts.map((part) => part.id), [paginatedParts]);

  const getPartMachineLabels = (part) => {
    const directNames = [
      toDisplayString(part?.machineName).trim(),
      toDisplayString(part?.machine_name).trim(),
    ].filter(Boolean);

    const nestedNames = Array.isArray(part?.machines)
      ? part.machines
          .map((machine) => toDisplayString(machine?.name).trim())
          .filter(Boolean)
      : [];

    const ids = [
      ...(Array.isArray(part?.machine_ids) ? part.machine_ids : []),
      ...(Array.isArray(part?.machines) ? part.machines.map((machine) => machine?.id || machine?._id) : []),
      part?.machine_id,
    ]
      .map((value) => toDisplayString(value).trim())
      .filter(Boolean);

    const idDerived = ids.map((id) => machineNameMap.get(id) || `Machine ${id.slice(0, 8)}`);

    return [...new Set([...directNames, ...nestedNames, ...idDerived])];
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (columnFilters.name.trim()) count += 1;
    if (columnFilters.typeUnit.trim()) count += 1;
    if (columnFilters.stockStatus !== "all") count += 1;
    if (columnFilters.minRequired.trim()) count += 1;
    return count;
  }, [columnFilters]);

  const getNavigationTarget = (rowId, field, command) => {
    const rowIndex = editableRowIds.indexOf(rowId);
    const fieldIndex = editableFieldOrder.indexOf(field);
    if (rowIndex === -1 || fieldIndex === -1) return null;

    let nextRowIndex = rowIndex;
    let nextFieldIndex = fieldIndex;

    if (command === "right") {
      nextFieldIndex = Math.min(editableFieldOrder.length - 1, fieldIndex + 1);
    }

    if (command === "left") {
      nextFieldIndex = Math.max(0, fieldIndex - 1);
    }

    if (command === "down" || command === "enter") {
      nextRowIndex = Math.min(editableRowIds.length - 1, rowIndex + 1);
    }

    if (command === "up") {
      nextRowIndex = Math.max(0, rowIndex - 1);
    }

    if (command === "tab") {
      if (fieldIndex < editableFieldOrder.length - 1) {
        nextFieldIndex = fieldIndex + 1;
      } else {
        nextFieldIndex = 0;
        nextRowIndex = Math.min(editableRowIds.length - 1, rowIndex + 1);
      }
    }

    if (command === "shiftTab") {
      if (fieldIndex > 0) {
        nextFieldIndex = fieldIndex - 1;
      } else {
        nextFieldIndex = editableFieldOrder.length - 1;
        nextRowIndex = Math.max(0, rowIndex - 1);
      }
    }

    return {
      rowId: editableRowIds[nextRowIndex],
      field: editableFieldOrder[nextFieldIndex],
    };
  };

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const getInteractiveCellStyle = (partId, field) => {
    const isActive = editingCell.rowId === partId && editingCell.field === field;
    return {
      cursor: "text",
      borderRadius: 8,
      padding: "2px 6px",
      display: "inline-block",
      background: isActive ? "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)" : "transparent",
      boxShadow: isActive ? "0 0 0 2px rgba(37, 99, 235, 0.28)" : "none",
      transition: "all 0.18s ease",
    };
  };

  const saveMachineUsageName = async () => {
    if (!machineUsagePart) return;
    const normalizedName = String(machineUsageNameDraft || "").trim();
    if (!normalizedName) {
      alert("Part name cannot be empty");
      return;
    }

    const partId = getEntityId(machineUsagePart);
    if (!partId) return;

    setMachineUsageSavingName(true);
    const result = await updateSparePart(partId, { name: normalizedName });
    setMachineUsageSavingName(false);

    if (!result.success) {
      alert(`Failed to save name: ${result.error || "Unknown error"}`);
      return;
    }

    const serverPart = result.data || {};
    setPartOverrides((prev) => {
      const existing = prev[String(partId)] || {};
      return {
        ...prev,
        [String(partId)]: {
          ...existing,
          ...serverPart,
          name: serverPart.name ?? normalizedName,
        },
      };
    });

    setMachineUsagePart((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...serverPart,
        name: serverPart.name ?? normalizedName,
      };
    });
    setMachineUsageNameDraft(serverPart.name ?? normalizedName);
    setIsMachineUsageEditingName(false);
    setToast("Spare part name updated");
  };

  const beginEdit = (part, field) => {
    if (!columnMeta[field]?.editable) return;
    const draftValue = field === "cost" ? toDisplayString(getPartCostValue(part) ?? "") : toDisplayString(part[field]);
    setEditingCell({ rowId: part.id, field });
    setDraftEdits((prev) => ({
      ...prev,
      [part.id]: {
        ...(prev[part.id] || {}),
        [field]: draftValue,
      },
    }));
  };

  const cancelEdit = () => {
    setEditingCell({ rowId: "", field: "" });
  };

  const onDraftChange = (rowId, field, value) => {
    setDraftEdits((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [field]: value,
      },
    }));
  };

  const commitEdit = async (part, field, nextTarget = null) => {
    const draftValue = draftEdits?.[part.id]?.[field];
    if (draftValue === undefined) {
      cancelEdit();
      return;
    }

    const payload = {};
    if (field === "name") {
      const normalized = String(draftValue).trim();
      if (!normalized) {
        alert("Part name cannot be empty");
        return;
      }
      payload.name = normalized;
    }

    if (field === "quantity") {
      const quantity = toNonNegativeNumber(draftValue);
      if (quantity === null) {
        alert("Stock must be a non-negative number");
        return;
      }
      payload.quantity_available = quantity;
    }

    if (field === "minRequired") {
      const minimumRequired = toNonNegativeNumber(draftValue);
      if (minimumRequired === null) {
        alert("Min Required must be a non-negative number");
        return;
      }
      payload.minimum_required = minimumRequired;
    }

    if (field === "type") {
      const normalizedType = String(draftValue ?? "").trim();
      const currentType = String(part.type ?? "").trim();
      if (normalizedType === currentType) {
        if (nextTarget?.rowId && nextTarget?.field) {
          const nextPart = paginatedParts.find((item) => item.id === nextTarget.rowId);
          if (nextPart) {
            beginEdit(nextPart, nextTarget.field);
          } else {
            cancelEdit();
          }
        } else {
          cancelEdit();
        }
        suppressBlurCommitRef.current = false;
        return;
      }
      payload.type = normalizedType;
    }

    if (field === "cost") {
      const normalizedRaw = String(draftValue ?? "").trim();
      if (!normalizedRaw) {
        payload.purchase_cost = null;
      } else {
        const purchaseCost = toNonNegativeNumber(normalizedRaw);
        if (purchaseCost === null) {
          alert("Cost must be a non-negative number");
          return;
        }
        payload.purchase_cost = purchaseCost;
      }
    }

    if (Object.keys(payload).length === 0) {
      cancelEdit();
      return;
    }

    const cellKey = `${part.id}-${field}`;
    setSavingCellKey(cellKey);

    const result = await updateSparePart(part.id, payload);
    if (!result.success) {
      alert(`Failed to save change: ${result.error || "Unknown error"}`);
      setSavingCellKey("");
      suppressBlurCommitRef.current = false;
      return;
    }

    setPartOverrides((prev) => {
      const existing = prev[String(part.id)] || {};
      const serverPart = result.data || {};
      return {
        ...prev,
        [String(part.id)]: {
          ...existing,
          ...serverPart,
          quantity: serverPart.quantity ?? payload.quantity_available ?? part.quantity,
          minRequired: serverPart.minRequired ?? payload.minimum_required ?? part.minRequired,
          name: serverPart.name ?? payload.name ?? part.name,
          type: serverPart.type ?? payload.type ?? part.type,
          cost: serverPart.cost ?? serverPart.purchase_cost ?? payload.purchase_cost ?? getPartCostValue(part),
          purchase_cost: serverPart.purchase_cost ?? payload.purchase_cost ?? getPartCostValue(part),
        },
      };
    });

    setSavingCellKey("");
    if (nextTarget?.rowId && nextTarget?.field) {
      const nextPart = paginatedParts.find((item) => item.id === nextTarget.rowId);
      if (nextPart) {
        beginEdit(nextPart, nextTarget.field);
      } else {
        cancelEdit();
      }
    } else {
      cancelEdit();
    }
    suppressBlurCommitRef.current = false;
  };

  const handleCellKeyDown = (event, part, field) => {
    if (event.key === "Escape") {
      event.preventDefault();
      suppressBlurCommitRef.current = false;
      cancelEdit();
      return;
    }

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "Enter"].includes(event.key)) {
      event.preventDefault();
      suppressBlurCommitRef.current = true;

      const commandMap = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        Enter: "enter",
      };

      const command =
        event.key === "Tab" ? (event.shiftKey ? "shiftTab" : "tab") : commandMap[event.key];
      const nextTarget = getNavigationTarget(part.id, field, command);
      commitEdit(part, field, nextTarget);
    }
  };

  const handleDeleteSparePart = async (id) => {
    if (!window.confirm("Are you sure you want to delete this spare part?")) return;
    setDeletingId(id);

    const result = await deleteSparePart(id);
    if (result.success) {
      setRemovedPartIds((prev) => ({ ...prev, [String(id)]: true }));
      setPartOverrides((prev) => {
        const next = { ...prev };
        delete next[String(id)];
        return next;
      });
      setToast("Spare part deleted");
    } else {
      setToast(result.error || "Failed to delete spare part");
    }

    setDeletingId(null);
  };

  const refreshInventory = async () => {
    if (!selectedStore) {
      setToast("Select a store first");
      return;
    }

    setIsRefreshing(true);
    const response = await getSpareParts({ storeId: selectedStore });
    if (import.meta.env.DEV) {
      console.log("API response:", response?.data);
    }
    if (response.success) {
      const nextParts = Array.isArray(response.data) ? response.data.map(normalizePart) : [];
      const nextById = new Set(nextParts.map((part) => String(part.id)));
      setRemovedPartIds((prev) => {
        const cleaned = {};
        Object.keys(prev).forEach((id) => {
          if (!nextById.has(id)) cleaned[id] = true;
        });
        return cleaned;
      });
      setPartOverrides({});
      setLastSyncAt(new Date());
      setToast("Inventory refreshed");
    } else {
      setToast(response.error || "Refresh failed");
    }
    setIsRefreshing(false);
  };

  const exportCsv = () => {
    const header = ["Part", "Available Qty", "Min Required", "Cost", "Type", "Unit"];
    const rows = productionFilteredParts.map((part) => [
      toDisplayString(part.name),
      String(Number(part.quantity) || 0),
      String(Number(part.minRequired) || 0),
      formatInr(getPartCostValue(part)),
      toDisplayString(part.type),
      toDisplayString(part.unit),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `spare-parts-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToast("CSV exported");
  };

  if (storeLoading) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
        }}
      >
        <h2 style={{ color: "#fff", fontSize: 24, marginBottom: 8 }}>Loading...</h2>
        <p style={{ color: "#cbd5e1", fontSize: 14 }}>Fetching spare parts data...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "calc(100vh - 64px)",
        padding: "28px 20px 24px",
        background:
          "radial-gradient(circle at 8% 12%, #dbeafe 0%, #f8fafc 28%, #fefce8 70%, #ffffff 100%)",
      }}
    >
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 84,
            right: 18,
            zIndex: 90,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #bae6fd",
            background: "#ecfeff",
            color: "#155e75",
            fontWeight: 700,
            fontSize: 13,
            boxShadow: "0 16px 26px rgba(8, 47, 73, 0.18)",
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          maxWidth: 1250,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: "#0f172a" }}>Spare Parts Ledger</h2>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
              Excel-style inventory grid with status chips and lot-level visibility.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              value={selectedStore}
              onChange={(event) => {
                setSelectedStore(event.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #93c5fd",
                background: "#eff6ff",
                color: "#1e3a8a",
                fontWeight: 700,
                minWidth: 180,
              }}
            >
              {stores.map((store, index) => {
                const storeId = getEntityId(store, `store-${index}`);
                return (
                <option key={storeId} value={storeId}>
                  {store.name || store.storeHead || "Store"}
                </option>
                );
              })}
            </select>

            <button
              onClick={() => setIsAddModalOpen(true)}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #1d4ed8",
                background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Add Spare Part
            </button>
            <button
              onClick={() => navigate("/dashboard/purchases")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #059669",
                background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Manage Purchases
            </button>

            <button
              onClick={() => navigate("/dashboard/shipments?tab=outgoing")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #f59e0b",
                background: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Out / Issue
            </button>

            <button
              onClick={() => navigate("/dashboard/shipments?tab=incoming")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #10b981",
                background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              In / Receive
            </button>

            <button
              onClick={refreshInventory}
              disabled={isRefreshing}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #334155",
                background: isRefreshing ? "#e2e8f0" : "#f8fafc",
                color: "#0f172a",
                fontWeight: 700,
                cursor: isRefreshing ? "not-allowed" : "pointer",
              }}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={exportCsv}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #0f766e",
                background: "#ccfbf1",
                color: "#115e59",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #bfdbfe",
            background: "linear-gradient(90deg, #f0f9ff 0%, #eff6ff 50%, #f8fafc 100%)",
          }}
        >
          <input
            value={inventoryQuery}
            onChange={(event) => {
              setInventoryQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search parts, type, size"
            style={{
              flex: "1 1 340px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #93c5fd",
              fontSize: 13,
              color: "#0f172a",
            }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["all", "critical", "low", "healthy", "lots"].map((view) => (
              <button
                key={view}
                onClick={() => {
                  setQuickView(view);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: quickView === view ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                  background: quickView === view ? "#dbeafe" : "#ffffff",
                  color: quickView === view ? "#1e3a8a" : "#334155",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "capitalize",
                  cursor: "pointer",
                }}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          }}
        >
          <div style={statCardStyle("linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", "#93c5fd")}>
            <div style={{ fontSize: 12, color: "#1e3a8a", marginBottom: 8, fontWeight: 700 }}>Total SKUs</div>
            <div style={{ fontSize: 28, color: "#1d4ed8", fontWeight: 800 }}>{totalParts}</div>
          </div>

          <div style={statCardStyle("linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", "#6ee7b7")}>
            <div style={{ fontSize: 12, color: "#065f46", marginBottom: 8, fontWeight: 700 }}>Healthy Stock</div>
            <div style={{ fontSize: 28, color: "#047857", fontWeight: 800 }}>{healthyStockCount}</div>
          </div>

          <div style={statCardStyle("linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)", "#fda4af")}>
            <div style={{ fontSize: 12, color: "#881337", marginBottom: 8, fontWeight: 700 }}>Low Stock</div>
            <div style={{ fontSize: 28, color: "#be123c", fontWeight: 800 }}>{lowStockCount}</div>
          </div>

          <div style={statCardStyle("linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)", "#fdba74")}>
            <div style={{ fontSize: 12, color: "#7c2d12", marginBottom: 8, fontWeight: 700 }}>Critical (Zero)</div>
            <div style={{ fontSize: 28, color: "#c2410c", fontWeight: 800 }}>{criticalCount}</div>
          </div>
        </div>

        {storeError && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              border: "1px solid #fca5a5",
              background: "#fef2f2",
              color: "#991b1b",
              fontWeight: 600,
            }}
          >
            Note: {storeError}
          </div>
        )}

        {searchQuery && (
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              padding: "8px 12px",
              borderRadius: 999,
              background: "#e0f2fe",
              border: "1px solid #7dd3fc",
              color: "#0c4a6e",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Showing results for: {searchQuery}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            padding: "10px 12px",
            borderRadius: 12,
            background: "linear-gradient(90deg, #ecfeff 0%, #eef2ff 55%, #fef3c7 100%)",
            border: "1px solid #bfdbfe",
            boxShadow: "0 10px 20px rgba(30, 64, 175, 0.08)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 800, color: "#1e3a8a" }}>Quick Edit Keys</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0f766e", background: "#ccfbf1", borderRadius: 999, padding: "3px 8px" }}>Enter = Save + Next Row</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#7c2d12", background: "#ffedd5", borderRadius: 999, padding: "3px 8px" }}>Tab = Next Cell</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", background: "#e2e8f0", borderRadius: 999, padding: "3px 8px" }}>Arrows = Navigate Grid</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#7f1d1d", background: "#fee2e2", borderRadius: 999, padding: "3px 8px" }}>Esc = Cancel</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 12,
            background: "linear-gradient(90deg, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#1e293b",
                background: "#e2e8f0",
                borderRadius: 999,
                padding: "4px 10px",
              }}
            >
              Showing {sortedAndFilteredParts.length} of {localParts.length} rows
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: activeFilterCount > 0 ? "#92400e" : "#155e75",
                background: activeFilterCount > 0 ? "#fef3c7" : "#cffafe",
                borderRadius: 999,
                padding: "4px 10px",
              }}
            >
              Active filters: {activeFilterCount}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#312e81",
                background: "#e0e7ff",
                borderRadius: 999,
                padding: "4px 10px",
              }}
            >
              Sorted by {sortConfig.key} ({sortConfig.direction})
            </span>
          </div>
          <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
            Last sync: {lastSyncAt.toLocaleTimeString()} | Tip: Swipe horizontally on mobile to view all columns.
          </span>
        </div>

        {productionFilteredParts.length === 0 ? (
          <div
            style={{
              marginTop: 8,
              padding: 28,
              borderRadius: 12,
              textAlign: "center",
              color: "#475569",
              background: "#ffffff",
              border: "1px dashed #cbd5e1",
            }}
          >
            {searchQuery ? "No spare parts match your search." : "No spare parts found."}
          </div>
        ) : (
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 14,
              overflow: "hidden",
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              boxShadow: "0 18px 38px rgba(15, 23, 42, 0.1)",
            }}
          >
            <div style={{ maxHeight: "66vh", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={{ ...tableHeaderStyle, ...stickyFirstColStyle }}>
                      <button
                        onClick={() => requestSort("name")}
                        style={{
                          background: "#eef2ff",
                          border: "1px solid #c7d2fe",
                          borderRadius: 999,
                          color: "#312e81",
                          cursor: "pointer",
                          fontWeight: 700,
                          padding: "4px 10px",
                        }}
                      >
                        Part {getSortIndicator("name")}
                      </button>
                    </th>
                    <th style={tableHeaderStyle}>
                      <button
                        onClick={() => requestSort("quantity")}
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #86efac",
                          borderRadius: 999,
                          color: "#166534",
                          cursor: "pointer",
                          fontWeight: 700,
                          padding: "4px 10px",
                        }}
                      >
                        Available Qty {getSortIndicator("quantity")}
                      </button>
                    </th>
                    <th style={tableHeaderStyle}>
                      <button
                        onClick={() => requestSort("minRequired")}
                        style={{
                          background: "#fff1f2",
                          border: "1px solid #fda4af",
                          borderRadius: 999,
                          color: "#9f1239",
                          cursor: "pointer",
                          fontWeight: 700,
                          padding: "4px 10px",
                        }}
                      >
                        Min Required {getSortIndicator("minRequired")}
                      </button>
                    </th>
                    <th style={tableHeaderStyle}>
                      <button
                        onClick={() => requestSort("cost")}
                        style={{
                          background: "#fff7ed",
                          border: "1px solid #fdba74",
                          borderRadius: 999,
                          color: "#9a3412",
                          cursor: "pointer",
                          fontWeight: 700,
                          padding: "4px 10px",
                        }}
                      >
                        Cost {getSortIndicator("cost")}
                      </button>
                    </th>
                    <th style={tableHeaderStyle}>
                      <button
                        onClick={() => requestSort("typeUnit")}
                        style={{
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          borderRadius: 999,
                          color: "#9a3412",
                          cursor: "pointer",
                          fontWeight: 700,
                          padding: "4px 10px",
                        }}
                      >
                        Type / Unit {getSortIndicator("typeUnit")}
                      </button>
                    </th>
                    <th style={tableHeaderStyle}>Action</th>
                  </tr>
                  <tr>
                    <th style={{ ...tableHeaderStyle, ...stickyFirstColStyle, top: 42 }}>
                      <input
                        value={columnFilters.name}
                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Filter part"
                        style={filterInputStyle}
                      />
                    </th>
                    <th style={{ ...tableHeaderStyle, top: 42 }}>
                      <select
                        value={columnFilters.stockStatus}
                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, stockStatus: e.target.value }))}
                        style={filterInputStyle}
                      >
                        <option value="all">All Stock</option>
                        <option value="low">Low Stock</option>
                        <option value="healthy">Healthy</option>
                      </select>
                    </th>
                    <th style={{ ...tableHeaderStyle, top: 42 }}>
                      <input
                        value={columnFilters.minRequired}
                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, minRequired: e.target.value }))}
                        placeholder="e.g. 10"
                        style={filterInputStyle}
                      />
                    </th>
                    <th style={{ ...tableHeaderStyle, top: 42 }}>
                      <div
                        style={{
                          width: "100%",
                          border: "1px dashed #fdba74",
                          borderRadius: 8,
                          padding: "6px 8px",
                          fontSize: 11,
                          color: "#9a3412",
                          background: "#fff7ed",
                          fontWeight: 700,
                        }}
                      >
                        Click row value to edit
                      </div>
                    </th>
                    <th style={{ ...tableHeaderStyle, top: 42 }}>
                      <input
                        value={columnFilters.typeUnit}
                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, typeUnit: e.target.value }))}
                        placeholder="Filter type/unit"
                        style={filterInputStyle}
                      />
                    </th>
                    <th style={{ ...tableHeaderStyle, top: 42 }}>
                      <button
                        onClick={() =>
                          setColumnFilters({
                            name: "",
                            typeUnit: "",
                            stockStatus: "all",
                            minRequired: "",
                          })
                        }
                        style={{
                          width: "100%",
                          border: "1px solid #f59e0b",
                          borderRadius: 8,
                          padding: "6px 8px",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#92400e",
                          background: "#fef3c7",
                          cursor: "pointer",
                        }}
                      >
                        Reset
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedParts.map((part, idx) => {
                    const partId = getEntityId(part, `part-${idx}`);
                    const quantity = Number(part.quantity) || 0;
                    const minRequired = Number(part.minRequired) || 0;
                    const isLowStock = quantity <= minRequired;
                    const rowBackground =
                      idx % 2 === 0
                        ? "linear-gradient(90deg, #ffffff 0%, #f8fafc 100%)"
                        : "linear-gradient(90deg, #f8fafc 0%, #ffffff 100%)";

                    return (
                      <tr
                        key={partId}
                        style={{
                          background: rowBackground,
                          transform: hoveredRowId === partId ? "translateY(-1px)" : "none",
                          boxShadow: hoveredRowId === partId ? "inset 0 0 0 1px rgba(59, 130, 246, 0.16)" : "none",
                          transition: "all 0.16s ease",
                        }}
                        onMouseEnter={() => setHoveredRowId(partId)}
                        onMouseLeave={() => setHoveredRowId("")}
                      >
                        <td style={{ ...stickyFirstColStyle, padding: "12px 14px", borderBottom: "1px solid #eef2f7", verticalAlign: "top" }}>
                          {editingCell.rowId === partId && editingCell.field === "name" ? (
                            <input
                              autoFocus
                              value={draftEdits?.[partId]?.name ?? ""}
                              onChange={(e) => onDraftChange(partId, "name", e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, part, "name")}
                              onBlur={() => {
                                if (suppressBlurCommitRef.current) return;
                                commitEdit(part, "name");
                              }}
                              style={editableInputStyle}
                            />
                          ) : (
                            <div
                              style={{ ...getInteractiveCellStyle(partId, "name"), fontWeight: 700, color: "#0f172a", fontSize: 14 }}
                              onDoubleClick={() => setMachineUsagePart(part)}
                              title="Double click to open machine usage"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  setMachineUsagePart(part);
                                }
                              }}
                            >
                              {part.name || "-"}
                            </div>
                          )}
                          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>Size: {part.size || "N/A"}</div>
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7" }}>
                          {editingCell.rowId === partId && editingCell.field === "quantity" ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              value={draftEdits?.[partId]?.quantity ?? ""}
                              onChange={(e) => onDraftChange(partId, "quantity", e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, part, "quantity")}
                              onBlur={() => {
                                if (suppressBlurCommitRef.current) return;
                                commitEdit(part, "quantity");
                              }}
                              style={editableInputStyle}
                            />
                          ) : (
                            <span
                              style={{ ...quantityPillStyle(isLowStock), ...getInteractiveCellStyle(partId, "quantity") }}
                              onClick={() => beginEdit(part, "quantity")}
                              title="Click to edit"
                            >
                              Qty {quantity}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", color: "#334155", fontWeight: 600, fontSize: 13 }}>
                          {editingCell.rowId === partId && editingCell.field === "minRequired" ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              value={draftEdits?.[partId]?.minRequired ?? ""}
                              onChange={(e) => onDraftChange(partId, "minRequired", e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, part, "minRequired")}
                              onBlur={() => {
                                if (suppressBlurCommitRef.current) return;
                                commitEdit(part, "minRequired");
                              }}
                              style={editableInputStyle}
                            />
                          ) : (
                            <span
                              style={{ ...getInteractiveCellStyle(partId, "minRequired"), color: "#334155", fontWeight: 600 }}
                              onClick={() => beginEdit(part, "minRequired")}
                              title="Click to edit"
                            >
                              {minRequired}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", color: "#334155", fontSize: 13 }}>
                          {editingCell.rowId === partId && editingCell.field === "cost" ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              step="0.01"
                              value={draftEdits?.[partId]?.cost ?? ""}
                              onChange={(e) => onDraftChange(partId, "cost", e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, part, "cost")}
                              onBlur={() => {
                                if (suppressBlurCommitRef.current) return;
                                commitEdit(part, "cost");
                              }}
                              style={editableInputStyle}
                            />
                          ) : (
                            <span
                              style={{
                                ...getInteractiveCellStyle(partId, "cost"),
                                display: "inline-flex",
                                alignItems: "center",
                                fontWeight: 700,
                                color: "#9a3412",
                                background: "#fff7ed",
                                border: "1px solid #fed7aa",
                                borderRadius: 999,
                                padding: "4px 10px",
                                fontSize: 12,
                              }}
                              onClick={() => beginEdit(part, "cost")}
                              title="Click to edit"
                            >
                              {getPartCostValue(part) === null ? "Set Cost" : formatInr(getPartCostValue(part))}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", color: "#334155", fontSize: 13 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 210 }}>
                            <input
                              value={draftEdits?.[partId]?.type ?? toDisplayString(part.type)}
                              onFocus={() => beginEdit(part, "type")}
                              onChange={(e) => onDraftChange(partId, "type", e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, part, "type")}
                              onBlur={() => {
                                if (suppressBlurCommitRef.current) return;
                                commitEdit(part, "type");
                              }}
                              placeholder="Enter type"
                              style={{
                                ...editableInputStyle,
                                minWidth: 130,
                                background: "#ffffff",
                                color: "#0f172a",
                                boxShadow: "none",
                              }}
                            />
                            <span style={{ color: "#64748b", whiteSpace: "nowrap" }}>/ {part.unit || "-"}</span>
                          </div>
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", width: 120 }}>
                          {savingCellKey.startsWith(`${partId}-`) && (
                            <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, marginBottom: 6 }}>Saving...</div>
                          )}
                          <button
                            onClick={() => handleDeleteSparePart(partId)}
                            disabled={deletingId === partId}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 8,
                              border: "1px solid #dc2626",
                              background: deletingId === partId ? "#fecaca" : "#ef4444",
                              color: deletingId === partId ? "#7f1d1d" : "#fff",
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: deletingId === partId ? "not-allowed" : "pointer",
                            }}
                          >
                            {deletingId === partId ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {productionFilteredParts.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
              Page {currentPage} of {totalPages} | Rows {paginatedParts.length} of {productionFilteredParts.length}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <select
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value) || 20);
                  setCurrentPage(1);
                }}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#334155",
                  background: "#fff",
                }}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={effectivePage === 1}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "6px 10px",
                  background: effectivePage === 1 ? "#f1f5f9" : "#fff",
                  color: "#0f172a",
                  fontWeight: 700,
                  cursor: effectivePage === 1 ? "not-allowed" : "pointer",
                }}
              >
                Prev
              </button>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={effectivePage >= totalPages}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "6px 10px",
                  background: effectivePage >= totalPages ? "#f1f5f9" : "#fff",
                  color: "#0f172a",
                  fontWeight: 700,
                  cursor: effectivePage >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {machineUsagePart && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(2, 6, 23, 0.68)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setMachineUsagePart(null)}
        >
          <div
            style={{
              width: "min(620px, 100%)",
              borderRadius: 18,
              border: "1px solid rgba(56, 189, 248, 0.28)",
              background: "linear-gradient(145deg, rgba(15, 23, 42, 0.97), rgba(15, 23, 42, 0.9))",
              boxShadow: "0 24px 64px rgba(2, 6, 23, 0.55)",
              color: "#e2e8f0",
              overflow: "hidden",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 18px",
                borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
                background: "linear-gradient(135deg, rgba(14, 116, 144, 0.25), rgba(30, 41, 59, 0.2))",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: "#67e8f9", fontWeight: 700 }}>
                  Machine Usage
                </div>
                <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>{toDisplayString(machineUsagePart.name) || "Spare Part"}</div>
                {isMachineUsageEditingName ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      autoFocus
                      value={machineUsageNameDraft}
                      onChange={(event) => setMachineUsageNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveMachineUsageName();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setIsMachineUsageEditingName(false);
                          setMachineUsageNameDraft(toDisplayString(machineUsagePart.name));
                        }
                      }}
                      style={{
                        border: "1px solid rgba(125, 211, 252, 0.6)",
                        borderRadius: 10,
                        padding: "8px 10px",
                        background: "rgba(15, 23, 42, 0.8)",
                        color: "#f8fafc",
                        minWidth: 220,
                        fontSize: 15,
                        fontWeight: 700,
                      }}
                    />
                    <button
                      type="button"
                      onClick={saveMachineUsageName}
                      disabled={machineUsageSavingName}
                      style={{
                        border: "1px solid rgba(34, 197, 94, 0.45)",
                        borderRadius: 10,
                        background: machineUsageSavingName ? "rgba(15, 118, 110, 0.35)" : "rgba(34, 197, 94, 0.2)",
                        color: "#dcfce7",
                        padding: "7px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: machineUsageSavingName ? "not-allowed" : "pointer",
                      }}
                    >
                      {machineUsageSavingName ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMachineUsageEditingName(false);
                        setMachineUsageNameDraft(toDisplayString(machineUsagePart.name));
                      }}
                      style={{
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        borderRadius: 10,
                        background: "rgba(51, 65, 85, 0.35)",
                        color: "#e2e8f0",
                        padding: "7px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color: "#f8fafc", cursor: "text", userSelect: "none" }}
                    onDoubleClick={() => setIsMachineUsageEditingName(true)}
                    title="Double click to edit name"
                  >
                    {toDisplayString(machineUsagePart.name) || "Spare Part"}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!isMachineUsageEditingName && (
                  <button
                    type="button"
                    onClick={() => setIsMachineUsageEditingName(true)}
                    style={{
                      border: "1px solid rgba(125, 211, 252, 0.42)",
                      borderRadius: 10,
                      background: "rgba(8, 145, 178, 0.18)",
                      color: "#cffafe",
                      padding: "7px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Edit Name
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMachineUsagePart(null)}
                  style={{
                    border: "1px solid rgba(148, 163, 184, 0.32)",
                    borderRadius: 10,
                    background: "rgba(15, 23, 42, 0.75)",
                    color: "#e2e8f0",
                    padding: "7px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 10 }}>
                This spare part is used in the following machine(s):
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {getPartMachineLabels(machineUsagePart).length > 0 ? (
                  getPartMachineLabels(machineUsagePart).map((machineLabel, idx) => (
                    <span
                      key={`usage-${machineLabel}-${idx}`}
                      style={{
                        border: "1px solid rgba(103, 232, 249, 0.35)",
                        background: "rgba(8, 145, 178, 0.2)",
                        color: "#ecfeff",
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {machineLabel}
                    </span>
                  ))
                ) : (
                  <span
                    style={{
                      border: "1px solid rgba(148, 163, 184, 0.3)",
                      background: "rgba(51, 65, 85, 0.3)",
                      color: "#cbd5e1",
                      borderRadius: 10,
                      padding: "8px 10px",
                      fontSize: 12,
                    }}
                  >
                    No machine mapping found for this spare part.
                  </span>
                )}
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: "#94a3b8" }}>
                Tip: Double-click spare part name in table to open this view. Double-click the title here to edit the name.
              </div>
            </div>
          </div>
        </div>
      )}

      <AddSparePartModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={refreshInventory}
      />
    </div>
  );
};

export default SpareParts;
