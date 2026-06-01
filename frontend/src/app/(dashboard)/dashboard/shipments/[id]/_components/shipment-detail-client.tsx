"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Clock, Truck, User, Phone,
  CheckCircle, Circle, Package, Navigation,
  Play, Pause, Flame, Gauge, Activity, ThumbsUp, Flag
} from "lucide-react";
import {
  formatDate, formatRelative, getShipmentStatusLabel, getShipmentStatusBadge,
} from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import DriverCheckpointPanel from "./driver-checkpoint-panel";
import StaffLoadingPanel from "./staff-loading-panel";
import StaffReceivingPanel from "./staff-receiving-panel";
import {
  findShortestRoute,
  interpolateOptimizedPath,
  type RouteNode,
  type OptimizedRoute,
} from "@/lib/route-optimizer";
import {
  fetchRoadRoute,
  parseSegmentsFromRoute,
  type RouteWaypoint,
  type RoadRoute,
} from "@/lib/routing-service";

interface Checkpoint {
  id: string; name: string; address: string;
  latitude?: number; longitude?: number;
  sequence: number; isCompleted: boolean;
  arrivedAt?: string; estimatedAt?: string;
}

interface ShipmentItem {
  id: string; quantity: number; weight?: number;
  product: { name: string; sku: string; unit: string };
}

interface Shipment {
  id: string; shipmentCode: string; status: string;
  vehicleNumber?: string; vehicleType?: string;
  originAddress: string; destinationAddress: string;
  originLat?: number; originLng?: number;
  destinationLat?: number; destinationLng?: number;
  currentLat?: number; currentLng?: number;
  estimatedArrival?: string; actualArrival?: string;
  startedAt?: string; totalDistance?: number;
  notes?: string; createdAt: string;
  originWarehouse?: { id: string; name: string; code: string } | null;
  destinationWarehouse?: { id: string; name: string; code: string } | null;
  driver?: { id: string; name: string; phone?: string };
  checkpoints: Checkpoint[];
  items: ShipmentItem[];
  trackingHistory: { latitude: number; longitude: number; recordedAt: string; description?: string }[];
}

interface Props {
  shipment: Shipment;
  lastUpdated: Date;
  refresh: () => void;
  refreshing: boolean;
}

let MapComponent: React.ComponentType<{ shipment: Shipment; currentLat?: number; currentLng?: number }> | null = null;

