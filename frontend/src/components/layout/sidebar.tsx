"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { useSharedDataStore } from "@/store/shared-data-store";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";
import {
  LayoutDashboard, Package, Warehouse, Truck, QrCode,
  Bell, Settings, LogOut, ChevronLeft, Users, BarChart3,
  Navigation, MapPin, CheckCircle, Circle, Activity,
  Clock,  TrendingUp, AlertTriangle, ClipboardList,
} from "lucide-react";

// ─── Role-based accent colors ─────────────────────────────────
const ROLE_ACCENT: Record<string, { primary: string; bg: string; gradient: string }> = {
  ADMIN:  { primary: "#ef4444", bg: "#fef2f2", gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
  MANAGER:{ primary: "#6366f1", bg: "#eef2ff", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" },
  STAFF:  { primary: "#f97316", bg: "#fff7ed", gradient: "linear-gradient(135deg, #f97316, #ea580c)" },
  DRIVER: { primary: "#10b981", bg: "#ecfdf5", gradient: "linear-gradient(135deg, #10b981, #059669)" },
};

const roleLabels: Record<string, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý kho",
  STAFF: "Nhân viên",
  DRIVER: "Tài xế",
};

// ─── Navigation item definitions per role ─────────────────────

/** Items visible to ADMIN */
const adminNav = [
  {
    group: "Tổng quan",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/dashboard/analytics", icon: TrendingUp, label: "Phân tích" },
    ],
  },
  {
    group: "Vận hành",
    items: [
      { href: "/dashboard/warehouse", icon: Warehouse, label: "Quản lý kho" },
      { href: "/dashboard/inventory", icon: Package, label: "Tồn kho" },
      { href: "/dashboard/qr-scan", icon: QrCode, label: "Kiểm kho QR" },
      { href: "/dashboard/alerts", icon: Bell, label: "Cảnh báo", badge: "alerts" },
    ],
  },
  {
    group: "Vận chuyển",
    items: [
      { href: "/dashboard/shipments", icon: Truck, label: "Vận đơn" },
    ],
  },
  {
    group: "Quản trị",
    items: [
      { href: "/admin/users", icon: Users, label: "Người dùng" },
      { href: "/admin/settings", icon: Settings, label: "Cài đặt" },
    ],
  },
];

/** Items visible to MANAGER */
const managerNav = [
  {
    group: "Tổng quan",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/dashboard/analytics", icon: TrendingUp, label: "Phân tích" },
    ],
  },
  {
    group: "Vận hành",
    items: [
      { href: "/dashboard/warehouse", icon: Warehouse, label: "Kho hàng" },
      { href: "/dashboard/inventory", icon: Package, label: "Hàng hóa" },
      { href: "/dashboard/qr-scan", icon: QrCode, label: "QR Inventory" },
      { href: "/dashboard/alerts", icon: Bell, label: "Cảnh báo", badge: "alerts" },
    ],
  },
  {
    group: "Vận chuyển",
    items: [
      { href: "/dashboard/shipments", icon: Truck, label: "Vận đơn" },
    ],
  },
  {
    group: "Cá nhân",
    items: [
      { href: "/admin/settings", icon: Settings, label: "Cài đặt" },
    ],
  },
];

/** Items visible to STAFF */
const staffNav = [
  {
    group: "Tổng quan",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    ],
  },
  {
    group: "Kho hàng",
    items: [
      { href: "/dashboard/warehouse", icon: Warehouse, label: "Kho" },
      { href: "/dashboard/inventory", icon: ClipboardList, label: "Hàng tồn" },
      { href: "/dashboard/qr-scan", icon: QrCode, label: "QR Scan" },
      { href: "/dashboard/alerts", icon: Bell, label: "Cảnh báo", badge: "alerts" },
    ],
  },
  {
    group: "Vận chuyển",
    items: [
      { href: "/dashboard/shipments", icon: Truck, label: "Vận đơn" },
    ],
  },
  {
    group: "Cá nhân",
    items: [
      { href: "/admin/settings", icon: Settings, label: "Cài đặt" },
    ],
  },
];

/** Items visible to DRIVER */
const driverNav = [
  {
    group: "Điều hướng",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Tổng quan" },
      { href: "/dashboard/shipments", icon: Navigation, label: "Chuyến đi" },
    ],
  },
  {
    group: "Khác",
    items: [
      { href: "/admin/settings", icon: Settings, label: "Cài đặt" },
    ],
  },
];

