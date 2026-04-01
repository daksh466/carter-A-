import React, { useState, useMemo, useEffect, useCallback } from "react";
import { AppContext } from "./AppContextRef";
import { getStores, getMachinesByStore, getSpareParts, getAlerts, getOrders, createPurchaseOrder, getPurchaseOrders, createMachine, createSparePart, createOrder, deletePurchaseOrder, createTransfer, getTransfers, deleteMachine } from "../services/api";

const getOrderAmount = (order = {}) => Number(order.totalAmount ?? order.price ?? 0) || 0;
const getSafeError = (message) => message || "Failed to load data";
const getMachineRecordId = (machine = {}) => String(machine?.id || machine?._id || "").trim();

const normalizeMachine = (machine = {}) => {
  const quantity = Number(machine.quantity ?? machine.quantity_available ?? machine.stock ?? 0);
  const minRequired = Number(machine.minRequired ?? machine.minimumRequired ?? machine.minimum_required ?? 0);
  const warrantyExpiryDate = machine.warrantyExpiryDate ?? machine.warranty_expiry_date ?? machine.warranty ?? null;
  const expiryDate = warrantyExpiryDate ? new Date(warrantyExpiryDate) : null;
  const hasValidExpiry = expiryDate && !Number.isNaN(expiryDate.getTime());
  const now = new Date();
  const expiringThreshold = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const warrantyExpiring = Boolean(hasValidExpiry && expiryDate <= expiringThreshold && expiryDate >= now);
  const warrantyStatus = machine.warrantyStatus
    || (hasValidExpiry ? (expiryDate < now ? "Expired" : "Active") : "N/A");

  return {
    ...machine,
    quantity,
    quantity_available: quantity,
    minRequired,
    minimumRequired: minRequired,
    minimum_required: minRequired,
    warranty: warrantyExpiryDate,
    warrantyExpiryDate,
    warranty_expiry_date: warrantyExpiryDate,
    warrantyStatus,
    warrantyExpiring,
  };
};

const normalizeSparePart = (part = {}) => {
  const quantity = Number(part.quantity ?? part.quantity_available ?? part.availableQty ?? part.available_qty ?? part.stock ?? 0);
  const minRequired = Number(part.minRequired ?? part.minimumRequired ?? part.minimum_required ?? part.min_required ?? 0);
  const warranty = part.warranty ?? part.warrantyExpiryDate ?? part.warranty_expiry_date ?? null;

  return {
    ...part,
    size: String(part.size || "").trim(),
    unit: String(part.unit || "pcs").trim(),
    quantity,
    quantity_available: quantity,
    availableQty: quantity,
    available_qty: quantity,
    minRequired,
    minimumRequired: minRequired,
    minimum_required: minRequired,
    min_required: minRequired,
    warranty,
    warrantyExpiryDate: warranty,
    warranty_expiry_date: warranty,
  };
};

const buildOrdersSummary = (orders = []) => {
  const total = orders.length;
  const paid = orders.filter((order) => order.paymentStatus === "Paid").length;
  const pending = total - paid;
  const totalAmount = orders.reduce((sum, order) => sum + getOrderAmount(order), 0);

  return {
    total,
    paid,
    pending,
    totalAmount,
    averageAmount: total > 0 ? totalAmount / total : 0,
  };
};

const readInitialTheme = () => {
  if (typeof window === "undefined") return false;

  const persisted = String(window.localStorage.getItem("darkMode") || "").trim();
  if (persisted === "true") return true;
  if (persisted === "false") return false;

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches || false;
};

