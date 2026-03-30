import axios from "axios";

const resolveBaseUrl = () => {
  const configured = String(import.meta.env?.VITE_API_URL || "").trim();
  if (!configured) {
    return "http://localhost:5000/api";
  }
  if (/^https?:\/\//i.test(configured)) {
    return configured;
  }
  return configured;
};

const api = axios.create({
  baseURL: resolveBaseUrl(),
});

const normalizeResult = (response, fallbackData = null) => {
  const payload = response?.data ?? {};
  const success = payload?.success !== false;
  const data = payload?.data ?? fallbackData;

  return {
    success,
    data,
    message: payload?.message || "",
    error: payload?.error || "",
    errors: payload?.errors,
    summary: payload?.summary,
    pagination: payload?.pagination,
  };
};

const normalizeError = (error) => {
  const payload = error?.response?.data || {};
  return {
    success: false,
    data: null,
    message: payload?.message || "",
    error: payload?.error || payload?.message || error?.message || "Request failed",
    errors: payload?.errors,
  };
};

const unwrapArray = (value, fallbackKeys = []) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const key of fallbackKeys) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [];
};

export const getStores = async () => {
  try {
    const response = await api.get("/stores");
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: unwrapArray(normalized.data, ["stores"]),
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const addStore = async (payload) => {
  try {
    const response = await api.post("/stores", payload);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: normalized.data?.store || normalized.data,
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const updateStore = async (id, payload) => {
  try {
    const response = await api.put(`/stores/${id}`, payload);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: normalized.data?.store || normalized.data,
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const deleteStore = async (id) => {
  try {
    const response = await api.delete(`/stores/${id}`);
    return normalizeResult(response);
  } catch (error) {
    return normalizeError(error);
  }
};

export const getMachinesByStore = async (storeId) => {
  try {
    const response = await api.get(`/stores/${storeId}/machines`);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: unwrapArray(normalized.data, ["machines"]),
    };
  } catch (firstError) {
    try {
      const fallback = await api.get("/machines", { params: { storeId } });
      const normalized = normalizeResult(fallback);
      return {
        ...normalized,
        data: unwrapArray(normalized.data, ["machines"]),
      };
    } catch (error) {
      return normalizeError(error || firstError);
    }
  }
};

export const createMachine = async (payload) => {
  try {
    const response = await api.post("/machines", payload);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: normalized.data?.machine || normalized.data,
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const deleteMachine = async (id) => {
  try {
    const response = await api.delete(`/machines/${id}`);
    return normalizeResult(response);
  } catch (error) {
    return normalizeError(error);
  }
};

export const getSpareParts = async (params = {}) => {
  try {
    const response = await api.get("/spares", { params });
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: unwrapArray(normalized.data, ["spareParts", "inventory"]),
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const createSparePart = async (payload) => {
  try {
    const response = await api.post("/spares", payload);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: normalized.data?.sparePart || normalized.data,
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const updateSparePart = async (id, payload) => {
  try {
    const response = await api.put(`/spares/${id}`, payload);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: normalized.data?.sparePart || normalized.data,
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const deleteSparePart = async (id) => {
  try {
    const response = await api.delete(`/spares/${id}`);
    return normalizeResult(response);
  } catch (error) {
    return normalizeError(error);
  }
};

export const getAlerts = async () => {
  try {
    const response = await api.get("/alerts");
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: unwrapArray(normalized.data, ["alerts"]),
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const getOrders = async (params = {}) => {
  try {
    const response = await api.get("/orders", { params });
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: unwrapArray(normalized.data, ["orders"]),
      summary: normalized.summary || normalized.data?.summary,
    };
  } catch (firstError) {
    try {
      const fallback = await api.get("/orders-list", { params });
      const normalized = normalizeResult(fallback);
      return {
        ...normalized,
        data: unwrapArray(normalized.data, ["orders"]),
        summary: normalized.summary || normalized.data?.summary,
      };
    } catch (error) {
      return normalizeError(error || firstError);
    }
  }
};

export const createOrder = async (payload) => {
  try {
    const response = await api.post("/orders", payload);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: normalized.data?.order || normalized.data,
    };
  } catch (firstError) {
    try {
      const fallback = await api.post("/orders-list", payload);
      const normalized = normalizeResult(fallback);
      return {
        ...normalized,
        data: normalized.data?.order || normalized.data,
      };
    } catch (error) {
      return normalizeError(error || firstError);
    }
  }
};

export const deleteOrder = async (id) => {
  try {
    const response = await api.delete(`/orders/${id}`);
    return normalizeResult(response);
  } catch (firstError) {
    try {
      const fallback = await api.delete(`/orders-list/${id}`);
      return normalizeResult(fallback);
    } catch (error) {
      return normalizeError(error || firstError);
    }
  }
};

export const getPurchaseOrders = async (params = {}) => {
  try {
    const response = await api.get("/purchase-orders", { params });
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: unwrapArray(normalized.data, ["purchaseOrders", "orders"]),
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const createPurchaseOrder = async (payload) => {
  try {
    const response = await api.post("/purchase-orders", payload);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: normalized.data?.purchaseOrder || normalized.data,
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const deletePurchaseOrder = async (id) => {
  try {
    const response = await api.delete(`/purchase-orders/${id}`);
    return normalizeResult(response);
  } catch (error) {
    return normalizeError(error);
  }
};

export const getTransfers = async (params = {}) => {
  try {
    const response = await api.get("/transfers", { params });
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: unwrapArray(normalized.data, ["transfers"]),
      pagination: normalized.pagination,
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const getIncomingTransfers = async (params = {}) => {
  return getTransfers({ ...params, type: "incoming" });
};

export const getTransferStats = async (params = {}) => {
  try {
    const response = await api.get("/transfers/stats", { params });
    return normalizeResult(response);
  } catch (error) {
    return normalizeError(error);
  }
};

export const createTransfer = async (payload) => {
  try {
    const response = await api.post("/transfers", payload);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: normalized.data?.transfer || normalized.data,
    };
  } catch (error) {
    return normalizeError(error);
  }
};

export const createIncomingTransfer = async (payload) => {
  const normalizedPayload = {
    ...payload,
    type: "incoming",
  };
  return createTransfer(normalizedPayload);
};

export const markTransferReceived = async (id, payload = {}) => {
  try {
    const response = await api.patch(`/transfers/${id}/receive`, payload);
    const normalized = normalizeResult(response);
    return {
      ...normalized,
      data: normalized.data?.transfer || normalized.data,
    };
  } catch (firstError) {
    try {
      const fallback = await api.patch(`/transfers/${id}/mark-received`, payload);
      const normalized = normalizeResult(fallback);
      return {
        ...normalized,
        data: normalized.data?.transfer || normalized.data,
      };
    } catch (error) {
      return normalizeError(error || firstError);
    }
  }
};

export const getStoreOrders = async (storeId) => {
  return getOrders({ storeId });
};

export const confirmStoreOrderReceive = async (id, payload = {}) => {
  try {
    const response = await api.patch(`/orders/${id}/confirm-receive`, payload);
    return normalizeResult(response);
  } catch (error) {
    return normalizeError(error);
  }
};

export const confirmStoreOrderDispatch = async (id, payload = {}) => {
  try {
    const response = await api.patch(`/orders/${id}/confirm-dispatch`, payload);
    return normalizeResult(response);
  } catch (error) {
    return normalizeError(error);
  }
};

export default api;
