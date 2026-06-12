"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { useNotificationStore } from "@/store/notification-store";
import { useSharedDataStore } from "@/store/shared-data-store";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";
import { cn } from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";
import {
  LayoutDashboard, Package, Warehouse, Truck, QrCode,
  Bell, Settings, LogOut, ChevronLeft, Users, BarChart3,
  Navigation, MapPin, CheckCircle, Circle, Activity,
  Clock,  TrendingUp, AlertTriangle, ClipboardList, Sun, Moon,
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
      { href: "/dashboard/inventory", icon: Package, label: "Hàng hóa" },
      { href: "/dashboard/qr-scan", icon: QrCode, label: "Kiểm kho QR" },
      { href: "/dashboard/alerts", icon: Bell, label: "Cảnh báo", badge: "alerts" },
    ],
  },
  {
    group: "Vận chuyển",
    items: [
      { href: "/dashboard/shipments", icon: Truck, label: "Vận đơn", badge: "pending" },
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
      { href: "/dashboard/qr-scan", icon: QrCode, label: "Kiểm kho QR" },
      { href: "/dashboard/alerts", icon: Bell, label: "Cảnh báo", badge: "alerts" },
    ],
  },
  {
    group: "Vận chuyển",
    items: [
      { href: "/dashboard/shipments", icon: Truck, label: "Vận đơn", badge: "pending" },
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
      { href: "/dashboard/qr-scan", icon: QrCode, label: "Kiểm kho" },
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
    group: "Lịch sử",
    items: [
      { href: "/dashboard/shipments?status=DELIVERED", icon: CheckCircle, label: "Hoàn thành" },
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

function RoleSnapshot({ collapsed, role, onNavClick }: { collapsed: boolean; role: string; onNavClick?: () => void }) {
  // Granular selectors to avoid full re-render on every shared store update
  const shipmentStats = useSharedDataStore((s) => s.shipmentStats);
  const alertList = useSharedDataStore((s) => s.alerts);
  const warehouseList = useSharedDataStore((s) => s.warehouses);

  // Compute snapshot from shared store data (eliminates duplicate polling)
  const data: SnapshotData | null = shipmentStats
    ? {
        activeShipments: shipmentStats.inTransit ?? 0,
        alerts: Array.isArray(alertList) ? alertList.length : 0,
        warehouses: Array.isArray(warehouseList) ? warehouseList.length : 0,
        pendingTasks:
          (shipmentStats.pending ?? 0) +
          (shipmentStats.inTransit ?? 0),
      }
    : null;

  if (!data) return null;

  const accent = ROLE_ACCENT[role] || ROLE_ACCENT.STAFF;

  if (collapsed) {
    const ROLE_COLLAPSED: Record<string, { icon: typeof BarChart3; }> = {
      MANAGER: { icon: TrendingUp },
      STAFF: { icon: ClipboardList },
      ADMIN: { icon: BarChart3 },
    };
    const cfg = ROLE_COLLAPSED[role] || ROLE_COLLAPSED.STAFF;
    const Icon = cfg.icon;

    return (
      <div className="px-2 pt-1.5 pb-1.5">
        <Link
          href="/dashboard"
          onClick={onNavClick}
          title={`${data.activeShipments} đang giao · ${data.alerts} cảnh báo · ${data.warehouses} kho`}
          className="group block"
        >
          <div
            className="rounded-xl border overflow-hidden transition-all duration-200 hover:scale-[1.05] group-hover:shadow-lg flex items-center justify-center p-2 relative"
            style={{
              borderColor: "var(--border-color)",
              background: "var(--bg-card)",
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110"
              style={{ background: accent.gradient }}
            >
              <Icon size={16} color="white" />
            </div>
          </div>
        </Link>
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
              Tổng quan
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
          <div className="px-3 py-1.5 border-t flex items-center gap-1.5" style={{ borderColor: "var(--border-color)", background: "var(--color-warning-bg)" }}>
            <ClipboardList size={10} style={{ color: "var(--color-warning)" }} />
            <span className="text-[9px] font-semibold" style={{ color: "var(--color-warning)" }}>
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

function DriverActiveTrip({ collapsed, onNavClick }: { collapsed: boolean; onNavClick?: () => void }) {
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
    // Show upcoming confirmed trip if no active trip
    return (
      <div className="px-3 pt-2 pb-2 animate-idle-in space-y-2">
        <div
          className="rounded-xl border border-dashed p-3 flex flex-col items-center gap-1.5 text-center"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-input)" }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#f1f5f9" }}>
            <Clock size={14} style={{ color: "#94a3b8" }} />
          </div>
          <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Đang rảnh</p>
          <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>Chưa có chuyến đang chạy</p>
          <Link href="/dashboard/shipments?status=CONFIRMED"
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
            style={{ background: "#eef2ff", color: "#6366f1" }}
          >
            Xem chuyến sắp tới
          </Link>
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
        onClick={onNavClick}
        className={cn(
          "block rounded-xl overflow-hidden transition-all duration-300",            collapsed
            ? `border ${isActive ? "border-2 border-emerald-400 dark:border-emerald-500" : "border-emerald-200/40 dark:border-emerald-900/30"} bg-white/70 dark:bg-emerald-950/20`
            : `border-2 hover:scale-[1.02] ${isActive ? "border-emerald-500" : "border-transparent"}`
        )}
        style={!collapsed ? {
          background: "var(--color-success-bg)",
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
            {collapsed ? <MapPin size={12} color="white" /> : <Truck size={14} color="white" />}
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
            <div className="px-3 pb-2">
              <div className="flex justify-between text-[8px] mb-0.5" style={{ color: "#047857" }}>
                <span>Tiến độ</span>
                <span className="font-semibold">{completedCp}/{totalCp}</span>
              </div>
              <div className="progress-bar rounded-full" style={{ height: "2px" }}>
                <div className="progress-fill rounded-full" style={{
                  width: `${progressPct}%`,
                  background: "#10b981",
                }} />
              </div>
            </div>
            <div className="px-3 pb-2 flex items-center gap-1 text-[7px]" style={{ color: "#047857" }}>
              <MapPin size={7} />
              <span className="truncate leading-tight">{trip.originAddress} → {trip.destinationAddress}</span>
            </div>
            {/* ETA */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(trip as any).estimatedArrival && (
              <div className="px-3 pb-1 flex items-center gap-1 text-[7px]" style={{ color: "#047857" }}>
                <Clock size={7} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <span>ETA: <strong>{new Date((trip as any).estimatedArrival).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</strong></span>
              </div>
            )}
            {trip.checkpoints && trip.checkpoints.length > 0 && (
              <div className="px-3 pb-2 flex gap-1 flex-wrap max-h-10 overflow-y-auto driver-cp-scroll">
                {trip.checkpoints.slice(0, 5).map((cp) => (
                  <div key={cp.id}
                    className="flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[7px] leading-none"
                    style={{
                      background: cp.isCompleted ? "#a7f3d0" : "rgba(255,255,255,0.6)",
                      color: cp.isCompleted ? "#065f46" : "#047857",
                    }}>
                    {cp.isCompleted ? <CheckCircle size={6} /> : <Circle size={6} />}
                    {cp.name.length > 6 ? cp.name.slice(0, 4) + ".." : cp.name}
                  </div>
                ))}
                {trip.checkpoints.length > 5 && (
                  <span className="text-[6px]" style={{ color: "var(--text-muted)" }}>+{trip.checkpoints.length - 5}</span>
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
  const searchParams = useSearchParams();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const unreadAlertCount = useAppStore((s) => s.unreadAlertCount);
  const notifUnreadCount = useNotificationStore((s) => s.unreadCount);
  const { user, logout, isDriver } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const currentQueryString = searchParams.toString();

  // Detect mobile for auto-close sidebar on nav click & auto-close on mount
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    // Auto-close sidebar on mobile at initial load (fix: sidebar covers screen on mobile)
    if (mq.matches && sidebarOpen) {
      toggleSidebar();
    }
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const closeSidebar = useCallback(() => {
    if (isMobile) toggleSidebar();
  }, [isMobile, toggleSidebar]);

  const allItems = getNavItems(user?.role);
  const role = user?.role || "STAFF";
  const accent = ROLE_ACCENT[role] || ROLE_ACCENT.STAFF;
  const isAdmin = role === "ADMIN";
  const isStaff = role === "STAFF";
  // Combined unread count: system notifications + inventory alerts
  const totalUnread = unreadAlertCount + notifUnreadCount;

  // Granular selectors to avoid full re-render on every shared store update
  const pendingForCurrentUser = useSharedDataStore((s) => s.shipmentStats?.pendingForCurrentUser ?? 0);

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
          className="flex items-center justify-between h-16 px-4 border-b shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Link href="/dashboard" onClick={closeSidebar} className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
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
        {isDriver && <DriverActiveTrip collapsed={!sidebarOpen} onNavClick={closeSidebar} />}
        {!isDriver && (isAdmin || isStaff || role === "MANAGER") && (
          <RoleSnapshot collapsed={!sidebarOpen} role={role} onNavClick={closeSidebar} />
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
                  const itemPath = item.href.split("?")[0];
                  const itemQuery = item.href.split("?")[1];
                  
                  let isActive = false;
                  if (item.href === "/dashboard") {
                    isActive = pathname === "/dashboard";
                  } else if (itemQuery) {
                    isActive = pathname === itemPath && currentQueryString.includes(itemQuery);
                  } else {
                    isActive = pathname.startsWith(itemPath);
                    if (item.href === "/dashboard/shipments" && currentQueryString.includes("status=DELIVERED")) {
                      isActive = false;
                    }
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeSidebar}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn("nav-item", isActive && "active", !sidebarOpen && "justify-center")}
                    >
                      <item.icon size={18} className="shrink-0" />
                      {sidebarOpen && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {/* Expanded: show combined badge on 'Cảnh báo' */}
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {sidebarOpen && (item as any).badge === "alerts" && totalUnread > 0 && (
                        <span
                          className="min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                          style={{ background: "#ef4444", color: "white" }}
                        >
                          {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                      )}
                      {/* Collapsed: small dot badge on Bell icon */}
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {!sidebarOpen && (item as any).badge === "alerts" && totalUnread > 0 && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center"
                          style={{ background: "#ef4444", color: "white" }}
                        >
                          {totalUnread > 9 ? "9+" : totalUnread}
                        </span>
                      )}
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {sidebarOpen && (item as any).badge === "pending" && pendingForCurrentUser > 0 && (
                        <span
                          className="min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 animate-pulse"
                          style={{ background: "#6366f1", color: "white" }}
                        >
                          {pendingForCurrentUser > 99 ? "99+" : pendingForCurrentUser}
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
          className="border-t p-3 shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <Link href="/admin/settings" onClick={closeSidebar}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 cursor-pointer"
                  style={{ background: accent.gradient }}
                >
                  {user?.name?.charAt(0) || "U"}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {user?.name}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {roleLabels[role] || "Nhân viên"}
                </p>
              </div>
              {/* Theme toggle — cho tài xế ở sidebar, non-driver ở header */}
              {isDriver && (
                <button
                  onClick={toggleTheme}
                  className="btn-icon shrink-0"
                  title={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              )}
              <button onClick={logout} className="btn-icon shrink-0" title="Đăng xuất">
                <LogOut size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Link href="/admin/settings" onClick={closeSidebar}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer"
                  style={{ background: accent.gradient }}
                  title={user?.name}
                >
                  {user?.name?.charAt(0) || "U"}
                </div>
              </Link>
              {/* Theme toggle — collapsed cho tài xế */}
              {isDriver && (
                <button
                  onClick={toggleTheme}
                  className="btn-icon w-full justify-center"
                  title={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
                >
                  {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                </button>
              )}
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
