"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

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

export function ShipmentMap({ shipment, currentLat, currentLng }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const truckMarkerRef = useRef<LeafletMarker | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      // Fix default icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const center = currentLat && currentLng
        ? [currentLat, currentLng] as [number, number]
        : shipment.originLat && shipment.originLng
        ? [shipment.originLat, shipment.originLng] as [number, number]
        : [10.7769, 106.7009] as [number, number];

      const map = L.map(containerRef.current!, { zoom: 7, center });
      mapRef.current = map;

      // CartoDB Positron - Premium Minimalist Map Theme
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CartoDB",
      }).addTo(map);

      // Origin marker
      if (shipment.originLat && shipment.originLng) {
        const originIcon = L.divIcon({
          html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(16,185,129,0.5)"></div>`,
          className: "", iconAnchor: [7, 7],
        });
        L.marker([shipment.originLat, shipment.originLng], { icon: originIcon })
          .addTo(map)
          .bindPopup(`<b>Xuất phát</b><br>${shipment.originAddress}`);
      }

      // Destination marker
      if (shipment.destinationLat && shipment.destinationLng) {
        const destIcon = L.divIcon({
          html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(239,68,68,0.5)"></div>`,
          className: "", iconAnchor: [7, 7],
        });
        L.marker([shipment.destinationLat, shipment.destinationLng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b>Điểm đến</b><br>${shipment.destinationAddress}`);
      }

      // Checkpoints
      shipment.checkpoints.forEach((cp) => {
        if (!cp.latitude || !cp.longitude) return;
        const cpIcon = L.divIcon({
          html: `<div style="background:${cp.isCompleted ? "#6366f1" : "#94a3b8"};width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>`,
          className: "", iconAnchor: [5, 5],
        });
        L.marker([cp.latitude, cp.longitude], { icon: cpIcon })
          .addTo(map)
          .bindPopup(`<b>${cp.name}</b><br>${cp.isCompleted ? "✅ Đã trạm qua" : "⏳ Đang chờ"}`);
      });

      // Current position (glowing radar truck marker)
      leafletRef.current = L;
      if (currentLat && currentLng) {
        const truckIcon = L.divIcon({
          html: RADAR_MARKER_HTML,
          className: "", iconAnchor: [14, 14],
        });
        const marker = L.marker([currentLat, currentLng], { icon: truckIcon })
          .addTo(map)
          .bindPopup("<b>🚛 Vị trí xe thời gian thực</b>");
        truckMarkerRef.current = marker;
      }

      // Tracking history polyline (glowing path)
      if (shipment.trackingHistory.length > 1) {
        const coords = shipment.trackingHistory.map(
          (p) => [p.latitude, p.longitude] as [number, number]
        );
        // Pathway soft glow
        L.polyline(coords, { color: "#f97316", weight: 6, opacity: 0.15 }).addTo(map);
        // Pathway dashed core
        L.polyline(coords, { color: "#f97316", weight: 3, opacity: 0.9, dashArray: "6 5" }).addTo(map);
      }

      // Draw straight line origin→destination
      if (shipment.originLat && shipment.originLng && shipment.destinationLat && shipment.destinationLng) {
        const coords: [number, number][] = [
          [shipment.originLat, shipment.originLng],
          [shipment.destinationLat, shipment.destinationLng],
        ];
        L.polyline(coords, { color: "#94a3b8", weight: 1.5, opacity: 0.35, dashArray: "4 6" }).addTo(map);
      }

      // Fit bounds
      const allPoints: [number, number][] = [];
      if (shipment.originLat) allPoints.push([shipment.originLat, shipment.originLng!]);
      if (shipment.destinationLat) allPoints.push([shipment.destinationLat, shipment.destinationLng!]);
      if (currentLat) allPoints.push([currentLat, currentLng!]);
      if (allPoints.length > 1) {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] });
      }
    };

    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update truck marker position when simulation moves the vehicle
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !currentLat || !currentLng) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    // Remove old truck marker
    if (truckMarkerRef.current) {
      truckMarkerRef.current.remove();
      truckMarkerRef.current = null;
    }

    // Add new truck marker at updated position
    const truckIcon = L.divIcon({
      html: RADAR_MARKER_HTML,
      className: "", iconAnchor: [14, 14],
    });
    const marker = L.marker([currentLat, currentLng], { icon: truckIcon })
      .addTo(map)
      .bindPopup("<b>🚛 Vị trí xe thời gian thực</b>");
    truckMarkerRef.current = marker;

    // Smoothly pan to follow the vehicle
    map.panTo([currentLat, currentLng], { animate: true, duration: 1.2 });
  }, [currentLat, currentLng]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