function getNavItems(role?: string) {
  switch (role) {
    case "ADMIN": return adminNav;
    case "MANAGER": return managerNav;
    case "STAFF": return staffNav;
    case "DRIVER": return driverNav;
    default: return staffNav;
  }
}

// ─── Role Snapshot Widget (ADMIN/MANAGER/STAFF) ─────────────

interface SnapshotData {
  activeShipments: number;
  alerts: number;
  warehouses: number;
  pendingTasks: number;
}

function RoleSnapshot({ collapsed, role }: { collapsed: boolean; role: string }) {
  const shared = useSharedDataStore();

  // Compute snapshot from shared store data (eliminates duplicate polling)
  const data: SnapshotData | null = shared.shipmentStats
    ? {
        activeShipments: shared.shipmentStats.inTransit ?? 0,
        alerts: Array.isArray(shared.alerts) ? shared.alerts.length : 0,
        warehouses: Array.isArray(shared.warehouses) ? shared.warehouses.length : 0,
        pendingTasks:
          (shared.shipmentStats.pending ?? 0) +
          (shared.shipmentStats.inTransit ?? 0),
      }
    : null;

  if (!data) return null;

  const accent = ROLE_ACCENT[role] || ROLE_ACCENT.STAFF;

  if (collapsed) {
    const hasAlerts = data.alerts > 0;
    const hasActive = data.activeShipments > 0;
    const hasPending = data.pendingTasks > 0;
    const accentColor = accent.primary;

    // ── MANAGER collapsed: Trend-focused, purple dot for pending tasks ──
    if (role === "MANAGER") {
      return (
        <div className="px-2 pt-1.5 pb-1.5">
          <div
            className="rounded-xl border overflow-hidden transition-all duration-200 hover:scale-[1.03] group cursor-default"
            style={{
              borderColor: hasAlerts ? `${accentColor}40` : "var(--border-color)",
              background: "var(--bg-card)",
              boxShadow: hasAlerts ? `0 0 8px ${accentColor}15` : undefined,
            }}
            title={`${data.activeShipments} đang giao · ${data.alerts} cảnh báo · ${data.warehouses} kho`}
          >
            <div className="flex items-center justify-center p-2 relative">
              {/* Pending tasks indicator */}
              {hasPending && (
                <span className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-white dark:ring-gray-950" />
              )}
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg"
                style={{ background: accent.gradient }}
              >
                <TrendingUp size={12} color="white" />
              </div>
              {/* Alert badge */}
              {hasAlerts && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[7px] font-bold leading-none ring-2 ring-white dark:ring-gray-950">
                  {data.alerts > 9 ? '9+' : data.alerts}
                </span>
              )}
            </div>
            {/* Bottom activity bar */}
            {(hasAlerts || hasPending) && (
              <div className="h-0.5" style={{ background: hasAlerts ? accentColor : "#a78bfa" }} />
            )}
          </div>
        </div>
      );
    }

    // ── STAFF collapsed: Task-focused, orange dot for active shipments ──
    if (role === "STAFF") {
      return (
        <div className="px-2 pt-1.5 pb-1.5">
          <div
            className="rounded-xl border overflow-hidden transition-all duration-200 hover:scale-[1.03] group cursor-default"
            style={{
              borderColor: hasAlerts ? `${accentColor}40` : "var(--border-color)",
              background: "var(--bg-card)",
              boxShadow: hasAlerts ? `0 0 8px ${accentColor}15` : undefined,
            }}
            title={`${data.activeShipments} đang giao · ${data.alerts} cảnh báo · ${data.warehouses} kho`}
          >
            <div className="flex items-center justify-center p-2 relative">
              {/* Active shipments indicator */}
              {hasActive && (
                <span className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-gray-950 animate-pulse" />
              )}
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg"
                style={{ background: accent.gradient }}
              >
                <ClipboardList size={12} color="white" />
              </div>
              {/* Alert badge */}
              {hasAlerts && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[7px] font-bold leading-none ring-2 ring-white dark:ring-gray-950">
                  {data.alerts > 9 ? '9+' : data.alerts}
                </span>
              )}
            </div>
            {/* Bottom activity bar */}
            {(hasAlerts || hasActive) && (
              <div className="h-0.5" style={{ background: hasAlerts ? accentColor : "#fbbf24" }} />
            )}
          </div>
        </div>
      );
    }

    // ── ADMIN collapsed: Overview-focused, green dot for active shipments ──
    return (
      <div className="px-2 pt-1.5 pb-1.5">
        <div
          className="rounded-xl border overflow-hidden transition-all duration-200 hover:scale-[1.03] group cursor-default"
          style={{
            borderColor: hasAlerts ? `${accentColor}40` : "var(--border-color)",
            background: "var(--bg-card)",
            boxShadow: hasAlerts ? `0 0 8px ${accentColor}15` : undefined,
          }}
          title={`${data.activeShipments} đang giao · ${data.alerts} cảnh báo · ${data.warehouses} kho`}
        >
          <div className="flex items-center justify-center p-2 relative">
            {/* Active shipments indicator */}
            {hasActive && (
              <span className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-950 animate-pulse" />
            )}
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg"
              style={{ background: accent.gradient }}
            >
              <BarChart3 size={12} color="white" />
            </div>
            {/* Alert badge */}
            {hasAlerts && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[7px] font-bold leading-none ring-2 ring-white dark:ring-gray-950">
                {data.alerts > 9 ? '9+' : data.alerts}
              </span>
            )}
          </div>
          {/* Bottom activity bar */}
          {(hasAlerts || hasActive) && (
            <div className="h-0.5" style={{ background: hasAlerts ? accentColor : "#10b981" }} />
          )}
        </div>
      </div>
    );
  }

  if (role === "MANAGER") {
    const managerStats = [
      { label: "Đang giao", value: data.activeShipments, icon: Truck },
      { label: "Cảnh báo", value: data.alerts, icon: AlertTriangle },
      { label: "Kho hàng", value: data.warehouses, icon: Warehouse },
    ];

    return (
      <div className="px-3 pt-2 pb-2">
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
          {/* Header */}
          <div className="px-3 py-2 flex items-center gap-2" style={{ background: accent.bg }}>
            <BarChart3 size={12} style={{ color: accent.primary }} />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent.primary }}>
              Tổng quan quản lý
            </span>
          </div>
          {/* Stats list */}
          <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
            {managerStats.map((s) => (
              <div key={s.label} className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <s.icon size={12} style={{ color: accent.primary }} />
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    {s.label}
                  </span>
                </div>
                <span className="text-xs font-extrabold" style={{ color: accent.primary }}>{s.value}</span>
              </div>
            ))}
          </div>
          {/* Pending tasks */}
          {data.pendingTasks > 0 && (
            <div className="px-3 py-1.5 border-t flex items-center gap-1.5" style={{ borderColor: "var(--border-color)", background: accent.bg }}>
              <ClipboardList size={10} style={{ color: accent.primary }} />
              <span className="text-[9px] font-semibold" style={{ color: accent.primary }}>
                {data.pendingTasks} việc chờ xử lý
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Đang giao", value: data.activeShipments, icon: Truck, color: accent.primary },
    { label: "Cảnh báo", value: data.alerts, icon: AlertTriangle, color: "#ef4444" },
    { label: "Kho", value: data.warehouses, icon: Warehouse, color: "#6366f1" },
  ];

  return (
    <div className="px-3 pt-2 pb-2">
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
        {/* Header */}
        <div className="px-3 py-2 flex items-center gap-2" style={{ background: accent.bg }}>
          <Activity size={12} style={{ color: accent.primary }} />
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent.primary }}>
            Tổng quan nhanh
          </span>
        </div>
        {/* Stats grid */}
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: "var(--border-color)" }}>
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center py-2 gap-0.5">
              <span className="text-xs font-extrabold" style={{ color: s.color }}>{s.value}</span>
              <span className="text-[8px] font-medium truncate max-w-full px-1" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        {/* Pending tasks */}
        {role === "STAFF" && data.pendingTasks > 0 && (
          <div className="px-3 py-1.5 border-t flex items-center gap-1.5" style={{ borderColor: "var(--border-color)", background: "#fff7ed" }}>
            <ClipboardList size={10} style={{ color: "#ea580c" }} />
            <span className="text-[9px] font-semibold" style={{ color: "#9a3412" }}>
              {data.pendingTasks} việc chờ xử lý
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Driver Active Trip Widget ────────────────────────────────

interface ActiveTrip {
  id: string;
  shipmentCode: string;
  status: string;
  originAddress: string;
  destinationAddress: string;
  checkpoints: { id: string; name: string; isCompleted: boolean; sequence: number }[];
  items: { id: string }[];
}

function DriverActiveTrip({ collapsed }: { collapsed: boolean }) {
  const { user, isDriver } = useAuth();
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);
  const prevTripIdRef = useRef<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathname = usePathname();

  const fetchActiveTrip = useCallback(async () => {
    if (!isDriver || !user?.id) return;
    try {
      const res = await shipmentsApi.getAll({
        limit: "1",
        driverId: user.id,
        status: "LOADING,IN_TRANSIT,DELIVERING",
      });
      const data = (res.data.data || []) as ActiveTrip[];
      setTrip(data.length > 0 ? data[0] : null);
    } catch {
      setTrip(null);
    }
    setLoading(false);
  }, [isDriver, user?.id]);

  useEffect(() => {
    fetchActiveTrip();

    const handleVisibility = () => {
      if (document.hidden) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else {
        fetchActiveTrip();
        if (!pollingRef.current) {
          pollingRef.current = setInterval(fetchActiveTrip, 30_000);
        }
      }
    };

    if (!document.hidden) {
      pollingRef.current = setInterval(fetchActiveTrip, 30_000);
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchActiveTrip]);

  // Detect new trip arrival → trigger slide-down animation
  useEffect(() => {
    if (loading) return;
    const currentId = trip?.id || null;
    if (currentId && currentId !== prevTripIdRef.current) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 650);
      prevTripIdRef.current = currentId;
      return () => clearTimeout(timer);
    }
    prevTripIdRef.current = currentId;
  }, [trip, loading]);

  if (!isDriver || loading) return null;
  if (!trip) {
    if (collapsed) return null;
    return (
      <div className="px-3 pt-2 pb-2 animate-idle-in">
        <div
          className="rounded-xl border border-dashed p-3 flex flex-col items-center gap-1.5 text-center"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-input)" }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#f1f5f9" }}>
            <Clock size={14} style={{ color: "#94a3b8" }} />
          </div>
          <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Đang rảnh</p>
          <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>Chưa có chuyến đi</p>
        </div>
      </div>
    );
  }

  const totalCp = trip.checkpoints?.length || 0;
  const completedCp = trip.checkpoints?.filter((c) => c.isCompleted).length || 0;
  const progressPct = totalCp > 0 ? Math.round((completedCp / totalCp) * 100) : 0;
  const isOnTrip = ["LOADING", "IN_TRANSIT", "DELIVERING"].includes(trip.status);
  const isActive = pathname === `/dashboard/shipments/${trip.id}`;

  return (
    <div className={cn(collapsed ? "px-2 pt-1.5 pb-1.5" : "px-3 pt-2 pb-2", animating && "animate-trip-arrive")}>
      <Link
        href={`/dashboard/shipments/${trip.id}`}
        className={cn(
          "block rounded-xl overflow-hidden transition-all duration-300",            collapsed
            ? `border ${isActive ? "border-2 border-emerald-400 dark:border-emerald-500" : "border-emerald-200/40 dark:border-emerald-900/30"} bg-white/70 dark:bg-emerald-950/20`
            : `border-2 hover:scale-[1.02] ${isActive ? "border-emerald-500" : "border-transparent"}`
        )}
        style={!collapsed ? {
          background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
          boxShadow: "0 2px 8px rgba(16,185,129,0.12)",
        } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-center px-2 py-1.5 gap-2">
          <div className={cn(
            "rounded-lg flex items-center justify-center shrink-0",
            collapsed ? "w-6 h-6" : "w-7 h-7"
          )}
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
            <Truck size={collapsed ? 12 : 14} color="white" />
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold truncate" style={{ color: "#065f46" }}>
                  {trip.shipmentCode}
                </p>
                <p className="text-[8px] flex items-center gap-1" style={{ color: "#047857" }}>
                  <Activity size={8} />
                  {isOnTrip ? "Đang giao" : "Chờ lấy"}
                </p>
              </div>
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(16,185,129,0.15)" }}>
                <Navigation size={12} style={{ color: "#059669" }} />
              </div>
            </>
          )}
        </div>

        {/* Progress - collapsed mode: only bar, no text */}
        {collapsed && totalCp > 0 && (
          <div className="px-2 pb-1.5">
            <div className="progress-bar" style={{ height: "3px" }}>
              <div className="progress-fill" style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg,#10b981,#059669)",
              }} />
            </div>
          </div>
        )}

        {/* Expanded details */}
        {!collapsed && (
          <>
            <div className="px-3 pb-1">
              <div className="flex justify-between text-[9px] mb-1" style={{ color: "#065f46" }}>
                <span>Tiến độ</span>
                <span className="font-semibold">{completedCp}/{totalCp}</span>
              </div>
              <div className="progress-bar" style={{ height: "4px" }}>
                <div className="progress-fill" style={{
                  width: `${progressPct}%`,
                  background: "linear-gradient(90deg,#10b981,#059669)",
                }} />
              </div>
            </div>
            <div className="px-3 pb-2 flex items-center gap-1 text-[8px]" style={{ color: "#047857" }}>
              <MapPin size={8} />
              <span className="truncate">{trip.originAddress} → {trip.destinationAddress}</span>
            </div>
            {trip.checkpoints && trip.checkpoints.length > 0 && (
              <div className="px-3 pb-2 flex gap-1 flex-wrap">
                {trip.checkpoints.slice(0, 5).map((cp) => (
                  <div key={cp.id}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[7px]"
                    style={{
                      background: cp.isCompleted ? "#a7f3d0" : "rgba(255,255,255,0.6)",
                      color: cp.isCompleted ? "#065f46" : "#047857",
                    }}>
                    {cp.isCompleted ? <CheckCircle size={6} /> : <Circle size={6} />}
                    {cp.name.length > 6 ? cp.name.slice(0, 4) + ".." : cp.name}
                  </div>
                ))}
                {trip.checkpoints.length > 5 && (
                  <span className="text-[7px]" style={{ color: "var(--text-muted)" }}>+{trip.checkpoints.length - 5}</span>
                )}
              </div>
            )}
          </>
        )}
      </Link>
    </div>
  );
}

