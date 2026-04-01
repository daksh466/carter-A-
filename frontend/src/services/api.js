import axios from "axios";

export const API = import.meta.env.VITE_API_URL;
const AUTH_TOKEN_KEY = "token";
const AUTH_USER_KEY = "authUser";

const ensureApiOrigin = (rawValue) => {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return "https://carter-a.onrender.com";
  }

  if (!/^https?:\/\//i.test(raw)) {
    console.warn("VITE_API_URL should be an absolute URL. Falling back to Render backend.", {
      provided: raw,
    });
    return "https://carter-a.onrender.com";
  }

  try {
    const parsed = new URL(raw);
    parsed.pathname = parsed.pathname.replace(/\/+$/, "").replace(/\/api$/i, "");
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    console.warn("Invalid VITE_API_URL. Falling back to Render backend.", {
      provided: raw,
    });
    return "https://carter-a.onrender.com";
  }
};

const readTokenFromStorage = () => {
  if (typeof window === "undefined") return "";

  const directKeyCandidates = [
    "token",
    "accessToken",
    "authToken",
    "jwt",
    "jwtToken",
    "idToken",
    "access_token",
    "auth_token",
  ];

  for (const key of directKeyCandidates) {
    const value = String(window.localStorage.getItem(key) || "").trim();
    if (value) return value;
  }

  const jsonCandidates = ["user", "auth", "session", "currentUser"];
  for (const key of jsonCandidates) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const nested =
        parsed?.token ||
        parsed?.accessToken ||
        parsed?.authToken ||
        parsed?.jwt ||
        parsed?.data?.token ||
        parsed?.data?.accessToken ||
        parsed?.user?.token ||
        parsed?.user?.accessToken;
      const token = String(nested || "").trim();
      if (token) return token;
    } catch {
      // Continue scanning other keys if one persisted blob is malformed.
    }
  }

  return "";
};

const clearAuthStorage = () => {
  if (typeof window === "undefined") return;
  const keysToClear = [
    "token",
    "accessToken",
    "authToken",
    "jwt",
    "jwtToken",
    "idToken",
    "access_token",
    "auth_token",
    "authUser",
    "user",
    "auth",
    "session",
    "currentUser",
  ];
  keysToClear.forEach((key) => window.localStorage.removeItem(key));
};

const persistAuth = ({ token, user }) => {
  if (typeof window === "undefined") return;
  const safeToken = String(token || "").trim();
  if (safeToken) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, safeToken);
  }
  if (user) {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
};

export const API_BASE_URL = ensureApiOrigin(API);
export const API_ROOT = `${API_BASE_URL}/api`;

const RESPONSE_CACHE = new Map();
const IN_FLIGHT = new Map();
const DEFAULT_CACHE_TTL_MS = 8000;

const buildCacheKey = (key, params = null) => {
  if (!params || typeof params !== "object") return key;
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, paramKey) => {
      acc[paramKey] = params[paramKey];
      return acc;
    }, {});
  return `${key}:${JSON.stringify(sorted)}`;
};

const withCachedRequest = async (cacheKey, requestFn, ttlMs = DEFAULT_CACHE_TTL_MS) => {
  const now = Date.now();
  const cached = RESPONSE_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (IN_FLIGHT.has(cacheKey)) {
    return IN_FLIGHT.get(cacheKey);
  }

  const pending = requestFn()
    .then((value) => {
      RESPONSE_CACHE.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      IN_FLIGHT.delete(cacheKey);
    });

  IN_FLIGHT.set(cacheKey, pending);
  return pending;
};

const api = axios.create({
  baseURL: API_ROOT,
});

api.interceptors.request.use((config) => {
  const token = readTokenFromStorage();
  if (token) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = Number(error?.response?.status || 0);
    if (status === 401 && typeof window !== "undefined") {
      clearAuthStorage();
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      const onLoginPage = window.location.pathname === "/login";
      if (!onLoginPage) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

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
  const status = Number(error?.response?.status || 0);
  const path = error?.config?.url || "unknown-endpoint";
  const message = status === 429
    ? (payload?.message || "Server busy, try again shortly")
    : (payload?.message || payload?.error || error?.message || "Request failed");

  // Avoid noisy error spam for optional endpoints missing in some deployments.
  if (status === 404) {
    console.warn("API endpoint not found", {
      status,
      path,
      message,
    });
  } else {
    console.error("API request failed", {
      status,
      path,
      message,
    });
  }

  return {
    success: false,
    data: null,
    message: payload?.message || "",
    error: message,
    errors: payload?.errors,
  };
};

const isNotFoundError = (error) => Number(error?.response?.status || 0) === 404;

const emptySuccess = (data = [], message = "Endpoint unavailable in this deployment") => ({
  success: true,
  data,
  message,
  error: "",
  errors: undefined,
  summary: undefined,
  pagination: undefined,
});

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
  return withCachedRequest("stores:list", async () => {
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
  });
};

export const loginUser = async ({ username, password }) => {
  try {
    const response = await api.post("/users/login", { username, password });
    const token = String(response?.data?.token || "").trim();
    const user = response?.data?.user || null;

    if (!token) {
      return { success: false, error: "Login failed: token missing", data: null };
    }

    persistAuth({ token, user });
    return { success: true, data: { token, user }, message: "Login successful" };
  } catch (error) {
    return normalizeError(error);
  }
};

export const registerUser = async ({ username, password, businessName, phone }) => {
  try {
    const response = await api.post("/users/register", {
      username,
      password,
      businessName,
      phone,
    });
    return normalizeResult(response);
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
      if (isNotFoundError(firstError) || isNotFoundError(error)) {
        return emptySuccess([], "Machines endpoint unavailable, showing empty list");
      }
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
    if (isNotFoundError(error)) {
      return emptySuccess([], "Spare parts endpoint unavailable, showing empty inventory");
    }
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
  return withCachedRequest("alerts:list", async () => {
    try {
      const response = await api.get("/alerts");
      const normalized = normalizeResult(response);
      return {
        ...normalized,
        data: unwrapArray(normalized.data, ["alerts"]),
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return emptySuccess([], "Alerts endpoint unavailable, showing no alerts");
      }
      return normalizeError(error);
    }
  });
};

export const getOrders = async (params = {}) => {
  const cacheKey = buildCacheKey("orders:list", params);
  return withCachedRequest(cacheKey, async () => {
    try {
      const response = await api.get("/orders", { params });
      const normalized = normalizeResult(response);
      return {
        ...normalized,
        data: unwrapArray(normalized.data, ["orders"]),
        summary: normalized.summary || normalized.data?.summary,
      };
    } catch (firstError) {
      if (!isNotFoundError(firstError)) {
        return normalizeError(firstError);
      }

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
  });
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
    if (!isNotFoundError(firstError)) {
      return normalizeError(firstError);
    }

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
    if (!isNotFoundError(firstError)) {
      return normalizeError(firstError);
    }

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
    if (isNotFoundError(error)) {
      return emptySuccess([], "Purchase orders endpoint unavailable, showing empty list");
    }
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
    if (isNotFoundError(error)) {
      return emptySuccess([], "Transfers endpoint unavailable, showing empty list");
    }
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
    if (isNotFoundError(error)) {
      return emptySuccess({ inTransit: 0, received: 0, delayed: 0 }, "Transfer stats unavailable");
    }
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
