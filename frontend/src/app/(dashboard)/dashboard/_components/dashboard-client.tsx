"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Truck, Package, Warehouse, Bell, TrendingUp,
  ArrowRight, MapPin, Clock, CheckCircle, AlertTriangle,
  XCircle, Activity, QrCode, Plus, ClipboardList,
} from "lucide-react";
import { formatRelative, getShipmentStatusLabel, getShipmentStatusBadge } from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { useSharedDataStore } from "@/store/shared-data-store";

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

// POLLING INTERVAL (ms): 15 seconds — balances realtime feel with API load
const POLL_INTERVAL = 15_000;

// ───────────────────────────────────────────
// Realtime Dashboard Hook
// ───────────────────────────────────────────
function useRealtimeDashboard(initial: Props) {
  // Granular selectors to avoid re-render on every shared store update
  const shipmentStats = useSharedDataStore((s) => s.shipmentStats);
  const alertList = useSharedDataStore((s) => s.alerts);
  const warehouseList = useSharedDataStore((s) => s.warehouses);
  const sharedLastUpdated = useSharedDataStore((s) => s.lastUpdated);

  // Use shared data when available, fall back to server-provided initial data
  const stats = shipmentStats ?? initial.shipmentStats;
  const alerts: ActiveAlert[] = (alertList.length > 0 ? alertList : initial.activeAlerts) as ActiveAlert[];
  const whCount = warehouseList.length > 0 ? warehouseList.length : initial.warehouseCount;

  // Keep local state for data unique to this page
  const [shipments, setShipments] = useState<RecentShipment[]>(initial.recentShipments);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [socketConnected, setSocketConnected] = useState(false);


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
    if (sharedLastUpdated) setLastUpdated(sharedLastUpdated);
  }, [sharedLastUpdated]);

  // Refreshing state for manual refresh button
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const refreshShared = useSharedDataStore.getState().refresh;
    await Promise.all([
      refreshShared(),      // stats, alerts, warehouses
      fetchShipments(),       // shipments list
    ]);
    setRefreshing(false);
  }, [fetchShipments]);

  // Socket.io for realtime events
  useEffect(() => {
    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");

      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));

      // New alert — refresh shared store (syncs to badge + all consumers)
      socket.on("alert:new", () => {
        useSharedDataStore.getState().refresh();
      });

      return socket;
    };
    const cleanup = initSocket();
    return () => {
      cleanup.then((s) => {
        s?.off("alert:new");
        s?.disconnect();
      });
    };
  }, []);

  return {
    stats, alerts: { list: alerts, count: alerts.length },
    whCount, shipments, lastUpdated, socketConnected,
    refresh: handleRefresh, refreshing,
  };
}

