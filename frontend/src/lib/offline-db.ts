"use client";

/**
 * LogistiQ Offline Database — IndexedDB wrapper
 *
 * Stores:
 * - shipments: Cached shipment data for offline viewing
 * - checkpoints: Queued checkpoint updates (synced when online)
 * - metadata: Last sync timestamps
 */

const DB_NAME = "logistiq-offline";
const DB_VERSION = 2;

export interface OfflineShipment {
  id: string;
  shipmentCode: string;
  status: string;
  driverId?: string;
  data: unknown;
  cachedAt: number;
}

export interface QueuedCheckpoint {
  id?: number;
  shipmentId: string;
  checkpointId: string;
  timestamp: number;
  retries: number;
}

export interface QueuedMutation {
  id?: number;
  url: string;
  method: "PUT" | "POST" | "DELETE";
  body: unknown;
  headers: Record<string, string>;
  createdAt: number;
  retries: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("shipments")) {
        const store = db.createObjectStore("shipments", { keyPath: "id" });
        store.createIndex("driverId", "driverId", { unique: false });
        store.createIndex("cachedAt", "cachedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("mutations")) {
        const store = db.createObjectStore("mutations", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("retries", "retries", { unique: false });
      }

      if (!db.objectStoreNames.contains("metadata")) {
        db.createObjectStore("metadata", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Shipments ──────────────────────────────────────────────

export const offlineDB = {
  /** Cache shipment data for offline viewing */
  async cacheShipments(driverId: string, shipments: unknown[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("shipments", "readwrite");
    const store = tx.objectStore("shipments");

    const now = Date.now();
    for (const s of shipments as Array<Record<string, unknown>>) {
      store.put({
        id: s.id as string,
        shipmentCode: s.shipmentCode as string,
        status: s.status as string,
        driverId,
        data: s,
        cachedAt: now,
      } satisfies OfflineShipment);
    }

    // Clean old entries (keep max 100 per driver)
    const count = await new Promise<number>((resolve) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
    });
    if (count > 100) {
      const index = store.index("cachedAt");
      const range = IDBKeyRange.upperBound(now - 7 * 24 * 60 * 60 * 1000); // >7 days
      const deleteReq = index.openCursor(range);
      deleteReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Get cached shipments for a driver */
  async getCachedShipments(driverId: string): Promise<OfflineShipment[]> {
    const db = await openDB();
    const tx = db.transaction("shipments", "readonly");
    const store = tx.objectStore("shipments");
    const index = store.index("driverId");

    return new Promise((resolve, reject) => {
      const req = index.getAll(driverId);
      req.onsuccess = () => resolve(req.result as OfflineShipment[]);
      req.onerror = () => reject(req.error);
    });
  },

  /** Get single cached shipment */
  async getCachedShipment(id: string): Promise<OfflineShipment | undefined> {
    const db = await openDB();
    const tx = db.transaction("shipments", "readonly");
    const store = tx.objectStore("shipments");

    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as OfflineShipment | undefined);
      req.onerror = () => reject(req.error);
    });
  },

  // ─── Mutations Queue ──────────────────────────────────────

  /** Queue a mutation to be synced when online */
  async queueMutation(
    url: string,
    method: "PUT" | "POST" | "DELETE",
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<number> {
    const db = await openDB();
    const tx = db.transaction("mutations", "readwrite");
    const store = tx.objectStore("mutations");

    const mutation: QueuedMutation = {
      url,
      method,
      body,
      headers,
      createdAt: Date.now(),
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const req = store.add(mutation);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  },

  /** Get all queued mutations */
  async getQueuedMutations(): Promise<QueuedMutation[]> {
    const db = await openDB();
    const tx = db.transaction("mutations", "readonly");
    const store = tx.objectStore("mutations");

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as QueuedMutation[]);
      req.onerror = () => reject(req.error);
    });
  },

  /** Remove a mutation from queue after successful sync */
  async removeMutation(id: number): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("mutations", "readwrite");
    const store = tx.objectStore("mutations");
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Increment retry count */
  async incrementRetry(id: number): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("mutations", "readwrite");
    const store = tx.objectStore("mutations");
    const req = store.get(id);
    req.onsuccess = () => {
      const mutation = req.result as QueuedMutation | undefined;
      if (mutation) {
        mutation.retries += 1;
        store.put(mutation);
      }
    };
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Get mutation queue count */
  async getQueueCount(): Promise<number> {
    const db = await openDB();
    const tx = db.transaction("mutations", "readonly");
    const store = tx.objectStore("mutations");
    return new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // ─── Metadata ─────────────────────────────────────────────

  /** Set a metadata value */
  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("metadata", "readwrite");
    const store = tx.objectStore("metadata");
    store.put({ key, value, updatedAt: Date.now() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Get a metadata value */
  async getMeta(key: string): Promise<unknown | undefined> {
    const db = await openDB();
    const tx = db.transaction("metadata", "readonly");
    const store = tx.objectStore("metadata");
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as { value: unknown } | undefined)?.value);
      req.onerror = () => reject(req.error);
    });
  },
};
