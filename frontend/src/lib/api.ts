import axios from "axios";
import { getSession, signOut } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach access token from NextAuth session
api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const session: any = await getSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }
  return config;
});

// Handle 401 — refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        // Sign out to clear session cookies and break infinite redirect loop
        await signOut({ callbackUrl: "/auth/login" });
      }
    }
    return Promise.reject(error);
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
};

export const productsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get("/products", { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  getByQR: (qrCode: string) => api.get(`/products/by-qr/${qrCode}`),
  create: (data: Record<string, unknown>) => api.post("/products", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

export const inventoryApi = {
  getAll: (params?: Record<string, string | number | boolean>) =>
    api.get("/inventory", { params }),
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
