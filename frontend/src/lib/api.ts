import axios from "axios";
import { getSession, signOut } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ─── Token cache (module-level, avoids getSession() calls on every request) ───
let _tokenCache: string | null = null;
let _tokenInitPromise: Promise<void> | null = null;

/** Initialize token cache from NextAuth session (called once by AuthContext) */
export function setAccessToken(token: string | null) {
  _tokenCache = token;
}

async function ensureToken(): Promise<string | null> {
  // 1. Check refreshed token (in-memory, from refresh logic below)
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refreshed = (window as any).__newAccessToken;
    if (refreshed) return refreshed;
  }

  // 2. Check cached token (set by AuthContext via setAccessToken)
  if (_tokenCache) return _tokenCache;

  // 3. Fallback — read directly from NextAuth session
  if (!_tokenInitPromise) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _tokenInitPromise = getSession().then((session: any) => {
      // NextAuth v5 stores extra fields differently depending on callbacks config
      // Try multiple paths: top-level, user, and accessToken sub-key
      const token =
        session?.accessToken ||
        (session as any)?.user?.accessToken ||
        null;

      if (token && !token.startsWith("mock-")) {
        _tokenCache = token;
      } else {
        _tokenCache = null;
      }
      _tokenInitPromise = null;
    }).catch(() => {
      _tokenCache = null;
      _tokenInitPromise = null;
    });
  }
  await _tokenInitPromise;
  return _tokenCache;
}

// Attach access token from cache (NO repeated getSession() calls)
api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const token = await ensureToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 — try refresh token, then retry; if mock token just ignore silently
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      typeof window === "undefined" ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    // Get session to check if token is real or mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session: any = await getSession();
    const accessToken = session?.accessToken as string | undefined;
    const refreshToken = session?.refreshToken as string | undefined;
    const isMockToken = !accessToken || accessToken.startsWith("mock-");

    // Mock token — skip silently, don't retry or sign out
    if (isMockToken) {
      return Promise.reject(error);
    }

    // No refresh token — sign out
    if (!refreshToken) {
      await signOut({ callbackUrl: "/auth/login" });
      return Promise.reject(error);
    }

    // Queue concurrent requests while refreshing
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Call backend refresh endpoint directly (no auth interceptor)
      const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const newAccessToken: string = res.data?.data?.accessToken;

      if (!newAccessToken) throw new Error("No access token returned");

      // Update NextAuth session via update (next-auth v5)
      // Since next-auth doesn't expose update client-side easily,
      // store in memory for this session lifetime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__newAccessToken = newAccessToken;

      // Patch future requests
      api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      processQueue(null, newAccessToken);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await signOut({ callbackUrl: "/auth/login" });
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;

// ===================== API helpers =====================

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: { name: string; email: string; password: string; role?: string; phone?: string }) =>
    api.post("/auth/register", data),
  refresh: (refreshToken: string) =>
    api.post("/auth/refresh", { refreshToken }),
  me: () => api.get("/auth/me"),
  updateMe: (data: Record<string, unknown>) => api.put("/auth/me", data),
  getDrivers: () => api.get("/auth/drivers"),
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) =>
    api.post("/auth/reset-password", { token, password }),
};

export const productsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get("/products", { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  getByQR: (qrCode: string) => api.get(`/products/by-qr/${qrCode}`),
  getByBarcode: (barcode: string) => api.get(`/products/by-barcode/${barcode}`),
  create: (data: Record<string, unknown>) => api.post("/products", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

export const inventoryApi = {
  getAll: (params?: Record<string, string | number | boolean>) =>
    api.get("/inventory", { params }),
  getById: (id: string) => api.get(`/inventory/${id}`),
  getAlerts: (params?: Record<string, string>) =>
    api.get("/inventory/alerts", { params }),
  create: (data: Record<string, unknown>) => api.post("/inventory", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/inventory/${id}`, data),
  resolveAlert: (id: string) => api.put(`/inventory/alerts/${id}/resolve`, {}),
};

export const shipmentsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get("/shipments", { params }),
  getById: (id: string) => api.get(`/shipments/${id}`),
  getStats: () => api.get("/shipments/stats"),
  create: (data: Record<string, unknown>) => api.post("/shipments", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/shipments/${id}`, data),
  approve: (id: string) => api.put(`/shipments/${id}/approve`, {}),
  reject: (id: string, reason: string) => api.put(`/shipments/${id}/reject`, { reason }),
  startLoading: (id: string) => api.put(`/shipments/${id}/loading`, {}),
  receive: (id: string) => api.post(`/shipments/${id}/receive`),
};

export const warehousesApi = {
  getAll: (params?: Record<string, string>) =>
    api.get("/warehouses", { params }),
  getById: (id: string) => api.get(`/warehouses/${id}`),
  create: (data: Record<string, unknown>) => api.post("/warehouses", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/warehouses/${id}`, data),
  delete: (id: string) => api.delete(`/warehouses/${id}`),
};

export const usersApi = {
  getAll: (params?: Record<string, string | number | boolean>) =>
    api.get("/users", { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: {
    name: string; email: string; password: string;
    role?: string; phone?: string;
  }) => api.post("/users", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};
