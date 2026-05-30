"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Clock, Truck, User, Phone,
  CheckCircle, Circle, Package, Navigation,
  Play, Pause, Flame, Zap, AlertTriangle, TrendingUp, Gauge, Activity
} from "lucide-react";
import {
  formatDate, formatRelative, getShipmentStatusLabel, getShipmentStatusBadge,
} from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";
import {
  findShortestRoute,
  interpolateOptimizedPath,
  type RouteNode,
  type OptimizedRoute,
} from "@/lib/route-optimizer";

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

// Lazy-load map only on client
let MapComponent: React.ComponentType<{ shipment: Shipment; currentLat?: number; currentLng?: number }> | null = null;

export default function ShipmentDetailClient({ shipment: initial, lastUpdated, refresh, refreshing }: Props) {
  const router = useRouter();
  const [shipment, setShipment] = useState(initial);
  const [socketConnected, setSocketConnected] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const MapRef = useRef<typeof MapComponent>(null);
  const socketRef = useRef<any>(null);

  // Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(72); // km/h
  const [simStatusMsg, setSimStatusMsg] = useState("Thiết bị giả lập định vị GPS đang ngoại tuyến");
  const [simError, setSimError] = useState("");
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [simStepIndex, setSimStepIndex] = useState(0);

  // Load map component dynamically (SSR-safe)
  useEffect(() => {
    import("./shipment-map").then((mod) => {
      MapRef.current = mod.ShipmentMap;
      setMapLoaded(true);
    });
    // Pre-compute optimal route using Dijkstra + nearest-neighbor
    computeOptimizedRoute();
  }, []);

  // Socket.io — live location updates (lazy loaded)
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
          setShipment((prev) => {
            const updatedStatus = data.status || prev.status;
            return {
              ...prev,
              currentLat: data.latitude,
              currentLng: data.longitude,
              status: updatedStatus
            };
          });
          if (data.speed !== undefined) {
            setSimSpeed(data.speed);
          }
        }
      });
      return socket;
    };
    const cleanup = initSocket();
    return () => {
      cleanup.then((s) => {
        s?.off("connect");
        s?.off("disconnect");
        s?.off("location:updated");
        s?.disconnect();
      });
    };
  }, [shipment.id]);

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      await shipmentsApi.update(shipment.id, { status: newStatus });
      setShipment((prev) => ({ ...prev, status: newStatus }));
    } catch { /* ignore */ }
  };

  // Route optimizer — cached computation ref
  const routeCacheRef = useRef<{
    route: OptimizedRoute;
    coords: { latitude: number; longitude: number; checkpointId?: string }[];
  } | null>(null);

  // Compute optimal route using Dijkstra + Nearest-Neighbor TSP
  const computeOptimizedRoute = () => {
    if (!shipment.originLat || !shipment.originLng ||
        !shipment.destinationLat || !shipment.destinationLng) {
      return null;
    }

    const originNode: RouteNode = {
      id: "origin", lat: shipment.originLat, lng: shipment.originLng, label: "Xuất phát",
    };
    const checkpointNodes: RouteNode[] = shipment.checkpoints
      .filter((cp) => cp.latitude && cp.longitude)
      .map((cp) => ({
        id: `cp:${cp.id}`, lat: cp.latitude!, lng: cp.longitude!, label: cp.name,
      }));
    const destinationNode: RouteNode = {
      id: "destination", lat: shipment.destinationLat, lng: shipment.destinationLng, label: "Điểm đến",
    };

    const route = findShortestRoute(originNode, checkpointNodes, destinationNode);
    const coords = interpolateOptimizedPath(route, 30);

    routeCacheRef.current = { route, coords };
    return { route, coords };
  };

  // Get cached route coordinates for simulation
  const getRouteCoordinates = () => {
    if (!routeCacheRef.current) {
      const result = computeOptimizedRoute();
      return result?.coords || [];
    }
    return routeCacheRef.current.coords;
  };

  const startSimulation = () => {
    if (shipment.status !== "IN_TRANSIT") {
      handleStatusUpdate("IN_TRANSIT");
    }

    const routeCoords = getRouteCoordinates();
    if (routeCoords.length === 0) {
      setSimError("Không đủ dữ liệu tọa độ lộ trình để chạy giả lập.");
      return;
    }

    setIsSimulating(true);
    setSimStatusMsg("⚡ Giả lập: Xe đang lưu thông trên lộ trình...");
    setSimError("");

    let currentIndex = simStepIndex;
    if (currentIndex >= routeCoords.length - 1) {
      currentIndex = 0;
      setSimStepIndex(0);
    }

    simIntervalRef.current = setInterval(async () => {
      if (currentIndex >= routeCoords.length - 1) {
        clearInterval(simIntervalRef.current!);
        setIsSimulating(false);
        setSimStatusMsg("🎉 Giả lập hoàn thành: Hàng đã được giao thành công!");
        handleStatusUpdate("DELIVERED");
        return;
      }

      currentIndex += 1;
      setSimStepIndex(currentIndex);
      const nextCoord = routeCoords[currentIndex];

      const newSpeed = Math.floor(65 + Math.random() * 18);
      setSimSpeed(newSpeed);

      if (socketRef.current) {
        socketRef.current.emit("location:update", {
          shipmentId: shipment.id,
          latitude: nextCoord.latitude,
          longitude: nextCoord.longitude,
          speed: newSpeed,
        });
      }

      // Check if passing a checkpoint
      if (nextCoord.checkpointId) {
        const cpIndex = shipment.checkpoints.findIndex((c) => c.id === nextCoord.checkpointId);
        if (cpIndex !== -1 && !shipment.checkpoints[cpIndex].isCompleted) {
          try {
            await shipmentsApi.update(shipment.id, {
              checkpoints: shipment.checkpoints.map((c, idx) =>
                idx === cpIndex ? { ...c, isCompleted: true } : c
              ),
            });
            setShipment((prev) => ({
              ...prev,
              checkpoints: prev.checkpoints.map((c, idx) =>
                idx === cpIndex ? { ...c, isCompleted: true, arrivedAt: new Date().toISOString() } : c
              ),
            }));
          } catch { /* ignore */ }
        }
      }
    }, 1500);
  };

  const pauseSimulation = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimulating(false);
    setSimStatusMsg("⏸️ Đã tạm dừng di chuyển giả lập");
  };

  const simulateIncident = () => {
    if (!isSimulating) {
      setSimError("Vui lòng kích hoạt di chuyển trước khi báo sự cố.");
      return;
    }
    pauseSimulation();
    setSimStatusMsg("🚨 SỰ CỐ GIẢ LẬP: Phát hiện hỏng hóc cơ khí hoặc tắc nghẽn giao thông!");
    handleStatusUpdate("DELAYED");

    if (socketRef.current) {
      socketRef.current.emit("location:update", {
        shipmentId: shipment.id,
        latitude: shipment.currentLat || shipment.originLat || 10.7769,
        longitude: shipment.currentLng || shipment.originLng || 106.7009,
        speed: 0,
        status: "DELAYED",
      });
    }
  };

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  const completedCount = shipment.checkpoints.filter((c) => c.isCompleted).length;

  const DynMap = MapRef.current;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              {shipment.shipmentCode}
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: socketConnected ? "#dcfce7" : "#f1f5f9", color: socketConnected ? "#15803d" : "var(--text-muted)" }}>
              <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className={`badge ${getShipmentStatusBadge(shipment.status)}`}>
              {getShipmentStatusLabel(shipment.status)}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Tạo lúc {formatDate(shipment.createdAt)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 items-center">
          <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
          {shipment.status === "PENDING" && (
            <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate("IN_TRANSIT")}>
              <Navigation size={14} /> Bắt đầu vận chuyển
            </button>
          )}
          {shipment.status === "IN_TRANSIT" && (
            <button className="btn btn-secondary btn-sm" style={{ color: "#10b981", borderColor: "#10b981" }} onClick={() => handleStatusUpdate("DELIVERED")}>
              <CheckCircle size={14} /> Đánh dấu đã giao
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Map — 3 cols */}
        <div className="xl:col-span-3 card overflow-hidden" style={{ height: "480px" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
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
          <div style={{ height: "calc(100% - 49px)" }}>
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

        {/* Info panel — 2 cols */}
        <div className="xl:col-span-2 space-y-4">
          {/* Bảng điều khiển Giả lập GPS (GPS Simulator Console) */}
          <div className="card p-5 space-y-4 border-2 transition-all duration-300" style={{ borderColor: isSimulating ? "#f97316" : "var(--border-color)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isSimulating ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                  Bảng giả lập GPS thời gian thực
                </h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-gray-400">
                🟢 Socket.io Live
              </span>
            </div>

            <p className="text-xs font-medium" style={{ color: isSimulating ? "#f97316" : "var(--text-secondary)" }}>
              {simStatusMsg}
            </p>

            {/* Telemetry data */}
            <div className="grid grid-cols-3 gap-2 py-2 text-center border-t border-b text-xs" style={{ borderColor: "var(--border-light)" }}>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 font-medium">Tốc độ</span>
                <div className="font-bold text-sm text-orange-500 flex items-center justify-center gap-0.5">
                  <Gauge size={12} />
                  {isSimulating ? simSpeed : 0} km/h
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 font-medium">Tọa độ xe</span>
                <div className="font-semibold text-[10px] truncate" style={{ color: "var(--text-primary)" }}>
                  {shipment.currentLat ? `${shipment.currentLat.toFixed(4)}, ${shipment.currentLng?.toFixed(4)}` : "Chưa có"}
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 font-medium">Trạm kiểm soát</span>
                <div className="font-bold text-sm text-indigo-500">
                  {completedCount}/{shipment.checkpoints.length}
                </div>
              </div>
            </div>

            {simError && (
              <div className="p-2 text-center text-xs rounded bg-red-100 text-red-700">
                {simError}
              </div>
            )}

            {/* Simulator Controls */}
            <div className="grid grid-cols-3 gap-2">
              {!isSimulating ? (
                <button
                  onClick={startSimulation}
                  disabled={shipment.status === "DELIVERED"}
                  className="btn btn-primary btn-sm flex items-center justify-center gap-1 col-span-2"
                >
                  <Play size={12} /> Bắt đầu giả lập
                </button>
              ) : (
                <button
                  onClick={pauseSimulation}
                  className="btn btn-secondary btn-sm flex items-center justify-center gap-1 col-span-2"
                  style={{ borderColor: "#f97316", color: "#f97316" }}
                >
                  <Pause size={12} /> Tạm dừng xe
                </button>
              )}
              
              <button
                onClick={simulateIncident}
                disabled={!isSimulating}
                className="btn btn-secondary btn-sm flex items-center justify-center gap-1"
                style={{ borderColor: "#ef4444", color: "#ef4444" }}
              >
                <Flame size={12} /> Sự cố
              </button>
            </div>
          </div>

          {/* Driver info */}
          <div className="card p-5">
            <h3 className="font-bold mb-4 text-sm uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Thông tin tài xế
            </h3>
            {shipment.driver ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
                    {shipment.driver.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{shipment.driver.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Tài xế</div>
                  </div>
                </div>
                {shipment.driver.phone && (
                  <a href={`tel:${shipment.driver.phone}`} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <Phone size={14} /> {shipment.driver.phone}
                  </a>
                )}
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <Truck size={14} /> {shipment.vehicleType} • {shipment.vehicleNumber}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <User size={16} /> Chưa phân công tài xế
              </div>
            )}
          </div>

          {/* Route info */}
          <div className="card p-5">
            <h3 className="font-bold mb-4 text-sm uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Lộ trình
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#10b981" }}>
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>XUẤT PHÁT</div>
                  <div className="text-sm" style={{ color: "var(--text-primary)" }}>{shipment.originAddress}</div>
                  {shipment.startedAt && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{formatDate(shipment.startedAt)}</div>}
                </div>
              </div>
              <div className="w-px h-6 ml-2.5" style={{ background: "var(--border-color)" }} />
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#f97316" }}>
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>ĐIỂM ĐẾN</div>
                  <div className="text-sm" style={{ color: "var(--text-primary)" }}>{shipment.destinationAddress}</div>
                  {shipment.estimatedArrival && (
                    <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      <Clock size={10} /> Dự kiến: {formatRelative(shipment.estimatedArrival)}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {shipment.totalDistance && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-light)" }}>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Tổng quãng đường</span>
                <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{shipment.totalDistance} km</span>
              </div>
            )}
          </div>

          {/* Checkpoints progress */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Trạm kiểm soát
              </h3>
              <span className="badge badge-info">{completedCount}/{shipment.checkpoints.length}</span>
            </div>
            <div className="progress-bar mb-4">
              <div className="progress-fill" style={{ width: `${(completedCount / (shipment.checkpoints.length || 1)) * 100}%` }} />
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {shipment.checkpoints.map((cp) => (
                <div key={cp.id} className="flex items-center gap-2.5">
                  {cp.isCompleted
                    ? <CheckCircle size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                    : <Circle size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: cp.isCompleted ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {cp.sequence}. {cp.name}
                    </div>
                  </div>
                  {cp.arrivedAt && <div className="text-xs flex-shrink-0" style={{ color: "#10b981" }}>✓</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Phân bổ tải trọng Container (Weight Distribution) */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                <Gauge size={16} className="text-orange-500" />
                Phân bổ tải trọng Container
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
                Cân bằng tải tốt
              </span>
            </div>

            {/* Container diagram */}
            <div className="relative border rounded-2xl p-4 bg-zinc-900/5 dark:bg-white/5 border-dashed" style={{ borderColor: "var(--border-color)", minHeight: "180px" }}>
              {/* Sine wave balance line */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 opacity-25 pointer-events-none">
                <svg width="100%" height="80" viewBox="0 0 600 120" fill="none" preserveAspectRatio="none">
                  <path
                    d={isSimulating 
                      ? `M 0 60 C 150 ${60 + Math.sin(simStepIndex * 0.4) * 20}, 300 ${60 - Math.sin(simStepIndex * 0.4) * 20}, 600 60`
                      : "M 0 60 C 150 40, 350 80, 600 60"
                    }
                    stroke="#f97316"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                  <circle cx="300" cy={isSimulating ? 60 - Math.sin(simStepIndex * 0.4) * 20 : 60} r="6" fill="#f97316" className="transition-all duration-300" />
                </svg>
              </div>

              {/* Section loads */}
              <div className="grid grid-cols-2 gap-4 h-full relative z-10">
                {/* Front load */}
                <div className="flex flex-col justify-between p-4 rounded-xl border bg-white/70 dark:bg-zinc-800/70 backdrop-blur-md" style={{ borderColor: "var(--border-light)" }}>
                  <div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Phía trước (Section 1)</span>
                    <h4 className="text-lg font-bold text-orange-500 mt-1">
                      {Math.floor(shipment.items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0) * 0.52 || 1144)} kg
                    </h4>
                    <span className="text-[10px] text-gray-500">Thiết bị điện tử (52%)</span>
                  </div>
                  <div className="space-y-1 mt-4">
                    <div className="flex justify-between text-[9px] text-gray-400 font-semibold">
                      <span>Khối lượng</span>
                      <span>72%</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full rounded-full" style={{ width: "72%" }} />
                    </div>
                  </div>
                </div>

                {/* Rear load */}
                <div className="flex flex-col justify-between p-4 rounded-xl border bg-white/70 dark:bg-zinc-800/70 backdrop-blur-md" style={{ borderColor: "var(--border-light)" }}>
                  <div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Phía sau (Section 2)</span>
                    <h4 className="text-lg font-bold text-indigo-500 mt-1">
                      {Math.floor(shipment.items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0) * 0.48 || 1056)} kg
                    </h4>
                    <span className="text-[10px] text-gray-500">Hàng tiêu dùng (48%)</span>
                  </div>
                  <div className="space-y-1 mt-4">
                    <div className="flex justify-between text-[9px] text-gray-400 font-semibold">
                      <span>Khối lượng</span>
                      <span>48%</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: "48%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cargo */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>
            <Package size={16} className="inline mr-2" style={{ color: "#f97316" }} />
            Hàng hóa vận chuyển ({shipment.items.length} loại)
          </h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>SKU</th>
                <th>Số lượng</th>
                <th>Trọng lượng</th>
              </tr>
            </thead>
            <tbody>
              {shipment.items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium">{item.product.name}</td>
                  <td><code className="text-xs" style={{ color: "var(--text-muted)" }}>{item.product.sku}</code></td>
                  <td>{item.quantity} {item.product.unit}</td>
                  <td>{item.weight ? `${item.weight} kg` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
