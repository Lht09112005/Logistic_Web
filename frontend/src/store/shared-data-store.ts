"use client";

import { create } from "zustand";
import { shipmentsApi, inventoryApi, warehousesApi } from "@/lib/api";
import { useAppStore } from "./app-store";
import { offlineDB } from "@/lib/offline-db";
import { CACHE_KEYS } from "@/lib/use-offline-cache";

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

    // Cache fresh data to IndexedDB for offline use
    if (updates.shipmentStats) {
      offlineDB.cacheAppData(CACHE_KEYS.SHIPMENT_STATS, updates.shipmentStats, "stats").catch((e) => console.warn('[OfflineCache] stats cache error:', e));
    }
    if (updates.alerts && Array.isArray(updates.alerts)) {
      offlineDB.cacheAppData(CACHE_KEYS.ALERTS, updates.alerts, "alerts").catch((e) => console.warn('[OfflineCache] alerts cache error:', e));
    }
    if (updates.warehouses && Array.isArray(updates.warehouses)) {
      offlineDB.cacheAppData(CACHE_KEYS.WAREHOUSES_LIST, updates.warehouses, "warehouses").catch((e) => console.warn('[OfflineCache] warehouses cache error:', e));
    }
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
