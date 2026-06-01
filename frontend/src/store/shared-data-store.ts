"use client";

import { create } from "zustand";
import { shipmentsApi, inventoryApi, warehousesApi } from "@/lib/api";
import { useAppStore } from "./app-store";

// ─── Types ───────────────────────────────────────────────────────────

export interface ShipmentStats {
  total: number;
  inTransit: number;
  delivered: number;
  pending: number;
  failed: number;
  pendingForCurrentUser?: number;
}

// ─── Global polling state (outside Zustand to avoid serialization) ───

let _intervalId: ReturnType<typeof setInterval> | null = null;

// ─── Store ───────────────────────────────────────────────────────────

interface SharedDataState {
  shipmentStats: ShipmentStats | null;
  alerts: unknown[];
  warehouses: unknown[];
  loading: boolean;
  error: boolean;
  lastUpdated: Date | null;

  fetchAll: () => Promise<void>;
  refresh: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
}

export const useSharedDataStore = create<SharedDataState>((set, get) => ({
  shipmentStats: null,
  alerts: [],
  warehouses: [],
  loading: true,
  error: false,
  lastUpdated: null,

  fetchAll: async () => {
    const results = await Promise.allSettled([
      shipmentsApi.getStats(),
      inventoryApi.getAlerts({ isResolved: "false" }),
      warehousesApi.getAll(),
    ]);

    const [statsResult, alertsResult, whResult] = results;
    const updates: Partial<SharedDataState> = {
      lastUpdated: new Date(),
    };

    if (statsResult.status === "fulfilled") {
      updates.shipmentStats = statsResult.value.data.data ?? null;
    }

    if (alertsResult.status === "fulfilled") {
      const alertsData = alertsResult.value.data.data ?? [];
      updates.alerts = alertsData;
      // Sync to legacy app store so the sidebar nav badge stays updated
      try {
        useAppStore.getState().setAlerts(alertsData);
      } catch { /* ignore */ }
    }

    if (whResult.status === "fulfilled") {
      updates.warehouses = Array.isArray(whResult.value.data.data)
        ? whResult.value.data.data
        : [];
    }

    updates.loading = false;
    updates.error =
      statsResult.status === "rejected" ||
      alertsResult.status === "rejected" ||
      whResult.status === "rejected";

    set(updates as SharedDataState);
  },

  refresh: async () => {
    await get().fetchAll();
  },

  startPolling: (intervalMs = 15_000) => {
    if (_intervalId) return; // Already running
    get().fetchAll();
    _intervalId = setInterval(() => {
      get().fetchAll();
    }, intervalMs);
  },

  stopPolling: () => {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
  },
}));
