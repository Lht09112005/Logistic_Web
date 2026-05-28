/**
 * Server-side API utility for Next.js Server Components
 * Supports SSR (cache: 'no-store'), ISR (next: { revalidate }), and SSG (generateStaticParams)
 *
 * Uses NextAuth server session to attach JWT token automatically.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

interface FetchOptions {
  cache?: RequestCache | "no-store" | "force-cache";
  revalidate?: number;
  tags?: string[];
}

/**
 * Server-side fetch wrapper that:
 * - Attaches JWT token from NextAuth server session
 * - Supports SSR/ISR caching strategies via options
 * - Returns parsed JSON data or falls back gracefully
 */
export async function serverFetch(endpoint: string, options: FetchOptions = {}) {
  const { cache, revalidate, tags } = options;

  // Build fetch init
  const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  // Apply caching strategy
  if (cache) {
    init.cache = cache;
  }
  if (revalidate !== undefined) {
    init.next = { ...init.next, revalidate };
  }
  if (tags) {
    init.next = { ...init.next, tags };
  }

  // Attempt to attach server session token
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const accessToken = (session as any)?.accessToken;
    if (accessToken && !accessToken.startsWith("mock-")) {
      (init.headers as Record<string, string>)["Authorization"] = `Bearer ${accessToken}`;
    }
  } catch {
    // Auth module not available or session fetch failed — proceed without token
  }

  const url = `${API_URL}${endpoint}`;

  try {
    const res = await fetch(url, init as RequestInit);

    if (!res.ok) {
      console.warn(`[serverFetch] ${url} returned ${res.status}`);
      return null;
    }

    const json = await res.json();
    return json.data ?? json;
  } catch (err) {
    console.warn(`[serverFetch] Failed to fetch ${url}:`, err);
    return null;
  }
}

/**
 * SSR: Always fetch fresh data (never cache)
 */
export function ssrFetch(endpoint: string) {
  return serverFetch(endpoint, { cache: "no-store" });
}

/**
 * ISR: Fetch with time-based revalidation
 */
export function isrFetch(endpoint: string, revalidateSeconds = 60) {
  return serverFetch(endpoint, { revalidate: revalidateSeconds });
}

/**
 * SSG: Fetch once at build time (force cache)
 */
export function ssgFetch(endpoint: string) {
  return serverFetch(endpoint, { cache: "force-cache" });
}
