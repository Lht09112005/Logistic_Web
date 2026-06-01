/**
 * Routing Service — OpenRouteService (ORS) Directions API
 *
 * Sử dụng OpenRouteService free tier (2000 requests/day) để lấy tuyến
 * đường bộ thực tế giữa các waypoint, thay thế đường chim bay (haversine).
 *
 * API: POST https://api.openrouteservice.org/v2/directions/driving-car
 * Docs: https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/post
 */

import { haversineDistance } from "./route-optimizer";

// ==================== TYPES ====================

export interface RouteWaypoint {
  lng: number;
  lat: number;
  label?: string;
}

export interface RoadRoute {
  /** Mảng tọa độ [lng, lat][] theo đường bộ thực tế, độ phân giải cao */
  coordinates: [number, number][];
  /** Tổng khoảng cách thực tế (km) */
  distance: number;
  /** Tổng thời gian ước tính (giây) */
  duration: number;
  /** Tốc độ trung bình toàn tuyến (km/h) */
  averageSpeed: number;
  /** Các segment chi tiết với speed từng đoạn (từ ORS steps) */
  segments?: RouteSegment[];
}

/** Một đoạn route chi tiết (tương ứng 1 step từ ORS) */
export interface RouteSegment {
  /** Khoảng cách (km) */
  distance: number;
  /** Thời gian (giây) */
  duration: number;
  /** Tốc độ trung bình đoạn này (km/h) */
  speed: number;
  /** Tên đường */
  roadName: string;
  /** Chỉ dẫn lái xe */
  instruction: string;
  /** Chỉ mục [start, end] trong coordinates array */
  waypointIndices: [number, number];
}

export interface SegmentRoadData {
  /** Khoảng cách road cho segment thứ i (km) */
  distances: number[];
  /** Chỉ mục waypoint trong coordinates array */
  waypointIndices: number[];
}

// ==================== CONFIG ====================

// Proxy qua Next.js API route (/api/routing) để tránh CORS từ browser
const PROXY_URL = "/api/routing";

// Cache với TTL 10 phút
const routeCache = new Map<string, { route: RoadRoute; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// ==================== POLYLINE DECODER ====================

/**
 * Giải mã Google Encoded Polyline Algorithm Format
 * Dùng để decode geometry từ ORS API (encoded polyline string → [lng, lat][])
 *
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 * Precision: 1e5 (5 decimal places — ORS format)
 */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;

  while (index < len) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dLat;

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dLng;

    // ORS uses precision 1e5 → divide by 1e5 to get actual degrees
    points.push([lng / 1e5, lat / 1e5]);
  }

  return points;
}

// ==================== CACHE KEY ====================

