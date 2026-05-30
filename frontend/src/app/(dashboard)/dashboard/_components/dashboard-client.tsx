"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Truck, Package, Warehouse, Bell, TrendingUp,
  ArrowRight, MapPin, Clock, CheckCircle, AlertTriangle,
  XCircle, Activity, Navigation, Zap,
} from "lucide-react";
import { formatRelative, getShipmentStatusLabel, getShipmentStatusBadge } from "@/lib/utils";
import { io } from "socket.io-client";

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
    bg: "#fff7ed",
    link: "/dashboard/shipments?status=IN_TRANSIT",
    sub: `${stats.total} tổng vận đơn`,
  },
  {
    label: "Đã giao thành công",
    value: stats.delivered,
    icon: CheckCircle,
    color: "#10b981",
    bg: "#ecfdf5",
    link: "/dashboard/shipments?status=DELIVERED",
    sub: `${stats.pending} chờ xác nhận`,
  },
  {
    label: "Cảnh báo tồn kho",
    value: alerts,
    icon: Bell,
    color: "#ef4444",
    bg: "#fef2f2",
    link: "/dashboard/alerts",
    sub: "Cần xử lý ngay",
  },
  {
    label: "Kho đang hoạt động",
    value: warehouses,
    icon: Warehouse,
    color: "#6366f1",
    bg: "#eef2ff",
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

export default function DashboardClient({ shipmentStats, activeAlerts, warehouseCount, recentShipments }: Props) {
  const cards = statCards(shipmentStats, activeAlerts.length, warehouseCount);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("shipment:position", (data: Omit<LiveEvent, "ts">) => {
      setLiveEvents(prev => [{ ...data, ts: Date.now() }, ...prev].slice(0, 5));
    });
    return () => { socket.disconnect(); };
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Tổng quan
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Theo dõi hoạt động logistics của bạn
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/shipments/new" className="btn btn-primary btn-sm">
            <Truck size={15} /> Tạo vận đơn
          </Link>
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

          {recentShipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "var(--text-muted)" }}>
              <Truck size={40} style={{ opacity: 0.3 }} />
              <p className="text-sm">Không có vận đơn đang vận chuyển</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-light)" }}>
              {recentShipments.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/shipments/${s.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-input)] transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "#fff7ed" }}
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

          {activeAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}>
              <CheckCircle size={36} style={{ color: "#10b981", opacity: 0.5 }} />
              <p className="text-sm">Không có cảnh báo nào</p>
            </div>
          ) : (
            <div className="divide-y overflow-y-auto max-h-80" style={{ borderColor: "var(--border-light)" }}>
              {activeAlerts.slice(0, 5).map((alert) => {
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

      {/* Quick stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Chờ xác nhận", value: shipmentStats.pending, icon: Clock, color: "#6366f1" },
          { label: "Đang bốc xếp", value: shipmentStats.inTransit, icon: TrendingUp, color: "#f97316" },
          { label: "Hoàn thành", value: shipmentStats.delivered, icon: CheckCircle, color: "#10b981" },
          { label: "Thất bại / Hủy", value: shipmentStats.failed, icon: XCircle, color: "#ef4444" },
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
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: evt.status === "DELAYED" ? "#fef2f2" : "#fff7ed" }}>
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
