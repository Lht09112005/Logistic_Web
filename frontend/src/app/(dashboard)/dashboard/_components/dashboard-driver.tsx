"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Truck, MapPin, CheckCircle, Circle, Clock,
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
    <div className="space-y-5 sm:space-y-6 driver-dashboard">


      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-2 sm:gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              Chuyến đi của tôi
            </h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: socketConnected ? "#dcfce7" : "#f1f5f9", color: socketConnected ? "#15803d" : "var(--text-muted)" }}>
              <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
            </div>
          </div>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {activeShipments.length} chuyến đang hoạt động
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={handleRefresh} disabled={refreshing} className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{refreshing ? "Đang tải..." : "Làm mới"}</span>
          </button>
        </div>
      </div>

      {/* Active Shipments */}
      <div className="space-y-3">
        {activeShipments.length === 0 ? (
          <div className="card py-10 flex flex-col items-center justify-center gap-3" style={{ color: "var(--text-muted)" }}>
            <Truck size={40} style={{ opacity: 0.2 }} />
            <p className="font-medium">Bạn chưa được phân công chuyến nào</p>
            <p className="text-sm">Vui lòng chờ quản lý phân công vận đơn cho bạn</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeShipments.map((s) => {
              const totalCp = s.checkpoints?.length || 0;
              const completedCp = s.checkpoints?.filter((c) => c.isCompleted).length || 0;
              const progressPct = totalCp > 0 ? Math.round((completedCp / totalCp) * 100) : 0;

              return (
                <Link
                  key={s.id}
                  href={`/dashboard/shipments/${s.id}`}
                  className="card card-hover p-4 block animate-fade-in"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                          {s.shipmentCode}
                        </span>
                        <span className={`badge ${getShipmentStatusBadge(s.status)}`} style={{ fontSize: "10px", padding: "1px 7px" }}>
                          {getShipmentStatusLabel(s.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <MapPin size={10} />
                        <span className="truncate max-w-28">{s.originAddress}</span>
                        <ChevronRight size={10} />
                        <span className="truncate max-w-28">{s.destinationAddress}</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ml-2" style={{ background: "var(--color-warning-bg)" }}>
                      <Truck size={16} style={{ color: "#f97316" }} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  {totalCp > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                        <span>{completedCp}/{totalCp} trạm</span>
                        <span className="font-semibold" style={{ color: progressPct === 100 ? "#10b981" : "var(--text-muted)" }}>
                          {progressPct}%
                        </span>
                      </div>
                      <div className="progress-bar rounded-full" style={{ height: "3px" }}>
                        <div
                          className="progress-fill rounded-full"
                          style={{
                            width: `${progressPct}%`,
                            background: progressPct === 100
                              ? "linear-gradient(90deg,#10b981,#059669)"
                              : "#f97316",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Checkpoint summary */}
                  {s.checkpoints && s.checkpoints.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-h-[52px] overflow-y-auto driver-cp-scroll">
                      {s.checkpoints.map((cp) => (
                        <div
                          key={cp.id}
                          className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: cp.isCompleted ? "#dcfce7" : "#f1f5f9",
                            color: cp.isCompleted ? "#15803d" : "var(--text-muted)",
                          }}
                        >
                          {cp.isCompleted ? <CheckCircle size={7} /> : <Circle size={7} />}
                          {cp.name.length > 8 ? cp.name.slice(0, 5) + '..' : cp.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border-light)" }}>
                    <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <Package size={11} />
                      {s.items?.length || 0} mặt hàng
                    </div>
                    {s.estimatedArrival && (
                      <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <Clock size={11} />
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
          <h3 className="font-bold text-sm mb-2" style={{ color: "var(--text-muted)" }}>
            Đã giao hôm nay ({completedShipments.length})
          </h3>
          <div className="space-y-1.5">
            {completedShipments.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/shipments/${s.id}`}
                className="card p-2.5 flex items-center gap-2.5 hover:bg-[var(--bg-input)] transition-colors"
              >
                <CheckCircle size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{s.shipmentCode}</span>
                <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{s.destinationAddress}</span>
                <ChevronRight size={12} style={{ color: "var(--text-muted)", marginLeft: "auto", flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
