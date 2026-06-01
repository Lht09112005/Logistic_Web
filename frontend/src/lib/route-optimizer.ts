/**
 * Route Optimizer — Thuật toán tìm đường đi ngắn nhất
 *
 * Sử dụng:
 * - Haversine: tính khoảng cách địa lý giữa 2 tọa độ (great-circle distance)
 * - Dijkstra: tìm đường đi ngắn nhất trên đồ thị có trọng số
 * - Nearest-Neighbor Heuristic: sắp xếp thứ tự các điểm đến tối ưu (TSP approximation)
 */

// ==================== TYPES ====================

export interface RouteNode {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface RouteEdge {
  from: string;
  to: string;
  distance: number; // km
}

export interface OptimizedRoute {
  orderedNodes: RouteNode[];
  totalDistance: number; // km
  segments: { from: RouteNode; to: RouteNode; distance: number }[];
  estimatedMinutes: number; // assuming 60 km/h average
}

// ==================== HAVERSINE DISTANCE ====================

/**
 * Tính khoảng cách giữa 2 tọa độ địa lý bằng công thức Haversine
 * Công thức: a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlng/2)
 *            c = 2 · atan2(√a, √(1-a))
 *            d = R · c  (với R = 6371 km)
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Bán kính Trái Đất (km)
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // km, làm tròn 2 chữ số
}

// ==================== DIJKSTRA ALGORITHM ====================

export interface DijkstraResult {
  distance: number;
  path: string[];
}

/**
 * Dijkstra: Tìm đường đi ngắn nhất từ startNode đến endNode trên đồ thị
 *
 * Độ phức tạp: O(V²) với V là số đỉnh
 * - Dùng priority queue (min-heap) qua mảng sort
 * - dist[node] = khoảng cách ngắn nhất từ start đến node
 * - prev[node] = node trước đó trong đường đi ngắn nhất
 */
export function dijkstra(
  nodes: RouteNode[],
  edges: RouteEdge[],
  startId: string,
  endId: string
): DijkstraResult {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  const nodeIds = nodes.map((n) => n.id);

  // Khởi tạo: dist[start] = 0, dist[others] = ∞
  for (const id of nodeIds) {
    dist.set(id, id === startId ? 0 : Infinity);
    prev.set(id, null);
  }

  // Build adjacency list for quick lookup
  const adjList = new Map<string, { to: string; distance: number }[]>();
  for (const node of nodes) {
    adjList.set(node.id, []);
  }
  for (const edge of edges) {
    adjList.get(edge.from)?.push({ to: edge.to, distance: edge.distance });
    // Đồ thị vô hướng (undirected)
    adjList.get(edge.to)?.push({ to: edge.from, distance: edge.distance });
  }

  // Dijkstra loop: chọn node chưa visited có dist nhỏ nhất
  while (visited.size < nodes.length) {
    // Tìm node chưa visited với dist nhỏ nhất
    let minDist = Infinity;
    let minNode: string | null = null;
    for (const id of nodeIds) {
      if (!visited.has(id) && dist.get(id)! < minDist) {
        minDist = dist.get(id)!;
        minNode = id;
      }
    }

    if (minNode === null || minNode === endId) break;
    visited.add(minNode);

    // Relax các cạnh kề
    const neighbors = adjList.get(minNode) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.to)) {
        const newDist = dist.get(minNode)! + neighbor.distance;
        if (newDist < dist.get(neighbor.to)!) {
          dist.set(neighbor.to, newDist);
          prev.set(neighbor.to, minNode);
        }
      }
    }
  }

  // Reconstruct path từ end về start
  const path: string[] = [];
  let current: string | null = endId;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) || null;
  }

  return {
    distance: dist.get(endId) || 0,
    path,
  };
}

// ==================== ROUTE OPTIMIZATION (TSP Heuristic) ====================

/**
 * Xây dựng đồ thị đầy đủ (complete graph) từ danh sách nodes
 * Mỗi cặp node có 1 cạnh với trọng số = haversineDistance
 */
