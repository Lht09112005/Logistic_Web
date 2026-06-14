/* ============================================================
   LogistiQ Service Worker — PWA Offline Support
   Version: 1.1.0
   ============================================================ */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `logistiq-static-${CACHE_VERSION}`;
const API_CACHE = `logistiq-api-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `logistiq-dynamic-${CACHE_VERSION}`;

// ─── Assets to pre-cache (App Shell) ─────────────────────────
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/dashboard/shipments',
  '/dashboard/shipments/new',
  '/dashboard/inventory',
  '/dashboard/warehouse',
  '/dashboard/alerts',
  '/dashboard/analytics',
  '/offline',
  '/manifest.json',
];

// ─── API routes to cache for offline ─────────────────────────
const API_CACHE_PATTERNS = [
  /\/api\/shipments/,
  /\/api\/inventory/,
  /\/api\/warehouses/,
  /\/api\/products/,
  /\/api\/auth\/me/,
  /\/api\/auth\/drivers/,
];

// ─── Install: Pre-cache App Shell ────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Pre-cache failed for some URLs:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: Clean old caches ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('logistiq-') && !key.includes(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Helper: Check if request is an API call ─────────────────
function isApiRequest(url) {
  return API_CACHE_PATTERNS.some((pattern) => pattern.test(url));
}

// ─── Helper: Check if request is a navigation (HTML page) ────
function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('Accept')?.includes('text/html'));
}

// ─── Helper: Check if request is a static asset ──────────────
function isStaticAsset(url) {
  const ext = new URL(url).pathname.split('.').pop()?.toLowerCase();
  return ['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'woff', 'woff2', 'ttf', 'eot'].includes(ext);
}

// ─── Helper: Network-first with fallback to cache ────────────
async function networkFirst(request, cacheName, timeoutMs = 5000) {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );
    const response = await Promise.race([fetch(request), timeoutPromise]);
    if (request.method === 'GET' && response && response.ok) {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ success: false, message: 'Không có kết nối mạng', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Helper: Stale-while-revalidate ───────────────────────
async function staleWhileRevalidate(request, cacheName = API_CACHE) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (request.method === 'GET' && response && response.ok) {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ─── Helper: Serve navigation from cache (App Shell) ────────
async function serveNavigation(request) {
  try {
    const response = await fetch(request);
    if (request.method === 'GET' && response && response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    // Try to serve the cached page
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback to /
    const root = await caches.match('/');
    if (root) return root;
    // Last resort: offline page
    return caches.match('/offline');
  }
}

// ─── Background Sync for queued mutations ────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'logistiq-sync') {
    event.waitUntil(syncQueuedMutations());
  }
});

async function syncQueuedMutations() {
  try {
    // Open IndexedDB (if available)
    const db = await openSyncDB();
    const tx = db.transaction('mutations', 'readonly');
    const store = tx.objectStore('mutations');
    const allMutations = await store.getAll();

    for (const mutation of allMutations) {
      try {
        const response = await fetch(mutation.url, {
          method: mutation.method,
          headers: { 'Content-Type': 'application/json', ...mutation.headers },
          body: mutation.body ? JSON.stringify(mutation.body) : undefined,
        });
        if (response.ok) {
          // Remove from queue
          const deleteTx = db.transaction('mutations', 'readwrite');
          await deleteTx.objectStore('mutations').delete(mutation.id);
        }
      } catch {
        // Will retry on next sync
        console.warn('[SW] Sync failed for:', mutation.url);
      }
    }
  } catch (err) {
    console.warn('[SW] Sync error:', err);
  }
}

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('logistiq-offline', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('mutations')) {
        db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Main Fetch Handler ──────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Cache API only supports GET requests. Skip non-GET requests.
  if (request.method !== 'GET') {
    return;
  }

  // Skip browser-sync, extensions, etc.
  if (!url.startsWith(self.location.origin) && !url.startsWith('http://localhost') && !url.startsWith('https://')) {
    return;
  }

  // Handle API GET requests: stale-while-revalidate
  if (isApiRequest(url) && request.method === 'GET') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Handle navigation: network-first with App Shell fallback
  if (isNavigationRequest(request)) {
    event.respondWith(serveNavigation(request));
    return;
  }

  // Handle static assets: stale-while-revalidate
  // Next.js generates content-hashed filenames (chunk-abc123.js),
  // so after deploy the new chunk names won't be in cache → cache miss → fetch from network.
  // During normal use, cached chunks serve instantly for fast loads.
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ─── Listen for messages from the client ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    caches.keys().then((keys) => {
      keys.filter((k) => k.startsWith('logistiq-')).forEach((k) => caches.delete(k));
    });
  }
});