function getCacheKey(waypoints: RouteWaypoint[]): string {
  return waypoints
    .map((w) => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`)
    .join("|");
}

// ==================== ORS API CALL ====================

/**
 * Gọi OpenRouteService Directions API để lấy tuyến đường bộ giữa các waypoint.
 * Các waypoint được nối với nhau theo thứ tự (origin → cp1 → cp2 → ... → destination).
 *
 * @param waypoints Danh sách waypoint theo thứ tự lộ trình
 * @returns RoadRoute với coordinates đường bộ thực tế
 */
export async function fetchRoadRoute(
  waypoints: RouteWaypoint[]
): Promise<RoadRoute> {
  if (waypoints.length < 2) {
    throw new Error("Cần ít nhất 2 waypoint để tính lộ trình");
  }

  // Check cache
  const key = getCacheKey(waypoints);
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.route;
  }

  // ORS expects [[lng, lat], [lng, lat], ...]
  const coordinates = waypoints.map((w) => [w.lng, w.lat]);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }

      // Gọi qua proxy Next.js API route (/api/routing) để tránh CORS
      const response = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `ORS proxy error ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      // ORS v2 returns { routes: [{ summary, segments, geometry (encoded polyline) }] }
      const routeData = data.routes?.[0];
      if (!routeData) {
        throw new Error("ORS API: không tìm thấy route trong response");
      }

      // Decode polyline geometry → [lng, lat][] coordinates
      const encodedGeometry: string = routeData.geometry;
      if (!encodedGeometry || typeof encodedGeometry !== "string") {
        throw new Error("ORS API: geometry không hợp lệ");
      }
      const coords: [number, number][] = decodePolyline(encodedGeometry);

      // ORS returns distance in km (units: "km") and duration in seconds
      const distance = routeData.summary?.distance ?? 0;
      const duration = routeData.summary?.duration ?? 0;
      const averageSpeed = duration > 0 ? Math.round((distance / duration) * 3600 * 10) / 10 : 0;

      // Parse segment-level steps
      const segments: RouteSegment[] = [];
      const rawSegments = routeData.segments;
      if (Array.isArray(rawSegments) && rawSegments.length > 0) {
        const allSteps = rawSegments[0]?.steps;
        if (Array.isArray(allSteps)) {
          for (const step of allSteps) {
            const stepDistKm = (step.distance ?? 0) / 1000; // ORS returns meters
            const stepDurS = step.duration ?? 0;
            const stepSpeed = stepDurS > 0
              ? Math.round((stepDistKm / stepDurS) * 3600 * 10) / 10
              : 0;
            const wpIndices = step.way_points;
            segments.push({
              distance: Math.round(stepDistKm * 100) / 100,
              duration: stepDurS,
              speed: stepSpeed,
              roadName: step.name || "",
              instruction: step.instruction || "",
              waypointIndices: Array.isArray(wpIndices) && wpIndices.length >= 2
                ? [wpIndices[0], wpIndices[1]]
                : [0, 0],
            });
          }
        }
      }

      const route: RoadRoute = {
        coordinates: coords,
        distance,
        duration,
        averageSpeed,
        segments: segments.length > 0 ? segments : undefined,
      };

      // Lưu cache
      routeCache.set(key, { route, timestamp: Date.now() });

      return route;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("ORS API: thất bại sau nhiều lần thử lại");
}

// ==================== SEGMENT PARSING ====================

/**
 * Từ road route coordinates và waypoints, tính khoảng cách road
 * thực tế cho từng segment và tìm indices waypoint trong coordinates.
 *
 * Dùng thuật toán nearest-neighbor để map mỗi waypoint tới tọa độ
 * gần nhất trong route, sau đó tính cumulative distance.
 */
export function parseSegmentsFromRoute(
  coordinates: [number, number][],
  waypoints: RouteWaypoint[]
): SegmentRoadData {
  if (coordinates.length < 2 || waypoints.length < 2) {
    return { distances: [], waypointIndices: [] };
  }

  // Tìm index trong coordinates gần nhất với mỗi waypoint
  const waypointIndices = waypoints.map((wp) => {
    let minDist = Infinity;
    let minIdx = 0;
    // Optimization: search within a window around previous index
    const searchStart = 0;
    const searchEnd = coordinates.length;

    for (let i = searchStart; i < searchEnd; i++) {
      const dist = haversineDistance(
        wp.lat,
        wp.lng,
        coordinates[i][1],
        coordinates[i][0]
      );
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }
    return minIdx;
  });

  // Tính cumulative distance dọc theo route
  const cumulativeDist = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const segDist = haversineDistance(
      coordinates[i - 1][1],
      coordinates[i - 1][0],
      coordinates[i][1],
      coordinates[i][0]
    );
    cumulativeDist.push(cumulativeDist[i - 1] + segDist);
  }

  // Tính khoảng cách road cho từng segment (giữa các waypoint)
  const distances: number[] = [];
  for (let i = 0; i < waypointIndices.length - 1; i++) {
    const d =
      cumulativeDist[waypointIndices[i + 1]] -
      cumulativeDist[waypointIndices[i]];
    distances.push(Math.round(d * 100) / 100);
  }

  return { distances, waypointIndices };
}

// ==================== UTILITIES ====================

/**
 * Xóa cache route cũ (dùng khi cần force refresh)
 */
export function clearRouteCache(): void {
  routeCache.clear();
}