export default function ShipmentDetailClient({ shipment: initial, lastUpdated, refresh, refreshing }: Props) {
  const router = useRouter();
  const auth = useAuth();
  const { isAdmin, isManager, isDriver, isStaffOnly, user } = auth;
  const canControlShipment = isAdmin || isManager;
  const [shipment, setShipment] = useState(initial);
  const [socketConnected, setSocketConnected] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const MapRef = useRef<typeof MapComponent>(null);
  const socketRef = useRef<any>(null);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(72);
  const [simStatusMsg, setSimStatusMsg] = useState("Thiết bị giả lập định vị GPS đang ngoại tuyến");
  const [simError, setSimError] = useState("");
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [simStepIndex, setSimStepIndex] = useState(0);
  const [simETA, setSimETA] = useState<string>("—");
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  const [roadRouteLoading, setRoadRouteLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    import("./shipment-map").then((mod) => {
      MapRef.current = mod.ShipmentMap;
      setMapLoaded(true);
    });
    computeOptimizedRoute();
  }, []);

  useEffect(() => {
    const waypoints: RouteWaypoint[] = [];
    if (shipment.originLat && shipment.originLng)
      waypoints.push({ lng: shipment.originLng, lat: shipment.originLat, label: "Xuất phát" });
    shipment.checkpoints
      .filter((cp) => cp.latitude && cp.longitude)
      .forEach((cp) => waypoints.push({ lng: cp.longitude!, lat: cp.latitude!, label: cp.name }));
    if (shipment.destinationLat && shipment.destinationLng)
      waypoints.push({ lng: shipment.destinationLng, lat: shipment.destinationLat, label: "Điểm đến" });

    if (waypoints.length < 2) return;
    let cancelled = false;
    setRoadRouteLoading(true);
    fetchRoadRoute(waypoints)
      .then((route) => { if (!cancelled) { setRoadRoute(route); setRoadRouteLoading(false); } })
      .catch(() => { if (!cancelled) { setRoadRoute(null); setRoadRouteLoading(false); } });
    return () => { cancelled = true; };
  }, [shipment.originLat, shipment.originLng, shipment.destinationLat, shipment.destinationLng, shipment.checkpoints]);

  const orsSimCoords = useMemo((): { latitude: number; longitude: number; checkpointId?: string; speed?: number; roadName?: string }[] | null => {
    if (!roadRoute || roadRoute.coordinates.length < 2) return null;
    const coords = roadRoute.coordinates;
    const segments = roadRoute.segments;
    const wps: RouteWaypoint[] = [];
    const cpIndexToId = new Map<number, string>();
    if (shipment.originLat && shipment.originLng)
      wps.push({ lng: shipment.originLng, lat: shipment.originLat, label: "Xuất phát" });
    shipment.checkpoints.filter((cp) => cp.latitude && cp.longitude).forEach((cp) => {
      wps.push({ lng: cp.longitude!, lat: cp.latitude!, label: cp.name });
      cpIndexToId.set(wps.length - 1, cp.id);
    });
    if (shipment.destinationLat && shipment.destinationLng)
      wps.push({ lng: shipment.destinationLng, lat: shipment.destinationLat, label: "Điểm đến" });

    const segData = parseSegmentsFromRoute(coords, wps);
    const skip = Math.max(1, Math.floor(coords.length / 200));
    const sampled: { latitude: number; longitude: number; checkpointId?: string; speed?: number; roadName?: string }[] = [];

    for (let i = 0; i < coords.length; i += skip) {
      const [lng, lat] = coords[i];
      let stepSpeed: number | undefined;
      let stepRoadName: string | undefined;
      if (segments?.length) {
        for (const seg of segments) {
          const [start, end] = seg.waypointIndices;
          if (i >= start && i <= end) { stepSpeed = seg.speed; stepRoadName = seg.roadName; break; }
        }
      }
      let checkpointId: string | undefined;
      for (let j = 1; j < segData.waypointIndices.length - 1; j++) {
        if (Math.abs(segData.waypointIndices[j] - i) <= skip) {
          const cpId = cpIndexToId.get(j);
          if (cpId) { checkpointId = cpId; break; }
        }
      }
      sampled.push({ latitude: lat, longitude: lng, checkpointId, speed: stepSpeed, roadName: stepRoadName });
    }
    const last = coords[coords.length - 1];
    const lastS = sampled[sampled.length - 1];
    if (!lastS || lastS.longitude !== last[0] || lastS.latitude !== last[1])
      sampled.push({ latitude: last[1], longitude: last[0] });
    return sampled;
  }, [roadRoute, shipment.originLat, shipment.originLng, shipment.destinationLat, shipment.destinationLng, shipment.checkpoints]);

  useEffect(() => {
    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
      socketRef.current = socket;
      socket.emit("join:shipment", shipment.id);
      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));
      socket.on("location:updated", (data: { shipmentId: string; latitude: number; longitude: number; speed?: number; status?: string }) => {
        if (data.shipmentId === shipment.id) {
          setShipment((prev) => ({ ...prev, currentLat: data.latitude, currentLng: data.longitude, status: data.status || prev.status }));
          if (data.speed !== undefined) setSimSpeed(data.speed);
        }
      });
      return socket;
    };
    const cleanup = initSocket();
    return () => { cleanup.then((s) => { s?.off("connect"); s?.off("disconnect"); s?.off("location:updated"); s?.disconnect(); }); };
  }, [shipment.id]);

  const handleStatusUpdate = async (newStatus: string) => {
    try { await shipmentsApi.update(shipment.id, { status: newStatus }); setShipment((prev) => ({ ...prev, status: newStatus })); }
    catch { /* ignore */ }
  };

  const handleCheckpointUpdate = useCallback((cpId: string) => {
    setShipment((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.map((cp) =>
        cp.id === cpId ? { ...cp, isCompleted: true, arrivedAt: new Date().toISOString() } : cp
      ),
    }));
    // Emit socket event so manager can see in realtime
    if (socketRef.current) {
      socketRef.current.emit("checkpoint:arrived", { shipmentId: shipment.id, checkpointId: cpId });
    }
  }, [shipment.id]);

  const routeCacheRef = useRef<{ route: OptimizedRoute; coords: { latitude: number; longitude: number; checkpointId?: string; speed?: number; roadName?: string }[] } | null>(null);

  const computeOptimizedRoute = () => {
    if (!shipment.originLat || !shipment.originLng || !shipment.destinationLat || !shipment.destinationLng) return null;
    const originNode: RouteNode = { id: "origin", lat: shipment.originLat, lng: shipment.originLng, label: "Xuất phát" };
    const checkpointNodes: RouteNode[] = shipment.checkpoints.filter((cp) => cp.latitude && cp.longitude).map((cp) => ({ id: `cp:${cp.id}`, lat: cp.latitude!, lng: cp.longitude!, label: cp.name }));
    const destinationNode: RouteNode = { id: "destination", lat: shipment.destinationLat, lng: shipment.destinationLng, label: "Điểm đến" };
    const route = findShortestRoute(originNode, checkpointNodes, destinationNode);
    const coords = interpolateOptimizedPath(route, 30);
    routeCacheRef.current = { route, coords };
    return { route, coords };
  };

  type SimCoord = { latitude: number; longitude: number; checkpointId?: string; speed?: number; roadName?: string };

  const getRouteCoordinates = (): SimCoord[] => {
    if (orsSimCoords && orsSimCoords.length > 0) return orsSimCoords;
    if (!routeCacheRef.current) { const result = computeOptimizedRoute(); return result?.coords || []; }
    return routeCacheRef.current.coords;
  };

  const formatETA = (seconds: number): string => {
    if (seconds <= 0) return "Đã đến nơi";
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    if (h > 0) return `${h}h ${m}p`;
    if (m > 0) return `${m}p ${s}s`;
    return `${s}s`;
  };

  const calculateETA = (currentStepIndex: number, routeCoords: SimCoord[], speed: number): number => {
    const remaining = routeCoords.length - 1 - currentStepIndex;
    if (remaining <= 0 || speed <= 0) return 0;
    if (roadRoute?.segments?.length && orsSimCoords)
      return Math.max(Math.round(roadRoute.duration * (remaining / routeCoords.length)), 1);
    const avgStepDistKm = roadRoute ? roadRoute.distance / routeCoords.length : 0.5;
    return Math.round(Math.max((remaining * avgStepDistKm / speed) * 3600, 1));
  };

  const startSimulation = () => {
    if (shipment.status !== "IN_TRANSIT") handleStatusUpdate("IN_TRANSIT");
    const routeCoords = getRouteCoordinates();
    if (routeCoords.length === 0) { setSimError("Không đủ dữ liệu tọa độ lộ trình để chạy giả lập."); return; }
    setIsSimulating(true); setSimStatusMsg("⚡ Giả lập: Xe đang lưu thông trên lộ trình..."); setSimError("");
    let currentIndex = simStepIndex;
    if (currentIndex >= routeCoords.length - 1) { currentIndex = 0; setSimStepIndex(0); }
    const intervalMs = orsSimCoords && orsSimCoords.length > 0 ? 800 : 1500;
    const initialSpeed = routeCoords[currentIndex]?.speed || roadRoute?.averageSpeed || 72;
    setSimSpeed(Math.round(initialSpeed));
    setSimETA(formatETA(calculateETA(currentIndex, routeCoords, initialSpeed)));

    simIntervalRef.current = setInterval(async () => {
      if (currentIndex >= routeCoords.length - 1) {
        clearInterval(simIntervalRef.current!); setIsSimulating(false);
        setSimStatusMsg("🎉 Giả lập hoàn thành: Hàng đã được giao thành công!"); setSimETA("Đã đến nơi");
        handleStatusUpdate("DELIVERED"); return;
      }
      currentIndex += 1; setSimStepIndex(currentIndex);
      const nextCoord = routeCoords[currentIndex];
      const currentSpeed = nextCoord.speed ? nextCoord.speed : Math.floor(65 + Math.random() * 18);
      setSimSpeed(Math.round(currentSpeed)); setSimETA(formatETA(calculateETA(currentIndex, routeCoords, currentSpeed)));
      if (socketRef.current) socketRef.current.emit("location:update", { shipmentId: shipment.id, latitude: nextCoord.latitude, longitude: nextCoord.longitude, speed: currentSpeed });
      if (nextCoord.checkpointId) {
        const cpIndex = shipment.checkpoints.findIndex((c) => c.id === nextCoord.checkpointId);
        if (cpIndex !== -1 && !shipment.checkpoints[cpIndex].isCompleted) {
          try {
            await shipmentsApi.update(shipment.id, { checkpoints: shipment.checkpoints.map((c, idx) => idx === cpIndex ? { ...c, isCompleted: true } : c) });
            setShipment((prev) => ({ ...prev, checkpoints: prev.checkpoints.map((c, idx) => idx === cpIndex ? { ...c, isCompleted: true, arrivedAt: new Date().toISOString() } : c) }));
          } catch { /* ignore */ }
        }
      }
    }, intervalMs);
  };

  const pauseSimulation = () => {
    if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
    setIsSimulating(false); setSimStatusMsg("⏸️ Đã tạm dừng di chuyển giả lập");
  };

  const simulateIncident = () => {
    if (!isSimulating) { setSimError("Vui lòng kích hoạt di chuyển trước khi báo sự cố."); return; }
    pauseSimulation(); setSimStatusMsg("🚨 SỰ CỐ GIẢ LẬP: Phát hiện hỏng hóc cơ khí hoặc tắc nghẽn giao thông!");
    handleStatusUpdate("DELAYED");
    if (socketRef.current) socketRef.current.emit("location:update", { shipmentId: shipment.id, latitude: shipment.currentLat || shipment.originLat || 10.7769, longitude: shipment.currentLng || shipment.originLng || 106.7009, speed: 0, status: "DELAYED" });
  };

  useEffect(() => { return () => { if (simIntervalRef.current) clearInterval(simIntervalRef.current); }; }, []);

  const completedCount = shipment.checkpoints.filter((c) => c.isCompleted).length;
  const nextCpIndex = shipment.checkpoints.findIndex(c => !c.isCompleted);
  const DynMap = MapRef.current;

  return (
    <div
      className="flex flex-col overflow-hidden flex-1 max-h-full"
    >
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 shrink-0 px-4 lg:px-6 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button onClick={() => router.back()} className="btn btn-secondary btn-sm shrink-0">
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base lg:text-2xl font-bold truncate" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
                {shipment.shipmentCode}
              </h1>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${socketConnected ? "bg-success text-success" : ""}`} style={{ background: socketConnected ? undefined : "var(--bg-input)", color: socketConnected ? undefined : "var(--text-muted)" }}>
                <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
              </div>
              <span className={`badge ${getShipmentStatusBadge(shipment.status)}`} style={{ fontSize: "10px", padding: "1px 7px" }}>
                {getShipmentStatusLabel(shipment.status)}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Tạo lúc {formatDate(shipment.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap w-full lg:w-auto">
          <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
          {(isAdmin || (isManager && user?.managedWarehouses?.some((mw: any) => mw.id === shipment.originWarehouse?.id))) &&
            shipment.status === "PENDING" && (
            <>
              <button className="btn btn-primary btn-sm" onClick={async () => {
                try { await shipmentsApi.approve(shipment.id); refresh(); } catch {}
              }}>
                <ThumbsUp size={14} /> Duyệt
              </button>
              <button className="btn btn-sm" style={{ color: "#ef4444", borderColor: "#ef4444" }} onClick={async () => {
                setRejectOpen(true);
              }}>
                Từ chối
              </button>
            </>
          )}
          {canControlShipment && shipment.status === "CONFIRMED" && (
            <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate("LOADING")}>
              <Package size={14} /> <span className="hidden xs:inline">Bắt đầu </span>xếp hàng
            </button>
          )}
          {canControlShipment && shipment.status === "LOADING" && (
            <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate("IN_TRANSIT")}>
              <Navigation size={14} /> <span className="hidden xs:inline">Bắt đầu </span>vận chuyển
            </button>
          )}
          {canControlShipment && shipment.status === "IN_TRANSIT" && (
            <button className="btn btn-secondary btn-sm" style={{ color: "#10b981", borderColor: "#10b981" }} onClick={() => handleStatusUpdate("DELIVERED")}>
              <CheckCircle size={14} /> <span className="hidden sm:inline">Đánh dấu </span>đã giao
            </button>
          )}
        </div>
      </div>

      {/* ── Main content: flex row on desktop, column on mobile ── */}
      <div className="flex flex-1 min-h-0 gap-4 lg:gap-6 p-4 lg:p-6 overflow-hidden flex-col lg:flex-row">

        {/* Map — chiếm 2/3 chiều rộng desktop, full width mobile */}
        <div className="flex-1 lg:flex-[2] min-h-0 card overflow-hidden flex flex-col min-h-[300px] lg:min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center gap-2">
              <MapPin size={16} style={{ color: "#f97316" }} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Bản đồ theo dõi</span>
            </div>
            {shipment.status === "IN_TRANSIT" && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#22c55e" }}>
                <div className="live-dot" style={{ width: 6, height: 6 }} /> Realtime
              </span>
            )}
          </div>
          {/* Map fill toàn bộ phần còn lại */}
          <div className="flex-1 min-h-0">
            {mapLoaded && DynMap ? (
              <DynMap shipment={shipment} currentLat={shipment.currentLat} currentLng={shipment.currentLng} />
            ) : (
              <div className="flex items-center justify-center h-full" style={{ background: "var(--bg-input)" }}>
                <div className="text-center" style={{ color: "var(--text-muted)" }}>
                  <MapPin size={32} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                  <p className="text-sm">Đang tải bản đồ...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════════ Right panel — bố cục hiện đại, gọn gàng ════════ */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-4" style={{ minHeight: 0 }}>

          {/* ── DRIVER PANELS (unchanged) ── */}
          {isDriver && (
            <DriverCheckpointPanel
              shipmentId={shipment.id}
              shipmentCode={shipment.shipmentCode}
              status={shipment.status}
              originAddress={shipment.originAddress}
              destinationAddress={shipment.destinationAddress}
              checkpoints={shipment.checkpoints}
              items={shipment.items}
              driver={shipment.driver}
              onStatusUpdate={handleStatusUpdate}
              onCheckpointUpdate={handleCheckpointUpdate}
            />
          )}

          {isStaffOnly && (
            <StaffLoadingPanel
              shipmentId={shipment.id}
              shipmentCode={shipment.shipmentCode}
              status={shipment.status}
              items={shipment.items}
              originWarehouse={shipment.originWarehouse}
              onStatusUpdate={handleStatusUpdate}
            />
          )}

          {isStaffOnly && (
            <StaffReceivingPanel
              shipmentId={shipment.id}
              shipmentCode={shipment.shipmentCode}
              status={shipment.status}
              items={shipment.items}
              destinationWarehouse={shipment.destinationWarehouse}
              onStatusUpdate={handleStatusUpdate}
            />
          )}

          {/* ── TÀI XẾ & THÔNG SỐ VẬN CHUYỂN (non-DRIVER) ── */}
          {!isDriver && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                  <Truck size={14} style={{ color: "#f97316" }} />
                  Tài xế & Phương tiện
                </h3>
                {shipment.status === "IN_TRANSIT" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Đang giao
                  </span>
                )}
              </div>

              {shipment.driver ? (
                <>
                  {/* Driver + Vehicle row */}
                  <div className="flex items-center gap-4 pb-4 border-b" style={{ borderColor: "var(--border-light)" }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                      style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
                      {shipment.driver.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{shipment.driver.name}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>Tài xế</div>
                      {shipment.driver.phone && (
                        <a href={`tel:${shipment.driver.phone}`} className="inline-flex items-center gap-1 text-xs mt-1 font-medium hover:underline" style={{ color: "#f97316" }}>
                          <Phone size={11} /> {shipment.driver.phone}
                        </a>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>Phương tiện</div>
                      <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{shipment.vehicleType || "—"}</div>
                      {shipment.vehicleNumber && (
                        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{shipment.vehicleNumber}</div>
                      )}
                    </div>
                  </div>

                  {/* Stats row — 3 cột với số liệu realtime */}
                  {shipment.status === "IN_TRANSIT" && (
                    <div className="grid grid-cols-3 gap-3 pt-4">
                      <div className="text-center p-3 rounded-xl" style={{ background: "var(--bg-input)" }}>
                        <div className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Tốc độ</div>
                        <div className="font-bold text-lg flex items-center justify-center gap-0.5" style={{ color: "#f97316" }}>
                          <Gauge size={14} />{simSpeed || "—"}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>km/h</div>
                      </div>
                      <div className="text-center p-3 rounded-xl" style={{ background: "var(--bg-input)" }}>
                        <div className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Dự kiến đến</div>
                        <div className="font-bold text-lg" style={{ color: "#10b981" }}>
                          <Clock size={14} className="inline mr-0.5" />
                          {shipment.estimatedArrival ? formatRelative(shipment.estimatedArrival) : "—"}
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-xl" style={{ background: "var(--bg-input)" }}>
                        <div className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Chặng</div>
                        <div className="font-bold text-lg" style={{ color: "#6366f1" }}>
                          {completedCount}/{shipment.checkpoints.length}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>đã qua</div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  <User size={16} /> Chưa phân công tài xế
                </div>
              )}
            </div>
          )}

          {/* ── GPS SIMULATOR (admin/manager only) ── */}
          {canControlShipment && (
            <div className="card p-4 border-2 transition-all duration-300" style={{ borderColor: isSimulating ? "#f97316" : "var(--border-color)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full transition-colors ${isSimulating ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                  <h3 className="font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                    Giả lập GPS
                  </h3>
                </div>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                  Socket.io
                </span>
              </div>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: isSimulating ? "#f97316" : "var(--text-secondary)" }}>
                {simStatusMsg}
              </p>
              <div className="grid grid-cols-3 gap-2 pb-3 mb-3 text-center border-b text-[11px]" style={{ borderColor: "var(--border-light)" }}>
                <div>
                  <div className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>Tốc độ</div>
                  <div className="font-bold" style={{ color: "#f97316" }}>{isSimulating ? simSpeed : 0} km/h</div>
                </div>
                <div>
                  <div className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>ETA</div>
                  <div className="font-bold" style={{ color: isSimulating ? "#10b981" : "var(--text-muted)" }}>{isSimulating ? simETA : "—"}</div>
                </div>
                <div>
                  <div className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>Chặng</div>
                  <div className="font-bold" style={{ color: "#6366f1" }}>{completedCount}/{shipment.checkpoints.length}</div>
                </div>
              </div>
              {simError && <div className="p-2 mb-2 text-center text-[10px] rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">{simError}</div>}
              <div className="flex gap-2">
                {!isSimulating ? (
                  <button onClick={startSimulation} disabled={shipment.status === "DELIVERED"} className="btn btn-primary btn-sm flex-1">
                    <Play size={11} /> Bắt đầu
                  </button>
                ) : (
                  <button onClick={pauseSimulation} className="btn btn-sm flex-1" style={{ borderColor: "#f97316", color: "#f97316" }}>
                    <Pause size={11} /> Tạm dừng
                  </button>
                )}
                <button onClick={simulateIncident} disabled={!isSimulating} className="btn btn-sm" style={{ borderColor: "#ef4444", color: "#ef4444" }}>
                  <Flame size={11} /> Sự cố
                </button>
              </div>
            </div>
          )}

          {/* ── LỘ TRÌNH & TRẠM KIỂM SOÁT (combined) ── */}
          <div className="card p-5">
            <h3 className="font-bold text-sm uppercase tracking-wide mb-4 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <MapPin size={14} style={{ color: "#f97316" }} />
              Lộ trình vận chuyển
            </h3>

            {/* Origin → Destination with progress */}
            <div className="space-y-3 pb-4 border-b" style={{ borderColor: "var(--border-light)" }}>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "#10b981" }}>
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#10b981" }}>Xuất phát</div>
                  <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{shipment.originAddress}</div>
                  {shipment.startedAt && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{formatDate(shipment.startedAt)}</div>}
                </div>
              </div>

              {/* Progress bar with percentage */}
              <div className="ml-3 pl-6 border-l-2" style={{ borderColor: "var(--border-light)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                    Tiến độ: {completedCount}/{shipment.checkpoints.length} chặng
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: completedCount === shipment.checkpoints.length ? "#10b981" : "#f97316" }}>
                    {Math.round((completedCount / (shipment.checkpoints.length || 1)) * 100)}%
                  </span>
                </div>
                <div className="progress-bar mb-2" style={{ height: "5px" }}>
                  <div className="progress-fill" style={{
                    width: `${(completedCount / (shipment.checkpoints.length || 1)) * 100}%`,
                    background: completedCount === shipment.checkpoints.length
                      ? "linear-gradient(90deg, #10b981, #059669)"
                      : "linear-gradient(90deg, #f97316, #ea580c)",
                  }} />
                </div>
                {shipment.totalDistance && (
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tổng quãng đường: <strong>{shipment.totalDistance} km</strong></div>
                )}
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: shipment.status === "DELIVERED" ? "#10b981" : "#ef4444" }}>
                  <Flag size={11} color="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: shipment.status === "DELIVERED" ? "#10b981" : "#ef4444" }}>Điểm đến</div>
                  <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{shipment.destinationAddress}</div>
                  {shipment.estimatedArrival && (
                    <div className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      <Clock size={10} /> Dự kiến: {formatRelative(shipment.estimatedArrival)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Checkpoint timeline */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Trạm kiểm soát</h4>
                <span className={`badge ${completedCount === shipment.checkpoints.length ? "badge-success" : "badge-info"} text-[10px]`}>
                  {completedCount}/{shipment.checkpoints.length}
                </span>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto driver-cp-scroll pr-1">
                {shipment.checkpoints.map((cp, idx) => {
                  const isCurrent = idx === nextCpIndex;
                  return (
                    <div key={cp.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                      isCurrent ? "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50" : ""
                    } ${cp.isCompleted ? "" : "hover:bg-[var(--bg-input)]"}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        cp.isCompleted
                          ? "bg-emerald-500"
                          : isCurrent
                            ? "bg-orange-500 shadow-lg shadow-orange-500/30"
                            : "bg-gray-200 dark:bg-gray-700"
                      }`}>
                        {cp.isCompleted
                          ? <CheckCircle size={14} color="white" />
                          : <Circle size={11} color={isCurrent ? "white" : "var(--text-muted)"} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${
                          cp.isCompleted ? "text-emerald-700 dark:text-emerald-400"
                            : isCurrent ? "text-orange-700 dark:text-orange-400 font-bold"
                            : "text-muted"
                        }`}>
                          {cp.sequence}. {cp.name}
                        </div>
                        {cp.address && <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{cp.address}</div>}
                      </div>
                      {cp.arrivedAt && (
                        <div className="text-[11px] font-medium shrink-0" style={{ color: "#10b981" }}>
                          {new Date(cp.arrivedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      {isCurrent && (
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                      )}
                    </div>
                  );
                })}
                {shipment.checkpoints.length === 0 && (
                  <div className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
                    <MapPin size={24} className="mx-auto mb-2 opacity-30" />
                    <p>Chưa có trạm kiểm soát</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── HÀNG HÓA VẬN CHUYỂN ── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <Package size={14} style={{ color: "#f97316" }} />
                Hàng hóa ({shipment.items.length} loại)
              </h3>
              <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <span>
                  SL: <strong style={{ color: "var(--text-primary)" }}>{shipment.items.reduce((s, i) => s + i.quantity, 0)}</strong>
                </span>
                <span>
                  Kg: <strong style={{ color: "var(--text-primary)" }}>{(shipment.items.reduce((s, i) => s + (i.weight || 0) * i.quantity, 0)).toLocaleString()}</strong>
                </span>
              </div>
            </div>
            <div className="table-wrapper rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th className="text-[10px]">Sản phẩm</th>
                    <th className="text-[10px]">SKU</th>
                    <th className="text-[10px] text-right">Số lượng</th>
                    <th className="text-[10px] text-right">Trọng lượng</th>
                  </tr>
                </thead>
                <tbody>
                  {shipment.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-input)] transition-colors">
                      <td className="font-medium text-sm">{item.product.name}</td>
                      <td><code className="text-[11px] px-1 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{item.product.sku}</code></td>
                      <td className="text-right font-semibold">{item.quantity} <span className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>{item.product.unit}</span></td>
                      <td className="text-right">{item.weight ? `${item.weight} kg` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── PHÂN BỔ TẢI TRỌNG ── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                <Gauge size={14} style={{ color: "#f97316" }} /> Phân bổ tải trọng
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
                Cân bằng tốt
              </span>
            </div>
            <div className="relative border rounded-xl p-4 border-dashed" style={{ borderColor: "var(--border-color)", minHeight: "150px", background: "var(--bg-input)" }}>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                <svg width="100%" height="60" viewBox="0 0 600 80" fill="none" preserveAspectRatio="none">
                  <path d={isSimulating ? `M 0 40 C 150 ${40 + Math.sin(simStepIndex * 0.4) * 15}, 300 ${40 - Math.sin(simStepIndex * 0.4) * 15}, 600 40` : "M 0 40 C 150 25, 350 55, 600 40"} stroke="#f97316" strokeWidth="3" strokeLinecap="round" className="transition-all duration-300" />
                  <circle cx="300" cy={isSimulating ? 40 - Math.sin(simStepIndex * 0.4) * 15 : 40} r="5" fill="#f97316" className="transition-all duration-300" />
                </svg>
              </div>
              <div className="grid grid-cols-2 gap-3 h-full relative z-10">
                <div className="p-3 rounded-xl border backdrop-blur-md" style={{ borderColor: "var(--border-light)", background: "var(--bg-card)" }}>
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Phía trước</span>
                  <div className="text-lg font-bold mt-0.5" style={{ color: "#f97316" }}>
                    {Math.floor(shipment.items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0) * 0.52 || 1144)} kg
                  </div>
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>52% tải trọng</span>
                  <div className="mt-2 w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ width: "72%", background: "linear-gradient(90deg, #f97316, #ea580c)" }} />
                  </div>
                </div>
                <div className="p-3 rounded-xl border backdrop-blur-md" style={{ borderColor: "var(--border-light)", background: "var(--bg-card)" }}>
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Phía sau</span>
                  <div className="text-lg font-bold mt-0.5" style={{ color: "#6366f1" }}>
                    {Math.floor(shipment.items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0) * 0.48 || 1056)} kg
                  </div>
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>48% tải trọng</span>
                  <div className="mt-2 w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ width: "48%", background: "linear-gradient(90deg, #6366f1, #4f46e5)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Reject modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setRejectOpen(false); setRejectReason(""); }} />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl border p-6 space-y-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <h3 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>Từ chối vận đơn</h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Vui lòng nhập lý do từ chối vận đơn {shipment.shipmentCode}:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="input-base text-sm resize-none"
              rows={3}
              style={{ width: "100%" }}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setRejectOpen(false); setRejectReason(""); }} className="btn btn-secondary">Hủy</button>
              <button
                onClick={async () => {
                  if (!rejectReason.trim()) return;
                  try {
                    await shipmentsApi.reject(shipment.id, rejectReason);
                    refresh();
                  } catch {}
                  setRejectOpen(false);
                  setRejectReason("");
                }}
                disabled={!rejectReason.trim()}
                className="btn"
                style={{ background: "#ef4444", color: "white" }}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}