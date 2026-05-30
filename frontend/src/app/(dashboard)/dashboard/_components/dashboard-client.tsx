"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Truck, Package, Warehouse, Bell, TrendingUp,
  ArrowRight, MapPin, Clock, CheckCircle, AlertTriangle,
  XCircle, Activity, Navigation, Zap,
} from "lucide-react";
import { formatRelative, getShipmentStatusLabel, getShipmentStatusBadge } from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { useSharedDataStore } from "@/store/shared-data-store";
import DashboardDriver from "./dashboard-driver";

interface ShipmentStats {
  total: number; inTransit: number; delivered: number; pending: number; failed: number;
}

interface RecentShipment {
  id: string;
  shipmentCode: string;
  status: string;
  destinationAddress: string;
  estimatedArrival?: string;
  driver?: {
    name: string;
    phone?: string;
  } | null;
}

interface ActiveAlert {
  id: string;
  severity: string;
  message: string;
  product?: {
    name: string;
  } | null;
}

interface Props {
  shipmentStats: ShipmentStats;
  activeAlerts: ActiveAlert[];
  warehouseCount: number;
  recentShipments: RecentShipment[];
}

const statCards = (stats: ShipmentStats, alerts: number, warehouses: number) => [
  {
    label: "Đang vận chuyển",
    value: stats.inTransit,
    icon: Truck,
    color: "#f97316",
    bg: "var(--color-warning-bg)",
    link: "/dashboard/shipments?status=IN_TRANSIT",
    sub: `${stats.total} tổng vận đơn`,
  },
  {
    label: "Đã giao thành công",
    value: stats.delivered,
    icon: CheckCircle,
    color: "#10b981",
    bg: "var(--color-success-bg)",
    link: "/dashboard/shipments?status=DELIVERED",
    sub: `${stats.pending} chờ xác nhận`,
  },
  {
    label: "Cảnh báo tồn kho",
    value: alerts,
    icon: Bell,
    color: "#ef4444",
    bg: "var(--color-error-bg)",
    link: "/dashboard/alerts",
    sub: "Cần xử lý ngay",
  },
  {
    label: "Kho đang hoạt động",
    value: warehouses,
    icon: Warehouse,
    color: "#6366f1",
    bg: "var(--color-info-bg)",
    link: "/dashboard/warehouse",
    sub: "Xem chi tiết",
  },
];

interface LiveEvent {
  shipmentId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  status?: string;
  ts: number;
}

// POLLING INTERVAL (ms): 15 seconds — balances realtime feel with API load
const POLL_INTERVAL = 15_000;

// ───────────────────────────────────────────
// Realtime Dashboard Hook
// ───────────────────────────────────────────
function useRealtimeDashboard(initial: Props) {
  // Read shared data from centralized store (stats, alerts, warehouses)
  const shared = useSharedDataStore();

  // Use shared data when available, fall back to server-provided initial data
  const stats = shared.shipmentStats ?? initial.shipmentStats;
  const alerts: ActiveAlert[] = (shared.alerts.length > 0 ? shared.alerts : initial.activeAlerts) as ActiveAlert[];
  const whCount = shared.warehouses.length > 0 ? shared.warehouses.length : initial.warehouseCount;

  // Keep local state for data unique to this page
  const [shipments, setShipments] = useState<RecentShipment[]>(initial.recentShipments);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [socketConnected, setSocketConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);

  // Only poll for shipments list — stats/alerts/warehouses handled by shared store
  const fetchShipments = useCallback(async () => {
    try {
      const r = await shipmentsApi.getAll({ limit: 5, status: "IN_TRANSIT" });
      setShipments(r.data.data ?? []);
    } catch {}
    setLastUpdated(new Date());
  }, []);

  // Initial fetch + polling for shipments list
  useEffect(() => {
    fetchShipments();
    const interval = setInterval(fetchShipments, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchShipments]);

  // Update lastUpdated when shared store refreshes
  useEffect(() => {
    if (shared.lastUpdated) setLastUpdated(shared.lastUpdated);
  }, [shared.lastUpdated]);

  // Refreshing state for manual refresh button
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      shared.refresh(),      // stats, alerts, warehouses
      fetchShipments(),       // shipments list
    ]);
    setRefreshing(false);
  }, [shared, fetchShipments]);

  // Socket.io for realtime events
  useEffect(() => {
    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");

      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));

      // GPS tracking — realtime
      socket.on("shipment:position", (data: Omit<LiveEvent, "ts">) => {
        setLiveEvents(prev => [{ ...data, ts: Date.now() }, ...prev].slice(0, 5));
      });

      // New alert — refresh shared store (syncs to badge + all consumers)
      socket.on("alert:new", () => {
        shared.refresh();
      });

      return socket;
    };
    const cleanup = initSocket();
    return () => {
      cleanup.then((s) => {
        s?.off("shipment:position");
        s?.off("alert:new");
        s?.disconnect();
      });
    };
  }, [shared]);

  return {
    stats, alerts: { list: alerts, count: alerts.length },
    whCount, shipments, lastUpdated, socketConnected, liveEvents,
    refresh: handleRefresh, refreshing,
  };
}

