"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import {
  Map,
  useMap,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
  MapRoute,
} from "@/components/ui/map";
import MapLibreGL from "maplibre-gl";
import { haversineDistance } from "@/lib/route-optimizer";
import { fetchRoadRoute, parseSegmentsFromRoute, type RouteWaypoint, type RoadRoute } from "@/lib/routing-service";

const RADAR_MARKER_HTML = `
  <style>
    @keyframes radar-pulse {
      0%   { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(2.6); opacity: 0; }
    }
    @keyframes radar-pulse2 {
      0%   { transform: scale(0.5); opacity: 0.7; }
      100% { transform: scale(2.0); opacity: 0; }
    }
  </style>
  <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:100%;height:100%;background:rgba(249,115,22,0.25);border-radius:50%;animation:radar-pulse 2s infinite ease-out 0s;"></div>
    <div style="position:absolute;width:100%;height:100%;background:rgba(249,115,22,0.2);border-radius:50%;animation:radar-pulse2 2s infinite ease-out 0.5s;"></div>
    <div style="position:absolute;width:13px;height:13px;background:#f97316;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(249,115,22,0.7)"></div>
  </div>
`;

interface Checkpoint {
  id: string; name: string; latitude?: number; longitude?: number;
  sequence: number; isCompleted: boolean;
}

interface Shipment {
  originLat?: number; originLng?: number;
  destinationLat?: number; destinationLng?: number;
  originAddress: string; destinationAddress: string;
  checkpoints: Checkpoint[];
  trackingHistory: { latitude: number; longitude: number }[];
  status: string;
}

interface Props {
  shipment: Shipment;
  currentLat?: number;
  currentLng?: number;
}

// ── Inner component to auto-fit bounds after map loads ──
function MapBoundsFitter({ points }: { points: [number, number][] }) {
  const { map, isLoaded } = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (!isLoaded || !map || points.length < 2 || hasFitted.current) return;
    hasFitted.current = true;
    const bounds = new MapLibreGL.LngLatBounds();
    points.forEach(([lng, lat]) => bounds.extend([lng, lat]));
    map.fitBounds(bounds, { padding: 50, maxZoom: 12 });
  }, [isLoaded, map, points]);

  return null;
}

// ── Safe pan: validates coordinates before calling panTo ──
function safePanTo(map: MapLibreGL.Map, lng: number, lat: number, options?: MapLibreGL.AnimationOptions) {
  // MapLibre GL expects [longitude, latitude] order.
  // Guard against invalid latitude values to prevent crashes.
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.warn("[MapTruckPanner] Skipping pan — invalid coordinates:", { lng, lat });
    return;
  }
  map.panTo([lng, lat], options);
}

function MapTruckPanner({ currentLat, currentLng }: { currentLat?: number; currentLng?: number }) {
  const { map, isLoaded } = useMap();
  const prevRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!isLoaded || !map || !currentLat || !currentLng) return;
    const prev = prevRef.current;
    if (prev && prev.lat === currentLat && prev.lng === currentLng) return;
    prevRef.current = { lat: currentLat, lng: currentLng };
    // Smoothly pan to follow the vehicle
    // MapLibre GL panTo expects [longitude, latitude]
    safePanTo(map, currentLng, currentLat, { animate: true, duration: 1200 });
  }, [isLoaded, map, currentLat, currentLng]);

  return null;
}