export const AppProvider = ({ children }) => {
  // State
  const [stores, setStores] = useState([]);
  const [machines, setMachines] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [ordersSummary, setOrdersSummary] = useState({ total: 0, paid: 0, pending: 0, totalAmount: 0, averageAmount: 0 });
  const [selectedStore, setSelectedStore] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [darkMode, setDarkMode] = useState(readInitialTheme);
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [storeLoading, setStoreLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storeError, setStoreError] = useState(null);
  const [alertsError, setAlertsError] = useState(null);
  const [ordersError, setOrdersError] = useState(null);
  const [purchasesError, setPurchasesError] = useState(null);
  // Creation states
  const [createMachineLoading, setCreateMachineLoading] = useState(false);
  const [createMachineError, setCreateMachineError] = useState(null);
  const [createSpareLoading, setCreateSpareLoading] = useState(false);
  const [createSpareError, setCreateSpareError] = useState(null);
  const [createOrderLoading, setCreateOrderLoading] = useState(false);
  const [createOrderError, setCreateOrderError] = useState(null);
  const [createPurchaseLoading, setCreatePurchaseLoading] = useState(false);
  const [createPurchaseError, setCreatePurchaseError] = useState(null);
  const [deletePurchaseLoading, setDeletePurchaseLoading] = useState(false);
  const [deletePurchaseError, setDeletePurchaseError] = useState(null);
  const [deleteMachineLoading, setDeleteMachineLoading] = useState(false);
  const [deleteMachineError, setDeleteMachineError] = useState(null);
  // Transfer states
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transfersError, setTransfersError] = useState(null);
  const [createTransferLoading, setCreateTransferLoading] = useState(false);
  const [createTransferError, setCreateTransferError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem("darkMode", String(darkMode));
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const toggleTheme = useCallback(() => {
    setDarkMode((previous) => !previous);
  }, []);

  // Centralized refreshStores function
  const refreshStores = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getStores();
      const apiStores = Array.isArray(response?.data) ? response.data : [];
      setStores(apiStores);
      // If selectedStore is missing in new list, reset to first or ""
      if (!apiStores.find(s => s.id === selectedStore)) {
        setSelectedStore(apiStores?.[0]?.id || "");
      }
      if (!response?.success) {
        setError(getSafeError(response?.error));
      }
      // Debug logs

    } catch (err) {
      setStores([]);
      setSelectedStore("");
      setError(getSafeError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  // Fetch stores on mount
  useEffect(() => {
    refreshStores();
    // eslint-disable-next-line
  }, []);

  // Fetch machines when store changes
  useEffect(() => {
    if (!selectedStore) return;
    const fetchMachines = async () => {
      try {
        setStoreLoading(true);
        setStoreError(null);
        const response = await getMachinesByStore(selectedStore);
        const apiMachines = Array.isArray(response?.data) ? response.data.map(normalizeMachine) : [];
        setMachines(apiMachines);

        if (!response?.success) {
          setStoreError(getSafeError(response?.error));
        }
      } catch (err) {
        setMachines([]);
        setStoreError(getSafeError(err?.message));
      } finally {
        setStoreLoading(false);
      }
    };
    fetchMachines();
  }, [selectedStore]);

  // Fetch spare parts when store changes
  useEffect(() => {
    if (!selectedStore) return;
    const fetchSpareParts = async () => {
      try {
        setStoreLoading(true);
        setStoreError(null);
        const response = await getSpareParts({ storeId: selectedStore });
        if (import.meta.env.DEV) {
          console.log("API response:", response?.data);
        }
        const apiSpareParts = Array.isArray(response?.data) ? response.data.map(normalizeSparePart) : [];
        setSpareParts(apiSpareParts);

        if (!response?.success) {
          setStoreError(getSafeError(response?.error));
        }
      } catch (err) {
        setSpareParts([]);
        setStoreError(getSafeError(err?.message));
      } finally {
        setStoreLoading(false);
      }
    };
    fetchSpareParts();
  }, [selectedStore]);

  // Fetch alerts on mount
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setAlertsLoading(true);
        setAlertsError(null);
        const response = await getAlerts();
        const apiAlerts = Array.isArray(response?.data) ? response.data : [];
        setAlerts(apiAlerts);

        if (!response?.success) {
          setAlertsError(getSafeError(response?.error));
        }
      } catch (err) {
        setAlerts([]);
        setAlertsError(getSafeError(err?.message));
      } finally {
        setAlertsLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  // Fetch orders on mount
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setOrdersLoading(true);
        setOrdersError(null);
        const response = await getOrders();
        const apiOrders = Array.isArray(response?.data) ? response.data : [];
        const summaryToUse = response?.summary || buildOrdersSummary(apiOrders);

        setOrders(apiOrders);
        setOrdersSummary(summaryToUse);

        if (!response?.success) {
          setOrdersError(getSafeError(response?.error));
        }
      } catch (err) {
        setOrders([]);
        setOrdersSummary(buildOrdersSummary([]));
        setOrdersError(getSafeError(err?.message));
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const refreshPurchases = useCallback(async (filters = {}) => {
    try {
      setPurchasesLoading(true);
      setPurchasesError(null);

      const query = { ...filters };
      if (!query.storeId && selectedStore) {
        query.storeId = selectedStore;
      }

      const response = await getPurchaseOrders(query);
      if (response.success) {
        setPurchases(Array.isArray(response?.data) ? response.data : []);
      } else {
        setPurchases([]);
        setPurchasesError(getSafeError(response?.error));
      }

      return response;
    } catch (err) {
      setPurchases([]);
      setPurchasesError(getSafeError(err?.message));
      return { success: false, error: getSafeError(err?.message), data: [] };
    } finally {
      setPurchasesLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    refreshPurchases();
  }, [selectedStore, refreshPurchases]);

  // Fetch transfers
  const refreshTransfers = useCallback(async (filters = {}) => {
    try {
      setTransfersLoading(true);
      setTransfersError(null);

      const query = { ...filters };
      if (!query.storeId && selectedStore) {
        query.storeId = selectedStore;
      }

      const response = await getTransfers(query);
      if (response.success) {
        setTransfers(Array.isArray(response?.data) ? response.data : []);
      } else {
        setTransfers([]);
        setTransfersError(getSafeError(response?.error));
      }

      return response;
    } catch (err) {
      setTransfers([]);
      setTransfersError(getSafeError(err?.message));
      return { success: false, error: getSafeError(err?.message), data: [] };
    } finally {
      setTransfersLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    refreshTransfers();
  }, [selectedStore, refreshTransfers]);

  // Create a new machine
  const handleCreateMachine = async (machineData) => {
    try {
      setCreateMachineLoading(true);
      setCreateMachineError(null);
      const response = await createMachine(machineData);
      if (response.success && response.data) {
        const refreshed = await getMachinesByStore(selectedStore);
        if (refreshed.success) {
          setMachines(Array.isArray(refreshed?.data) ? refreshed.data.map(normalizeMachine) : []);
        }
        return {
          success: true,
          data: response.data,
          message: response.message
        };
      } else {
        const errorMsg = response.error || 'Failed to create machine';
        setCreateMachineError(errorMsg);
        return {
          success: false,
          error: errorMsg,
          errors: response.errors
        };
      }
    } catch (err) {
      setCreateMachineError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setCreateMachineLoading(false);
    }
  };

  // Create a new spare part
  const handleCreateSparePart = async (spareData) => {
    try {
      setCreateSpareLoading(true);
      setCreateSpareError(null);
      if (import.meta.env.DEV) {
        console.log("Sending data:", spareData);
      }
      const response = await createSparePart(spareData);
      if (response.success && response.data) {
        const refreshed = await getSpareParts({ storeId: selectedStore });
        if (refreshed.success) {
          setSpareParts(Array.isArray(refreshed?.data) ? refreshed.data.map(normalizeSparePart) : []);
        }
        return {
          success: true,
          data: response.data,
          message: response.message
        };
      } else {
        const errorMsg = response.error || 'Failed to create spare part';
        setCreateSpareError(errorMsg);
        return {
          success: false,
          error: errorMsg,
          errors: response.errors
        };
      }
    } catch (err) {
      setCreateSpareError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setCreateSpareLoading(false);
    }
  };

  // Create a new order
  const handleCreateOrder = async (orderData) => {
    try {
      setCreateOrderLoading(true);
      setCreateOrderError(null);
      const response = await createOrder(orderData);
      if (response.success && response.data) {
        const refreshed = await getOrders();
        if (refreshed.success) {
          setOrders(Array.isArray(refreshed?.data) ? refreshed.data : []);
          setOrdersSummary(refreshed?.summary || buildOrdersSummary(Array.isArray(refreshed?.data) ? refreshed.data : []));
        }
        return {
          success: true,
          data: response.data,
          message: response.message
        };
      } else {
        const errorMsg = response.error || 'Failed to create order';
        setCreateOrderError(errorMsg);
        return {
          success: false,
          error: errorMsg,
          errors: response.errors
        };
      }
    } catch (err) {
      setCreateOrderError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setCreateOrderLoading(false);
    }
  };

  const handleCreatePurchaseOrder = async (poData) => {
    try {
      setCreatePurchaseLoading(true);
      setCreatePurchaseError(null);
      const response = await createPurchaseOrder(poData);
      if (response.success && response.data) {
        const purchaseStoreId = poData.storeId || poData.store_id || selectedStore;
        const refreshed = await getSpareParts({ storeId: purchaseStoreId });
        if (refreshed.success) {
          setSpareParts(Array.isArray(refreshed?.data) ? refreshed.data.map(normalizeSparePart) : []);
        }
        await refreshPurchases({ storeId: purchaseStoreId });
        return {
          success: true,
          data: response.data,
          message: response.message
        };
      } else {
        const errorMsg = response.error || 'Failed to create purchase order';
        setCreatePurchaseError(errorMsg);
        return {
          success: false,
          error: errorMsg,
          errors: response.errors
        };
      }
    } catch (err) {
      setCreatePurchaseError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setCreatePurchaseLoading(false);
    }
  };

  const handleDeletePurchaseOrder = async (purchaseId) => {
    try {
      setDeletePurchaseLoading(true);
      setDeletePurchaseError(null);
      const response = await deletePurchaseOrder(purchaseId);
      if (response.success) {
        await refreshPurchases();
        const refreshed = await getSpareParts({ storeId: selectedStore });
        if (refreshed.success) {
          setSpareParts(Array.isArray(refreshed?.data) ? refreshed.data.map(normalizeSparePart) : []);
        }
      } else {
        setDeletePurchaseError(response.error || 'Failed to delete purchase order');
      }
      return response;
    } catch (err) {
      const message = getSafeError(err?.message);
      setDeletePurchaseError(message);
      return { success: false, error: message };
    } finally {
      setDeletePurchaseLoading(false);
    }
  };

  const handleDeleteMachine = async (machineId) => {
    const targetId = String(machineId || "").trim();
    if (!targetId) {
      const message = "Invalid machine ID";
      setDeleteMachineError(message);
      return { success: false, error: message };
    }

    let removedMachine = null;

    try {
      setDeleteMachineLoading(true);
      setDeleteMachineError(null);

      setMachines((prev) => {
        const next = [];
        prev.forEach((machine) => {
          if (getMachineRecordId(machine) === targetId) {
            removedMachine = machine;
            return;
          }
          next.push(machine);
        });
        return next;
      });

      const response = await deleteMachine(targetId);
      if (!response.success) {
        if (removedMachine) {
          setMachines((prev) => {
            if (prev.some((machine) => getMachineRecordId(machine) === targetId)) {
              return prev;
            }
            return [removedMachine, ...prev];
          });
        }

        const message = response.error || "Failed to delete machine";
        setDeleteMachineError(message);
        return { success: false, error: message };
      }

      return response;
    } catch (err) {
      if (removedMachine) {
        setMachines((prev) => {
          if (prev.some((machine) => getMachineRecordId(machine) === targetId)) {
            return prev;
          }
          return [removedMachine, ...prev];
        });
      }

      const message = getSafeError(err?.message);
      setDeleteMachineError(message);
      return { success: false, error: message };
    } finally {
      setDeleteMachineLoading(false);
    }
  };

  // Create a new transfer
  const handleCreateTransfer = async (transferData) => {
    try {
      setCreateTransferLoading(true);
      setCreateTransferError(null);
      const response = await createTransfer(transferData);
      if (response.success && response.data) {
        // Refresh spare parts for both stores
        const fromStoreId = transferData.from_store_id || transferData.fromStoreId;
        const toStoreId = transferData.to_store_id || transferData.toStoreId;
        
        if (fromStoreId) {
          const refreshedFrom = await getSpareParts({ storeId: fromStoreId });
          if (refreshedFrom.success && fromStoreId === selectedStore) {
            setSpareParts(Array.isArray(refreshedFrom?.data) ? refreshedFrom.data.map(normalizeSparePart) : []);
          }
        }
        
        if (toStoreId) {
          const refreshedTo = await getSpareParts({ storeId: toStoreId });
          if (refreshedTo.success && toStoreId === selectedStore) {
            setSpareParts(Array.isArray(refreshedTo?.data) ? refreshedTo.data.map(normalizeSparePart) : []);
          }
        }
        
        await refreshTransfers();
        return {
          success: true,
          data: response.data,
          message: response.message
        };
      } else {
        const errorMsg = response.error || 'Failed to create transfer';
        setCreateTransferError(errorMsg);
        return {
          success: false,
          error: errorMsg,
          errors: response.errors
        };
      }
    } catch (err) {
      setCreateTransferError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setCreateTransferLoading(false);
    }
  };

  // Memoized/computed values
  const currentStore = useMemo(() => stores.find(s => s.id === selectedStore) || stores[0] || null, [selectedStore, stores]);
  // Debug logs for every render (temporary)
  // Debug logs removed
  useEffect(() => {}, [stores, selectedStore]);
  const filteredMachines = useMemo(() => {
    if (!searchQuery) return machines;
    const query = searchQuery.toLowerCase();
    return machines.filter(m => String(m.name || "").toLowerCase().includes(query));
  }, [machines, searchQuery]);
  const filteredSpareParts = useMemo(() => {
    if (!searchQuery) return spareParts;
    const query = searchQuery.toLowerCase();
    return spareParts.filter(sp => String(sp.name || "").toLowerCase().includes(query));
  }, [spareParts, searchQuery]);
  const lowStockMachines = useMemo(() => machines.filter((machine) => {
    const quantity = Number(machine.quantity ?? machine.quantity_available ?? machine.stock ?? 0);
    const minRequired = Number(machine.minRequired ?? machine.minimumRequired ?? machine.minimum_required ?? 0);
    return quantity <= minRequired;
  }), [machines]);
  const lowStockSpareParts = useMemo(() => spareParts.filter((part) => {
    const quantity = Number(part.quantity ?? part.quantity_available ?? part.availableQty ?? part.available_qty ?? part.stock ?? 0);
    const minRequired = Number(part.minRequired ?? part.minimumRequired ?? part.minimum_required ?? part.min_required ?? 0);
    return quantity <= minRequired;
  }), [spareParts]);
  const expiringWarranties = useMemo(() => machines.filter((m) => {
    const expiry = m.warrantyExpiryDate ?? m.warranty_expiry_date ?? m.warranty;
    return expiry && new Date(expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }), [machines]);
  const totalAlerts = useMemo(() => alerts.length, [alerts]);
  
  // Helper function to find a machine by ID
  const getMachineById = (id) => machines.find(m => m.id === id || m._id === id);

  // Context value
  const value = {
    darkMode,
    setDarkMode,
    toggleTheme,
    stores,
    selectedStore,
    setSelectedStore,
    refreshStores, // Expose refreshStores in context
    currentStore,
    searchQuery,
    setSearchQuery,
    machines,
    filteredMachines,
    spareParts,
    filteredSpareParts,
    alerts,
    orders,
    purchases,
    ordersSummary,
    lowStockMachines,
    lowStockSpareParts,
    expiringWarranties,
    totalAlerts,
    getMachineById,
    handleCreateOrder,
    createOrderLoading,
    createOrderError,
    createPurchaseLoading,
    createPurchaseError,
    deletePurchaseLoading,
    deletePurchaseError,
    deleteMachineLoading,
    deleteMachineError,
    handleCreatePurchaseOrder,
    handleDeletePurchaseOrder,
    handleDeleteMachine,
    refreshPurchases,
    handleCreateMachine,
    createMachineLoading,
    createMachineError,
    handleCreateSparePart,
    createSpareLoading,
    createSpareError,
    transfers,
    transfersLoading,
    transfersError,
    createTransferLoading,
    createTransferError,
    handleCreateTransfer,
    refreshTransfers,
    loading,
    storeLoading,
    alertsLoading,
    ordersLoading,
    purchasesLoading,
    error,
    storeError,
    alertsError,
    ordersError,
    purchasesError,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