export function buildCompleteGraph(nodes: RouteNode[]): RouteEdge[] {
  const edges: RouteEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const distance = haversineDistance(
        nodes[i].lat, nodes[i].lng,
        nodes[j].lat, nodes[j].lng
      );
      if (distance > 0) {
        edges.push({ from: nodes[i].id, to: nodes[j].id, distance });
      }
    }
  }
  return edges;
}/**
 * Nearest-Neighbor TSP Heuristic
 *
 * Xuất phát từ origin, liên tục chọn checkpoint chưa đi có khoảng cách ngắn nhất
 * từ vị trí hiện tại, sau đó kết thúc tại destination.
 *
 * Đây là thuật toán xấp xỉ cho bài toán Traveling Salesman (TSP).
 * Tỉ lệ tối ưu so với optimal: ~1.25x (trong thực tế thường gần optimal hơn).
 * Độ phức tạp: O(V²) với V = số checkpoint (thường ≤ 15)
 *
 * Edge cases:
 * - 0 checkpoint: origin → destination
 * - 1 checkpoint: origin → cp → destination (giữ nguyên)
 * - Nhiều checkpoint: sắp xếp theo NN heuristic
 */
export function nearestNeighborTSP(
  origin: RouteNode,
  checkpoints: RouteNode[],
  destination: RouteNode
): RouteNode[] {
  if (checkpoints.length <= 1) {
    return [origin, ...checkpoints, destination];
  }

  const ordered: RouteNode[] = [origin];
  const unvisited = [...checkpoints];
  let current = origin;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = haversineDistance(
        current.lat, current.lng,
        unvisited[i].lat, unvisited[i].lng
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const next = unvisited.splice(nearestIdx, 1)[0];
    ordered.push(next);
    current = next;
  }

  ordered.push(destination);
  return ordered;
}

/**
 * Tìm route tối ưu bằng Nearest-Neighbor TSP heuristic
 *
 * Chiến lược:
 * 1. Sắp xếp checkpoint theo Nearest-Neighbor TSP (tự động tìm thứ tự ngắn nhất)
 * 2. Dùng haversine distance làm trọng số giữa các điểm
 * 3. Tổng hợp segments + totalDistance + estimatedMinutes
 *
 * Khi tích hợp road network graph (OSRM/Mapbox) trong tương lai,
 * có thể thay haversine bằng road distance thực tế để tăng độ chính xác.
 *
 * Độ phức tạp: O(V²) với V = số waypoint (thường ≤ 15)
 */
export function findShortestRoute(
  origin: RouteNode,
  checkpoints: RouteNode[],
  destination: RouteNode
): OptimizedRoute {
  // Sắp xếp checkpoint theo Nearest-Neighbor TSP
  const orderedWaypoints = nearestNeighborTSP(origin, checkpoints, destination);

  const segments: OptimizedRoute["segments"] = [];
  let totalDistance = 0;

  for (let i = 0; i < orderedWaypoints.length - 1; i++) {
    const from = orderedWaypoints[i];
    const to = orderedWaypoints[i + 1];

    // Khoảng cách trực tiếp = haversine (trên đồ thị đầy đủ)
    const distance = haversineDistance(
      from.lat, from.lng,
      to.lat, to.lng
    );

    totalDistance += distance;
    segments.push({
      from,
      to,
      distance: Math.round(distance * 100) / 100,
    });
  }

  // Estimated time: average speed 60 km/h → (distance km / 60 km/h) * 60 min/h = distance minutes
  const estimatedMinutes = Math.round(totalDistance);

  return {
    orderedNodes: orderedWaypoints,
    totalDistance: Math.round(totalDistance * 100) / 100,
    segments,
    estimatedMinutes,
  };
}

// ==================== PATH INTERPOLATION ====================

/**
 * Sinh các tọa độ trung gian giữa các điểm trên route tối ưu
 * Dùng linear interpolation với số bước mỗi segment
 */
export function interpolateOptimizedPath(
  optimizedRoute: OptimizedRoute,
  stepsPerSegment = 30
): { latitude: number; longitude: number; checkpointId?: string }[] {
  const coords: { latitude: number; longitude: number; checkpointId?: string }[] = [];

  for (let i = 0; i < optimizedRoute.segments.length; i++) {
    const seg = optimizedRoute.segments[i];
    const startLat = seg.from.lat;
    const startLng = seg.from.lng;
    const endLat = seg.to.lat;
    const endLng = seg.to.lng;

    for (let j = 0; j < stepsPerSegment; j++) {
      const t = j / stepsPerSegment;
      coords.push({
        latitude: startLat + (endLat - startLat) * t,
        longitude: startLng + (endLng - startLng) * t,
        checkpointId: j === 0 && seg.from.label ? seg.from.id : undefined,
      });
    }
  }

  // Thêm điểm đến cuối cùng
  const last = optimizedRoute.segments[optimizedRoute.segments.length - 1];
  if (last) {
    coords.push({
      latitude: last.to.lat,
      longitude: last.to.lng,
      checkpointId: last.to.label ? last.to.id : undefined,
    });
  }

  return coords;
}