export function ShipmentMap({ shipment, currentLat, currentLng }: Props) {
  const hasOrigin = !!(shipment.originLat && shipment.originLng);
  const hasDest = !!(shipment.destinationLat && shipment.destinationLng);

  // Build waypoints: origin → checkpoints → destination
  const waypoints = useMemo(() => {
    const pts: { lng: number; lat: number; label?: string }[] = [];
    if (hasOrigin) pts.push({ lng: shipment.originLng!, lat: shipment.originLat!, label: "Xuất phát" });
    shipment.checkpoints
      .filter((cp) => cp.latitude && cp.longitude)
      .forEach((cp) => pts.push({ lng: cp.longitude!, lat: cp.latitude!, label: cp.name }));
    if (hasDest) pts.push({ lng: shipment.destinationLng!, lat: shipment.destinationLat!, label: "Điểm đến" });
    return pts;
  }, [shipment, hasOrigin, hasDest]);

  // Build segment metadata
  const segments = useMemo(() => {
    const segs: {
      from: { lng: number; lat: number; label?: string };
      to: { lng: number; lat: number; label?: string };
      dist: number; ratio: number;
    }[] = [];
    if (waypoints.length >= 2) {
      for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to = waypoints[i + 1];
        const dist = haversineDistance(from.lat, from.lng, to.lat, to.lng);
        const ratio = waypoints.length > 2 ? i / (waypoints.length - 2) : 0;
        segs.push({ from, to, dist, ratio });
      }
    }
    return segs;
  }, [waypoints]);

  // Tracking history as [lng, lat] for MapLibre
  const trackingCoords = useMemo(() => {
    if (shipment.trackingHistory.length < 2) return [];
    return shipment.trackingHistory.map((p) => [p.longitude, p.latitude] as [number, number]);
  }, [shipment.trackingHistory]);

  // ── OpenRouteService road route ──
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  const [roadLoading, setRoadLoading] = useState(false);

  useEffect(() => {
    if (waypoints.length < 2) return;
    let cancelled = false;
    setRoadLoading(true);

    const wps: RouteWaypoint[] = waypoints.map((w) => ({
      lng: w.lng,
      lat: w.lat,
      label: w.label,
    }));

    fetchRoadRoute(wps)
      .then((route) => {
        if (!cancelled) {
          setRoadRoute(route);
          setRoadLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[ShipmentMap] ORS routing failed, using fallback:", err);
          setRoadRoute(null);
          setRoadLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [waypoints]);

  // Parse segment-level distances & waypoint indices from ORS route
  const roadSegmentData = useMemo(() => {
    if (!roadRoute) return null;
    const wps: RouteWaypoint[] = waypoints.map((w) => ({
      lng: w.lng,
      lat: w.lat,
      label: w.label,
    }));
    return parseSegmentsFromRoute(roadRoute.coordinates, wps);
  }, [roadRoute, waypoints]);

  // All points for fitting map bounds
  const allPoints = useMemo(() => {
    const pts: [number, number][] = waypoints.map((w) => [w.lng, w.lat]);
    if (currentLat && currentLng) pts.push([currentLng, currentLat]);
    return pts;
  }, [waypoints, currentLat, currentLng]);

  // Map initial center
  const center = useMemo(() => {
    if (currentLat && currentLng) return [currentLng, currentLat] as [number, number];
    if (hasOrigin) return [shipment.originLng!, shipment.originLat!] as [number, number];
    return [106.7009, 10.7769] as [number, number];
  }, [currentLat, currentLng, hasOrigin, shipment]);

  // Dijkstra metrics
  const straightDist = useMemo(() => {
    if (!hasOrigin || !hasDest) return 0;
    return haversineDistance(
      shipment.originLat!, shipment.originLng!,
      shipment.destinationLat!, shipment.destinationLng!
    );
  }, [hasOrigin, hasDest, shipment]);

  // Use road distance if available, else straight-line total
  const totalDist = useMemo(
    () => roadRoute?.distance ?? segments.reduce((s, seg) => s + seg.dist, 0),
    [roadRoute, segments]
  );
  const diffPercent = straightDist > 0 ? Math.round(((totalDist - straightDist) / straightDist) * 100) : 0;
  const isRoadRoute = !!roadRoute;

  return (
    <Map center={center} zoom={7} className="h-full w-full">
      <MapControls showZoom />

      {/* ── Origin marker ── */}
      {hasOrigin && (
        <MapMarker longitude={shipment.originLng!} latitude={shipment.originLat!}>
          <MarkerContent>
            <div
              style={{
                width: 14, height: 14, borderRadius: "50%",
                background: "#10b981",
                border: "2.5px solid white",
                boxShadow: "0 2px 8px rgba(16,185,129,0.5)",
              }}
            />
          </MarkerContent>
          <MarkerPopup>
            <div className="font-semibold text-xs">Xuất phát</div>
            <div className="text-[10px] text-muted-foreground">{shipment.originAddress}</div>
          </MarkerPopup>
        </MapMarker>
      )}

      {/* ── Destination marker ── */}
      {hasDest && (
        <MapMarker longitude={shipment.destinationLng!} latitude={shipment.destinationLat!}>
          <MarkerContent>
            <div
              style={{
                width: 14, height: 14, borderRadius: "50%",
                background: "#ef4444",
                border: "2.5px solid white",
                boxShadow: "0 2px 8px rgba(239,68,68,0.5)",
              }}
            />
          </MarkerContent>
          <MarkerPopup>
            <div className="font-semibold text-xs">Điểm đến</div>
            <div className="text-[10px] text-muted-foreground">{shipment.destinationAddress}</div>
          </MarkerPopup>
        </MapMarker>
      )}

      {/* ── Checkpoints ── */}
      {shipment.checkpoints.map((cp) => {
        if (!cp.latitude || !cp.longitude) return null;
        return (
          <MapMarker key={cp.id} longitude={cp.longitude} latitude={cp.latitude}>
            <MarkerContent>
              <div
                style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: cp.isCompleted ? "#6366f1" : "#94a3b8",
                  border: "2px solid white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }}
              />
            </MarkerContent>
            <MarkerPopup>
              <div className="text-xs">{cp.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {cp.isCompleted ? "✅ Đã trạm qua" : "⏳ Đang chờ"}
              </div>
            </MarkerPopup>
          </MapMarker>
        );
      })}

      {/* ── Truck position (animated radar marker) ── */}
      {currentLat && currentLng && (
        <MapMarker longitude={currentLng} latitude={currentLat}>
          <MarkerContent>
            <div dangerouslySetInnerHTML={{ __html: RADAR_MARKER_HTML }} />
          </MarkerContent>
          <MarkerPopup>
            <div className="text-xs font-semibold">🚛 Vị trí xe thời gian thực</div>
          </MarkerPopup>
        </MapMarker>
      )}

      {/* ── Tracking history polyline (glowing path) ── */}
      {trackingCoords.length > 1 && (
        <>
          <MapRoute coordinates={trackingCoords} color="#f97316" width={6} opacity={0.15} interactive={false} />
          <MapRoute coordinates={trackingCoords} color="#f97316" width={3} opacity={0.9} dashArray={[6, 5]} interactive={false} />
        </>
      )}

      {/* ── Loading indicator for road route ── */}
      {roadLoading && (
        <div className="absolute top-2 left-2 z-20 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-sm flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          Đang tải lộ trình đường bộ...
        </div>
      )}

      {/* ── Road route (ORS) or fallback to straight segments ── */}
      {isRoadRoute && roadRoute ? (
        <>
          {/* Single continuous road-following polyline */}
          <MapRoute
            coordinates={roadRoute.coordinates}
            color="#f97316"
            width={4}
            opacity={0.9}
            interactive={false}
          />
          {/* Glow underneath */}
          <MapRoute
            coordinates={roadRoute.coordinates}
            color="#f97316"
            width={8}
            opacity={0.15}
            interactive={false}
          />
        </>
      ) : (
        /* ── Fallback: straight-line segments when ORS unavailable ── */
        segments.map((seg, i) => {
          const hue = Math.round(30 + seg.ratio * 30);
          return (
            <MapRoute
              key={`route-${i}`}
              coordinates={[[seg.from.lng, seg.from.lat], [seg.to.lng, seg.to.lat]]}
              color={`hsl(${hue}, 90%, 55%)`}
              width={3.5}
              opacity={0.85}
              interactive={false}
            />
          );
        })
      )}

      {/* ── Distance labels at midpoints ── */}
      {segments.map((seg, i) => {
        const midLng = (seg.from.lng + seg.to.lng) / 2;
        const midLat = (seg.from.lat + seg.to.lat) / 2;
        const segDist = isRoadRoute && roadSegmentData?.distances[i]
          ? roadSegmentData.distances[i]
          : seg.dist;
        return (
          <MapMarker key={`label-${i}`} longitude={midLng} latitude={midLat}>
            <MarkerContent>
              <div
                style={{
                  background: "rgba(0,0,0,0.75)", color: "white",
                  padding: "2px 8px", borderRadius: "99px",
                  fontSize: "10px", fontWeight: 700,
                  whiteSpace: "nowrap",
                  backdropFilter: "blur(4px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {seg.from.label || ""} → {segDist.toFixed(1)} km
                {isRoadRoute && <span className="text-[8px] text-orange-300 ml-1">🚗</span>}
              </div>
            </MarkerContent>
          </MapMarker>
        );
      })}

      {/* ── Straight line reference (dashed gray) ── */}
      {hasOrigin && hasDest && (
        <MapRoute
          coordinates={[[shipment.originLng!, shipment.originLat!], [shipment.destinationLng!, shipment.destinationLat!]]}
          color="#94a3b8"
          width={1.5}
          opacity={0.2}
          dashArray={[4, 6]}
          interactive={false}
        />
      )}

      {/* ── Route info card ── */}
      {hasOrigin && hasDest && waypoints.length > 0 && (
        <MapMarker
          longitude={waypoints[0].lng}
          latitude={waypoints[0].lat}
          offset={[0, -50]}
        >
          <MarkerContent>
            <div
              style={{
                background: "rgba(0,0,0,0.8)", color: "white",
                padding: "8px 14px", borderRadius: "10px",
                fontSize: "11px", lineHeight: 1.7,
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                maxWidth: 200,
              }}
            >
              <div
                style={{
                  fontWeight: 700, fontSize: 12, marginBottom: 3,
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ color: "#f97316" }}>●</span>
                {isRoadRoute ? "Đường bộ (ORS)" : "Đường chim bay"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1px 8px" }}>
                <span style={{ color: "#94a3b8" }}>{isRoadRoute ? "Đường bộ:" : "Tối ưu:"}</span>
                <strong>{totalDist.toFixed(1)} km</strong>
                <span style={{ color: "#94a3b8" }}>Thẳng:</span>
                <strong>{straightDist.toFixed(1)} km</strong>
                <span style={{ color: "#94a3b8" }}>Chênh:</span>
                <strong style={{ color: diffPercent > 0 ? "#f97316" : "#10b981" }}>
                  +{diffPercent}%
                </strong>
              </div>
              <div
                style={{
                  marginTop: 4, fontSize: 9, color: "#6b7280",
                  borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 3,
                }}
              >
                {waypoints.length - 2} checkpoints • {waypoints.length - 1} segments
                {roadLoading && <span className="ml-1 text-orange-400">⟳</span>}
              </div>
            </div>
          </MarkerContent>
        </MapMarker>
      )}

      {/* ── Auto-fit bounds ── */}
      <MapBoundsFitter points={allPoints} />

      {/* ── Smooth pan to truck ── */}
      <MapTruckPanner currentLat={currentLat} currentLng={currentLng} />
    </Map>
  );
}