export default function DashboardClient(props: Props) {
  const { stats, alerts, whCount, shipments, lastUpdated, socketConnected, refresh, refreshing } = useRealtimeDashboard(props);
  const auth = useAuth();
  const { isAdmin, isManager } = auth;
  const pendingForCurrentUser = useSharedDataStore((s) => s.shipmentStats?.pendingForCurrentUser ?? 0);

  // Fetch pending loading/receiving tasks for all roles (filtered by backend)
  const [pendingLoading, setPendingLoading] = useState<RecentShipment[]>([]);
  const [pendingReceiving, setPendingReceiving] = useState<RecentShipment[]>([]);

  useEffect(() => {
    shipmentsApi.getAll({ limit: "10", status: "PENDING" }).then((r) => setPendingLoading(r.data.data ?? [])).catch(() => {});
    shipmentsApi.getAll({ limit: "10", status: "DELIVERING" }).then((r) => setPendingReceiving(r.data.data ?? [])).catch(() => {});
  }, []);

  const pendingLoadingCount = pendingLoading.length;
  const pendingReceivingCount = pendingReceiving.length;




  const cards = statCards(stats, alerts.count, whCount);

  return (
    <div className="space-y-6">
      {/* Unified: same layout for ALL roles — only data differs based on permissions */}

      {/* Page header — redesigned for mobile-first */}
      <div className="card overflow-hidden">
        {/* Top row: live status + time */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1 sm:px-6">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
            <span className="text-[11px] sm:text-xs font-medium" style={{ color: socketConnected ? "var(--color-success)" : "var(--text-muted)" }}>
              {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
            </span>
          </div>
          <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        {/* Title + description */}
        <div className="px-5 sm:px-6 pb-3">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Tổng quan
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Theo dõi hoạt động logistics thời gian thực
          </p>
        </div>

        {/* Action buttons row */}
        <div className="px-5 sm:px-6 pb-4 sm:pb-5" style={{ borderTop: "1px solid var(--border-light)" }}>
          <div className="pt-3 flex gap-2 w-full sm:w-auto">
            <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center">
              <Activity size={14} className={refreshing ? "animate-spin" : ""} />
              <span className="sm:inline">{refreshing ? "Đang tải..." : "Làm mới"}</span>
            </button>
            {isAdmin || isManager ? (
              <Link href="/dashboard/shipments/new" className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center whitespace-nowrap">
                <Truck size={15} /> Tạo vận đơn
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stat cards — horizontal scroll on mobile */}
      <div className="flex overflow-x-auto gap-3 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-2 xl:grid-cols-4 sm:gap-4 sm:overflow-visible sm:snap-none">
        {cards.map((card, i) => (
          <Link
            key={card.label}
            href={card.link}
            className="card card-hover stat-card flex items-start gap-4 animate-fade-in snap-start shrink-0 min-w-[190px] sm:min-w-0"
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

      {/* Unified task sections — Chờ xuất hàng / Chờ nhập kho */}
      {(pendingLoadingCount > 0 || pendingReceivingCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chờ xuất hàng */}
          <div className="card overflow-hidden flex flex-col" style={{ minHeight: '320px' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Package size={16} style={{ color: '#6366f1' }} />
                <span>Chuẩn bị xuất hàng</span>
                {pendingLoadingCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#6366f1' }}>
                    {pendingLoadingCount}
                  </span>
                )}
              </h2>
              <Link href="/dashboard/shipments?status=PENDING" className="text-xs font-medium" style={{ color: '#f97316' }}>Xem tất cả</Link>
            </div>
            {pendingLoadingCount === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12" style={{ color: 'var(--text-muted)' }}>
                <Package size={36} style={{ opacity: 0.2 }} />
                <p className="text-sm">Không có đơn hàng chờ xuất</p>
              </div>
            ) : (
              <div className="flex-1 divide-y overflow-y-auto" style={{ borderColor: 'var(--border-light)' }}>
                {pendingLoading.map((s) => (
                  <Link key={s.id} href={`/dashboard/shipments/${s.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-info-bg)' }}>
                      <Package size={15} style={{ color: '#6366f1' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.shipmentCode}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{s.destinationAddress}</div>
                    </div>
                    <span className="btn btn-primary btn-xs shrink-0">Chuẩn bị</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Chờ nhập kho */}
          <div className="card overflow-hidden flex flex-col" style={{ minHeight: '320px' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Warehouse size={16} style={{ color: '#10b981' }} />
                <span>Tiếp nhận hàng về</span>
                {pendingReceivingCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#10b981' }}>
                    {pendingReceivingCount}
                  </span>
                )}
              </h2>
              <Link href="/dashboard/shipments?status=DELIVERING" className="text-xs font-medium" style={{ color: '#f97316' }}>Xem tất cả</Link>
            </div>
            {pendingReceivingCount === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12" style={{ color: 'var(--text-muted)' }}>
                <Warehouse size={36} style={{ opacity: 0.2 }} />
                <p className="text-sm">Không có hàng đang nhập kho</p>
              </div>
            ) : (
              <div className="flex-1 divide-y overflow-y-auto" style={{ borderColor: 'var(--border-light)' }}>
                {pendingReceiving.map((s) => (
                  <Link key={s.id} href={`/dashboard/shipments/${s.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-success-bg)' }}>
                      <Warehouse size={15} style={{ color: '#10b981' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.shipmentCode}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{s.destinationAddress}</div>
                    </div>
                    <span className="btn btn-primary btn-xs shrink-0">Nhập kho</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Thao tác nhanh */}
      <div className="card p-5">
        <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-muted)' }}>THAO TÁC NHANH</h3>              <div className="flex overflow-x-auto gap-2 snap-x snap-mandatory no-scrollbar sm:flex-wrap sm:snap-none">
          {[
            { href: '/dashboard/inventory', label: 'Xem tồn kho', icon: Package, color: '#6366f1', bg: 'var(--color-info-bg)' },
            { href: '/dashboard/qr-scan', label: 'Kiểm kho QR', icon: QrCode, color: '#10b981', bg: 'var(--color-success-bg)' },
            { href: '/dashboard/inventory/new', label: 'Nhập hàng mới', icon: Plus, color: '#f97316', bg: 'var(--color-warning-bg)' },
            { href: '/dashboard/shipments', label: 'DS vận đơn', icon: ClipboardList, color: '#ef4444', bg: 'var(--color-error-bg)' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 snap-start shrink-0 sm:flex-1"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: action.bg }}>
                <action.icon size={18} style={{ color: action.color }} />
              </div>
              <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
            </Link>
          ))}
        </div>
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

      {/* Manager: Chờ duyệt section */}
      {isManager && pendingForCurrentUser > 0 ? (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
              <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Vận đơn chờ duyệt ({pendingForCurrentUser})
              </h2>
              <Link href="/dashboard/shipments?status=PENDING" className="text-xs font-medium" style={{ color: "#f97316" }}>
                Xem tất cả
              </Link>
            </div>
            <div className="px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#eef2ff" }}>
                <Truck size={18} style={{ color: "#6366f1" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Có {pendingForCurrentUser} vận đơn đang chờ bạn duyệt
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Các vận đơn này cần được quản lý kho nguồn duyệt trước khi xếp hàng và vận chuyển
                </p>
              </div>
              <Link
                href="/dashboard/shipments?status=PENDING"
                className="btn btn-primary btn-sm ml-auto"
              >
                Duyệt ngay
              </Link>
            </div>
          </div>
        ) : null}

      {/* Quick stats bar — horizontal scroll on mobile */}              <div className="flex overflow-x-auto gap-2 snap-x snap-mandatory no-scrollbar md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:snap-none">
        {[
          { label: "Chờ xác nhận", value: stats.pending, icon: Clock, color: "#6366f1" },
          { label: "Đang bốc xếp", value: stats.inTransit, icon: TrendingUp, color: "#f97316" },
          { label: "Hoàn thành", value: stats.delivered, icon: CheckCircle, color: "#10b981" },
          { label: "Thất bại / Hủy", value: stats.failed, icon: XCircle, color: "#ef4444" },
        ].map((item) => (
          <div key={item.label} className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3 snap-start shrink-0 min-w-[130px] sm:min-w-0">
            <item.icon size={20} style={{ color: item.color }} />
            <div>
              <div className="font-bold text-lg" style={{ color: item.color }}>{item.value}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
