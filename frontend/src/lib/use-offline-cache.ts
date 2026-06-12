"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { offlineDB } from "./offline-db";

/**
 * Cache keys for different data types used across the app.
 */
export const CACHE_KEYS = {
  SHIPMENT_STATS: "app:shipmentStats",
  ALERTS: "app:alerts",
  WAREHOUSES_LIST: "app:warehouses",
  INVENTORY_LIST: "app:inventory",
  WAREHOUSE_DETAIL: (id: string) => `app:warehouse:${id}`,
  INVENTORY_DETAIL: (id: string) => `app:inventory:${id}`,
} as const;

/**
 * A generic hook that wraps data fetching with automatic offline caching.
 *
 * - When online: fetches fresh data, caches it to IndexedDB, returns it
 * - When offline or fetch fails: returns cached data from IndexedDB (if any)
 * - Provides a `refresh` function to manually re-fetch
 *
 * @param cacheKey - Unique key to store/retrieve cached data
 * @param fetcher - Async function that fetches fresh data
 * @param options - Optional config
 */
export function useOfflineCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: {
    /** How often to auto-refresh (ms). Default 0 = no polling */
    pollInterval?: number;
    /** Called when data is loaded (fresh or cached) */
    onData?: (data: T) => void;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchWithCache = useCallback(async () => {
    let fetched = false;

    // Try network first
    if (typeof navigator === "undefined" || navigator.onLine) {
      try {
        const fresh = await fetcherRef.current();
        setData(fresh);
        setIsOffline(false);
        fetched = true;

        // Cache the fresh data
        offlineDB.cacheAppData(cacheKey, fresh).catch(() => {});
        options?.onData?.(fresh);
      } catch {
        // Network failed — will try cache below
      }
    }

    // If not fetched from network, try cache
    if (!fetched) {
      const cached = await offlineDB.getCachedAppData<T>(cacheKey);
      if (cached !== null) {
        setData(cached);
        setIsOffline(true);
        options?.onData?.(cached);
      }
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, [cacheKey, options]);

  // Initial fetch
  useEffect(() => {
    fetchWithCache();
  }, [fetchWithCache]);

  // Polling
  useEffect(() => {
    if (!options?.pollInterval || options.pollInterval <= 0) return;

    intervalRef.current = setInterval(() => {
      fetchWithCache();
    }, options.pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchWithCache, options?.pollInterval]);

  // Online/offline listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchWithCache(); // Re-fetch when coming back online
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchWithCache]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWithCache();
    setRefreshing(false);
  }, [fetchWithCache]);

  return {
    data,
    loading,
    isOffline,
    lastUpdated,
    refreshing,
    refresh: handleRefresh,
  };
}

/**
 * Extract data from API response (handles both { data: [...] } and { data: { data: [...] } } patterns)
 */
export function extractApiData<T>(response: unknown): T | null {
  if (!response) return null;
  const r = response as Record<string, unknown>;
  // axios response: { data: { data: [...], meta: {...} } }
  if (r.data && typeof r.data === "object") {
    const inner = r.data as Record<string, unknown>;
    if (Array.isArray(inner.data)) return inner.data as T;
    if (inner.data && typeof inner.data === "object") return inner.data as T;
  }
  // Direct array
  if (Array.isArray(r.data)) return r.data as T;
  return response as T;
}
