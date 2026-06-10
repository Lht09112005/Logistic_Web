"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { offlineDB } from "./offline-db";

export interface OfflineState {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Number of queued mutations pending sync */
  queueCount: number;
  /** Timestamp of last successful sync */
  lastSyncAt: number | null;
  /** Whether a sync is in progress */
  syncing: boolean;
  /** Whether the app was installed as PWA */
  isInstalled: boolean;
  /** Whether Service Worker is registered */
  swRegistered: boolean;
}

const STORAGE_KEY = "logistiq-offline-last-sync";

export function useOfflineSync() {
  // SAFE default state — no browser APIs that crash during SSR
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    queueCount: 0,
    lastSyncAt: null,
    syncing: false,
    isInstalled: false,
    swRegistered: false,
  });

  // Read browser-only values after mount (SSR-safe)
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isOnline: navigator.onLine,
      lastSyncAt: (() => {
        try {
          const v = localStorage.getItem(STORAGE_KEY);
          return v ? Number(v) : null;
        } catch {
          return null;
        }
      })(),
    }));
  }, []);

  const syncInProgress = useRef(false);
  const flushFn = useRef<(() => Promise<void>) | null>(null);

  // ─── Online/Offline detection ────────────────────────────

  useEffect(() => {
    const handleOnline = async () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      // Auto-sync when coming back online
      await flushFn.current?.();
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ─── PWA install detection ───────────────────────────────

  useEffect(() => {
    // Check if running in standalone mode (installed PWA)
    const isStandalone =
      (window.navigator as unknown as Record<string, unknown>).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    setState((prev) => ({ ...prev, isInstalled: isStandalone }));
  }, []);

  // ─── Register Service Worker ─────────────────────────────

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          setState((prev) => ({ ...prev, swRegistered: true }));

          // Listen for updates
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New version available
                  console.log("[PWA] New version available — refresh to update");
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    }
  }, []);

  // ─── Periodic queue count check ──────────────────────────

  useEffect(() => {
    const check = async () => {
      try {
        const count = await offlineDB.getQueueCount();
        setState((prev) => ({ ...prev, queueCount: count }));
      } catch {
        // IndexedDB not available
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // ─── Sync queued mutations ──────────────────────────────

  const flushMutations = useCallback(async () => {
    if (syncInProgress.current || !navigator.onLine) return;
    syncInProgress.current = true;

    setState((prev) => ({ ...prev, syncing: true }));

    try {
      const mutations = await offlineDB.getQueuedMutations();
      if (mutations.length === 0) {
        setState((prev) => ({ ...prev, syncing: false, queueCount: 0 }));
        syncInProgress.current = false;
        return;
      }

      const api = (await import("./api")).default;

      for (const mutation of mutations) {
        try {
          const response = await api({
            method: mutation.method,
            url: mutation.url,
            data: mutation.body,
            headers: mutation.headers,
          });

          if (response.status >= 200 && response.status < 300) {
            await offlineDB.removeMutation(mutation.id!);
          } else if (response.status >= 400 && response.status < 500) {
            // Client error — don't retry, remove from queue
            await offlineDB.removeMutation(mutation.id!);
          } else {
            await offlineDB.incrementRetry(mutation.id!);
          }
        } catch {
          await offlineDB.incrementRetry(mutation.id!);
        }
      }

      // Remove mutations with too many retries
      const remaining = await offlineDB.getQueuedMutations();
      for (const m of remaining) {
        if (m.retries >= 10) {
          await offlineDB.removeMutation(m.id!);
        }
      }

      const now = Date.now();
      localStorage.setItem(STORAGE_KEY, String(now));
      setState((prev) => ({
        ...prev,
        lastSyncAt: now,
        queueCount: Math.max(0, remaining.filter((r) => r.retries < 10).length),
      }));
    } catch (err) {
      console.warn("[OfflineSync] Sync error:", err);
    }

    setState((prev) => ({ ...prev, syncing: false }));
    syncInProgress.current = false;
  }, []);

  // Keep flushFn ref in sync
  useEffect(() => {
    flushFn.current = flushMutations;
  }, [flushMutations]);

  // ─── Queue a mutation for later sync ─────────────────────

  const queueCheckpointUpdate = useCallback(
    async (shipmentId: string, checkpoints: unknown[]) => {
      await offlineDB.queueMutation(
        `/api/shipments/${shipmentId}`,
        "PUT",
        { checkpoints },
        { "Content-Type": "application/json" }
      );

      setState((prev) => ({ ...prev, queueCount: prev.queueCount + 1 }));
    },
    []
  );

  return {
    ...state,
    flushMutations,
    queueCheckpointUpdate,
  };
}
