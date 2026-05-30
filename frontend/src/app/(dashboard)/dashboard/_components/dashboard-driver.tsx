"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Truck, MapPin, CheckCircle, Circle, Clock, Navigation,
  Package, Activity, ChevronRight,
} from "lucide-react";
import { formatRelative, getShipmentStatusLabel, getShipmentStatusBadge } from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface DriverShipment {
  id: string;
  shipmentCode: string;
  status: string;
  originAddress: string;
  destinationAddress: string;
  estimatedArrival?: string;
  items: { id: string }[];
  checkpoints: { id: string; name: string; isCompleted: boolean; sequence: number }[];
  _count?: { items: number; checkpoints: number };
}

const POLL_INTERVAL = 15_000;

export default function DashboardDriver() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<DriverShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [socketConnected, setSocketConnected] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { limit: "50" };
      if (user?.id) {
        params.driverId = user.id;
      }
      const res = await shipmentsApi.getAll(params);
      const data = (res.data.data || []) as DriverShipment[];
      setShipments(data);
    } catch {
      // keep existing
    }
    setLastUpdated(new Date());
  }, [user]);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Socket.io for realtime updates
  useEffect(() => {
    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));
      socket.on("shipment:position", () => fetchAll());
      return socket;
    };
    const cleanup = initSocket();
    return () => {
      cleanup.then((s) => {
        s?.off("shipment:position");
        s?.disconnect();
      });
    };
  }, [fetchAll]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    );
  }

  const activeStatuses = ["PENDING", "LOADING", "IN_TRANSIT", "DELIVERING"];
  const activeShipments = shipments.filter((s) => activeStatuses.includes(s.status));
  const completedShipments = shipments.filter((s) => s.status === "DELIVERED");
  const pendingCount = shipments.filter((s) => s.status === "PENDING").length;
  const inTransitCount = shipments.filter((s) => activeStatuses.includes(s.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              Bảng điều khiển tài xế
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: socketConnected ? "#dcfce7" : "#f1f5f9", color: socketConnected ? "#15803d" : "var(--text-muted)" }}>
              <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {activeShipments.length} chuyến đang hoạt động • {pendingCount} chờ lấy hàng • {inTransitCount} đang vận chuyển
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} disabled={refreshing} className="btn btn-ghost btn-sm">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Chờ lấy hàng", value: pendingCount, icon: Package, color: "#f97316", bg: "#fff7ed" },
          { label: "Đang vận chuyển", value: inTransitCount, icon: Navigation, color: "#6366f1", bg: "#eef2ff" },
          { label: "Đã giao hôm nay", value: completedShipments.length, icon: CheckCircle, color: "#10b981", bg: "#ecfdf5" },
          { label: "Tổng vận đơn", value: shipments.length, icon: Truck, color: "#6b7280", bg: "#f1f5f9" },
        ].map((item) => (
          <div key={item.label} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: item.bg }}>
              <item.icon size={20} style={{ color: item.color }} />
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: item.color }}>{item.value}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Shipments */}
      <div className="space-y-4">
        <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
          {activeShipments.length > 0 ? "Chuyến đi của tôi" : "Không có chuyến đi nào"}
        </h2>

        {activeShipments.length === 0 ? (
          <div className="card p-12 flex flex-col items-center justify-center gap-3" style={{ color: "var(--text-muted)" }}>
            <Truck size={48} style={{ opacity: 0.2 }} />
            <p className="font-medium">Bạn chưa được phân công chuyến nào</p>
            <p className="text-sm">Vui lòng chờ quản lý phân công vận đơn cho bạn</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeShipments.map((s) => {
              const totalCp = s.checkpoints?.length || 0;
              const completedCp = s.checkpoints?.filter((c) => c.isCompleted).length || 0;
              const progressPct = totalCp > 0 ? Math.round((completedCp / totalCp) * 100) : 0;

              return (
                <Link
                  key={s.id}
                  href={`/dashboard/shipments/${s.id}`}
                  className="card card-hover p-5 block animate-fade-in"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                          {s.shipmentCode}
                        </span>
                        <span className={`badge ${getShipmentStatusBadge(s.status)}`}>
                          {getShipmentStatusLabel(s.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <MapPin size={12} />
                        <span className="truncate max-w-32">{s.originAddress}</span>
                        <ChevronRight size={12} />
                        <span className="truncate max-w-32">{s.destinationAddress}</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-50">
                      <Truck size={20} style={{ color: "#f97316" }} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  {totalCp > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                        <span>Tiến độ: {completedCp}/{totalCp} trạm</span>
                        <span className="font-semibold" style={{ color: progressPct === 100 ? "#10b981" : "#f97316" }}>
                          {progressPct}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${progressPct}%`,
                            background: progressPct === 100
                              ? "linear-gradient(90deg,#10b981,#059669)"
                              : "linear-gradient(90deg,#f97316,#ea580c)",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Checkpoint summary */}
                  {s.checkpoints && s.checkpoints.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {s.checkpoints.map((cp) => (
                        <div
                          key={cp.id}
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                          style={{
                            background: cp.isCompleted ? "#dcfce7" : "#f1f5f9",
                            color: cp.isCompleted ? "#15803d" : "var(--text-muted)",
                          }}
                        >
                          {cp.isCompleted ? <CheckCircle size={10} /> : <Circle size={10} />}
                          {cp.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: "var(--border-light)" }}>
                    <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Package size={12} />
                      {s.items?.length || 0} mặt hàng
                    </div>
                    {s.estimatedArrival && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        <Clock size={12} />
                        {formatRelative(s.estimatedArrival)}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed today */}
      {completedShipments.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-3" style={{ color: "var(--text-muted)" }}>
            Đã giao hôm nay ({completedShipments.length})
          </h3>
          <div className="space-y-2">
            {completedShipments.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/shipments/${s.id}`}
                className="card p-3 flex items-center gap-3 hover:bg-[var(--bg-input)] transition-colors"
              >
                <CheckCircle size={16} style={{ color: "#10b981", flexShrink: 0 }} />
                <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{s.shipmentCode}</span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.destinationAddress}</span>
                <ChevronRight size={14} style={{ color: "var(--text-muted)", marginLeft: "auto" }} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