// ─── Sidebar Component ────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const unreadAlertCount = useAppStore((s) => s.unreadAlertCount);
  const { user, logout, isDriver } = useAuth();

  const allItems = getNavItems(user?.role);
  const role = user?.role || "STAFF";
  const accent = ROLE_ACCENT[role] || ROLE_ACCENT.STAFF;
  const isAdmin = role === "ADMIN";
  const isStaff = role === "STAFF";

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-30 flex flex-col transition-all duration-300 ease-in-out",
          "border-r",
          sidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:translate-x-0 lg:w-16"
        )}
        style={{
          background: "var(--bg-sidebar)",
          borderColor: "var(--border-color)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-between h-16 px-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: accent.gradient }}
            >
              <Truck size={16} color="white" />
            </div>
            {sidebarOpen && (
              <span
                className="font-bold text-lg truncate"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}
              >
                LogistiQ
              </span>
            )}
          </Link>
          {/* Collapse btn (desktop) */}
          <button
            onClick={toggleSidebar}
            className="btn-icon hidden lg:flex"
          >
            <ChevronLeft
              size={16}
              style={{
                transform: sidebarOpen ? "rotate(0)" : "rotate(180deg)",
                transition: "transform 0.3s",
                color: "var(--text-secondary)",
              }}
            />
          </button>
        </div>

        {/* ─── Role-specific widgets ─── */}
        {isDriver && <DriverActiveTrip collapsed={!sidebarOpen} />}
        {!isDriver && (isAdmin || isStaff || role === "MANAGER") && (
          <RoleSnapshot collapsed={!sidebarOpen} role={role} />
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {allItems.map((group) => (
            <div key={group.group}>
              {sidebarOpen && (
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-2 px-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {group.group}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn("nav-item", isActive && "active", !sidebarOpen && "justify-center")}
                    >
                      <item.icon size={18} className="flex-shrink-0" />
                      {sidebarOpen && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {sidebarOpen && (item as any).badge === "alerts" && unreadAlertCount > 0 && (
                        <span
                          className="min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                          style={{ background: "#ef4444", color: "white" }}
                        >
                          {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ─── User Profile ─── */}
        <div
          className="border-t p-3 flex-shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: accent.gradient }}
              >
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {user?.name}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {roleLabels[role] || "Nhân viên"}
                </p>
              </div>
              <button onClick={logout} className="btn-icon flex-shrink-0" title="Đăng xuất">
                <LogOut size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-default"
                style={{ background: accent.gradient }}
                title={user?.name}
              >
                {user?.name?.charAt(0) || "U"}
              </div>
              <button onClick={logout} className="btn-icon w-full justify-center" title="Đăng xuất">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