export default function DashboardClient(props: Props) {
  const { stats, alerts, whCount, shipments, lastUpdated, socketConnected, liveEvents, refresh, refreshing } = useRealtimeDashboard(props);
  const auth = useAuth();
  const { isAdmin, isManager, isDriver, isStaffOnly } = auth;

  // DRIVER — show driver-specific dashboard
  if (isDriver) {
    return <DashboardDriver />;
  }

  const [pendingLoading, setPendingLoading] = useState<RecentShipment[]>([]);
  const [pendingReceiving, setPendingReceiving] = useState<RecentShipment[]>([]);

  // Fetch pending tasks for staff
  useEffect(() => {
    if (!isStaffOnly) return;
    shipmentsApi.getAll({ limit: "10", status: "PENDING" }).then((r) => setPendingLoading(r.data.data ?? [])).catch(() => {});
    shipmentsApi.getAll({ limit: "10", status: "DELIVERING" }).then((r) => setPendingReceiving(r.data.data ?? [])).catch(() => {});
  }, [isStaffOnly]);

  const cards = statCards(stats, alerts.count, whCount);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Tổng quan
            </h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${socketConnected ? "bg-success text-success" : ""}`} style={{ background: socketConnected ? undefined : "var(--bg-input)", color: socketConnected ? undefined : "var(--text-muted)" }}>
              <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Theo dõi hoạt động logistics thời gian thực
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
          {isAdmin || isManager ? (
            <Link href="/dashboard/shipments/new" className="btn btn-primary btn-sm">
              <Truck size={15} /> Tạo vận đơn
            </Link>
          ) : null}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <Link
            key={card.label}
            href={card.link}
            className="card card-hover stat-card flex items-start gap-4 animate-fade-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: card.bg }}
            >
              <card.icon size={22} style={{ color: card.color }} />
            </div>
            <div className="min-w-0">
              <div className="stat-value" style={{ color: card.color }}>{card.value}</div>
              <div className="stat-label mt-1">{card.label}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{card.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent shipments */}
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>
              Vận đơn đang vận chuyển
            </h2>
            <Link href="/dashboard/shipments" className="flex items-center gap-1 text-sm font-medium" style={{ color: "#f97316" }}>
              Xem tất cả <ArrowRight size={14} />
            </Link>
          </div>

          {shipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "var(--text-muted)" }}>
              <Truck size={40} style={{ opacity: 0.3 }} />
              <p className="text-sm">Không có vận đơn đang vận chuyển</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-light)" }}>
              {shipments.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/shipments/${s.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-input)] transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--color-warning-bg)" }}
                  >
                    <Truck size={18} style={{ color: "#f97316" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                        {s.shipmentCode}
                      </span>
                      <span className={`badge ${getShipmentStatusBadge(s.status)}`}>
                        {getShipmentStatusLabel(s.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <MapPin size={11} />
                      <span className="truncate">{s.destinationAddress}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {s.estimatedArrival && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        <Clock size={11} />
                        {formatRelative(s.estimatedArrival)}
                      </div>
                    )}
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {s.driver?.name}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Alert panel */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>
              Cảnh báo tồn kho
            </h2>
            <Link href="/dashboard/alerts" className="flex items-center gap-1 text-sm font-medium" style={{ color: "#f97316" }}>
              Xem tất cả <ArrowRight size={14} />
            </Link>
          </div>

          {alerts.list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}>
              <CheckCircle size={36} style={{ color: "#10b981", opacity: 0.5 }} />
              <p className="text-sm">Không có cảnh báo nào</p>
            </div>
          ) : (
            <div className="divide-y overflow-y-auto max-h-80" style={{ borderColor: "var(--border-light)" }}>
              {alerts.list.slice(0, 5).map((alert) => {
                const severityColor: Record<string, string> = {
                  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#6366f1",
                };
                const SevIcon = alert.severity === "CRITICAL" ? XCircle : AlertTriangle;
                return (
                  <div key={alert.id} className="px-6 py-3 flex items-start gap-3">
                    <SevIcon
                      size={16}
                      className="flex-shrink-0 mt-0.5"
                      style={{ color: severityColor[alert.severity] || "#6b7280" }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                        {alert.product?.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {alert.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Staff tasks section */}
      {isStaffOnly && (pendingLoading.length > 0 || pendingReceiving.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Chờ chuẩn bị hàng */}
          {pendingLoading.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
                <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Package size={16} style={{ color: "#6366f1" }} /> Chờ xuất hàng
                </h2>
                <Link href="/dashboard/shipments?status=PENDING" className="text-xs font-medium" style={{ color: "#f97316" }}>
                  Xem tất cả
                </Link>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-light)" }}>
                {pendingLoading.slice(0, 5).map((s) => (
                  <Link
                    key={s.id}
                    href={`/dashboard/shipments/${s.id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"                    style={{ background: "var(--color-info-bg)" }}>
                      <Package size={15} style={{ color: "#6366f1" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.shipmentCode}</div>
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{s.destinationAddress}</div>
                    </div>
                    <button className="btn btn-primary btn-xs">Chuẩn bị</button>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Chờ nhập hàng */}
          {pendingReceiving.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
                <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Warehouse size={16} style={{ color: "#10b981" }} /> Chờ nhập kho
                </h2>
                <Link href="/dashboard/shipments?status=DELIVERING" className="text-xs font-medium" style={{ color: "#f97316" }}>
                  Xem tất cả
                </Link>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-light)" }}>
                {pendingReceiving.slice(0, 5).map((s) => (
                  <Link
                    key={s.id}
                    href={`/dashboard/shipments/${s.id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"                    style={{ background: "var(--color-success-bg)" }}>
                      <Warehouse size={15} style={{ color: "#10b981" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.shipmentCode}</div>
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{s.destinationAddress}</div>
                    </div>
                    <button className="btn btn-primary btn-xs">Nhập kho</button>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Chờ xác nhận", value: stats.pending, icon: Clock, color: "#6366f1" },
          { label: "Đang bốc xếp", value: stats.inTransit, icon: TrendingUp, color: "#f97316" },
          { label: "Hoàn thành", value: stats.delivered, icon: CheckCircle, color: "#10b981" },
          { label: "Thất bại / Hủy", value: stats.failed, icon: XCircle, color: "#ef4444" },
        ].map((item) => (
          <div key={item.label} className="card p-4 flex items-center gap-3">
            <item.icon size={20} style={{ color: item.color }} />
            <div>
              <div className="font-bold text-lg" style={{ color: item.color }}>{item.value}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Activity Ticker */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2">
            <Activity size={16} style={{ color: "#f97316" }} />
            <h2 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Cập nhật GPS thời gian thực</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
            <span className="text-xs font-medium" style={{ color: socketConnected ? "#10b981" : "var(--text-muted)" }}>
              {socketConnected ? "Socket.io kết nối" : "Chưa kết nối"}
            </span>
          </div>
        </div>

        {liveEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3" style={{ color: "var(--text-muted)" }}>
            <Navigation size={32} style={{ opacity: 0.2 }} />
            <p className="text-sm">
              {socketConnected ? "Chờ dữ liệu GPS từ xe — Bắt đầu giả lập trong trang chi tiết vận đơn" : "Đang kết nối Socket.io..."}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-light)" }}>
            {liveEvents.map((evt, i) => (
              <div key={evt.ts} className="flex items-center gap-4 px-5 py-3 transition-colors" style={{ background: i === 0 ? "rgba(249,115,22,0.04)" : undefined }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"                    style={{ background: evt.status === "DELAYED" ? "var(--color-error-bg)" : "var(--color-warning-bg)" }}>
                  {evt.status === "DELAYED"
                    ? <Zap size={15} style={{ color: "#ef4444" }} />
                    : <Navigation size={15} style={{ color: "#f97316" }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {evt.status === "DELAYED" ? "🚨 Sự cố phát hiện" : "🚛 Cập nhật vị trí xe"}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {evt.latitude.toFixed(4)}, {evt.longitude.toFixed(4)}
                    {evt.speed ? ` · ${evt.speed} km/h` : ""}
                  </div>
                </div>
                <div className="text-[10px] font-medium flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  {new Date(evt.ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
