"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Warehouse, Plus, Search, MapPin, Layers, RefreshCw, Package, QrCode, Truck, ArrowUpRight, User, Eye, AlertTriangle, Filter } from "lucide-react";
import { getStockPercent, formatDate, getCategoryLabel } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useSharedDataStore } from "@/store/shared-data-store";
import { inventoryApi } from "@/lib/api";

interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  province: string;
  totalArea: number;
  usedArea: number;
  capacity: number;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  manager?: {
    name: string;
    email: string;
  };
  _count?: {
    inventory: number;
    zones: number;
  };
}

interface Props {
  warehouses: unknown[];
}

function useRealtimeWarehouses(initial: unknown[]) {
  // Granular selector for warehouses only
  const sharedWarehouses = useSharedDataStore((s) => s.warehouses);
  const [items, setItems] = useState<unknown[]>(initial);
  const [lastUpdated] = useState<Date>(new Date());
  const [socketConnected, setSocketConnected] = useState(false);

  // Sync shared store data to local state when it updates
  useEffect(() => {
    if (sharedWarehouses.length > 0) {
      setItems(sharedWarehouses);
    }
  }, [sharedWarehouses]);

  // Socket.io
  useEffect(() => {
    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));
      socket.on("alert:new", () => useSharedDataStore.getState().refresh());
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

  // Manual refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await useSharedDataStore.getState().refresh();
    setRefreshing(false);
  }, []);

  return { items, lastUpdated, socketConnected, refresh: handleRefresh, refreshing };
}

export default function WarehouseClient({ warehouses: initial }: Props) {
  const { items, lastUpdated, socketConnected, refresh, refreshing } = useRealtimeWarehouses(initial);
  const { isAdmin, isManager, isStaffOnly, user, assignedWarehouses } = useAuth();

  // STAFF: show inventory items inside their assigned warehouse, not warehouse cards
  if (isStaffOnly) {
    return <StaffWarehouseInventory assignedWarehouses={assignedWarehouses} />;
  }
  const [search, setSearch] = useState("");
  const list = items as WarehouseItem[];

  const filtered = list.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.code.toLowerCase().includes(search.toLowerCase()) ||
      w.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header — redesigned for mobile-first */}
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
          <h1 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Kho hàng
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {!isAdmin ? "Tổng quan kho hàng được phân công" : "Quản lý mạng lưới kho phân phối toàn quốc"}
          </p>
        </div>

        {/* Action buttons row */}
        <div className="px-5 sm:px-6 pb-4 sm:pb-5" style={{ borderTop: "1px solid var(--border-light)" }}>
          <div className="pt-3 flex gap-2 w-full sm:w-auto">
            <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center">               <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Đang tải..." : "Làm mới"}</span>
            </button>
            {isAdmin || isManager ? (
              <Link href="/dashboard/warehouse/new" className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center whitespace-nowrap">
                <Plus size={14} /> Thêm kho mới
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {!isAdmin ? (
        <WarehouseOverview
          warehouses={list}
          managedIds={assignedWarehouses.map((mw) => mw.id)}
          assignedWarehouses={assignedWarehouses}
          role={user?.role || 'STAFF'}
        />
      ) : (
        <>
          {/* Filter bar */}
          <div className="card p-4 flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên kho, mã kho, thành phố..."
                className="input-base pl-9 py-2 text-sm"
                style={{ height: "38px" }}
              />
            </div>
          </div>

          {/* Grid */}
          <div className="flex overflow-x-auto gap-3 snap-x snap-mandatory no-scrollbar md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-6 md:overflow-visible md:snap-none">
            {filtered.map((w, i) => {
              const occupancyPct = getStockPercent(w.usedArea || 0, w.totalArea / 2);
              const statusBadgeMap = {
                ACTIVE: "badge-success",
                INACTIVE: "badge-danger",
                MAINTENANCE: "badge-warning",
              };
              const statusLabelMap = {
                ACTIVE: "Đang hoạt động",
                INACTIVE: "Dừng hoạt động",
                MAINTENANCE: "Bảo trì",
              };

              return (
                <div
                  key={w.id}
                  className="card card-hover p-4 lg:p-6 flex flex-col justify-between animate-fade-in group transition-all duration-200 snap-start shrink-0 min-w-[260px] md:min-w-0"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="space-y-3 lg:space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                        style={{ background: "var(--color-info-bg)" }}
                      >
                        <Warehouse size={18} style={{ color: "var(--color-info)" }} />
                      </div>
                      <span className={`badge shrink-0 ${statusBadgeMap[w.status]}`}>
                        {statusLabelMap[w.status]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm lg:text-lg truncate group-hover:text-[var(--color-primary)] transition-colors" style={{ color: "var(--text-primary)" }}>
                        <Link href={`/dashboard/warehouse/${w.id}`}>{w.name}</Link>
                      </h3>
                      <code className="text-xs" style={{ color: "var(--text-muted)" }}>{w.code}</code>
                      <p className="text-xs lg:text-sm mt-1.5 flex items-center gap-1.5 truncate" style={{ color: "var(--text-secondary)" }}>
                        <MapPin size={12} className="flex-shrink-0" />
                        {w.address}, {w.city}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] lg:text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                        <span>Công suất chứa</span>
                        <span>{w.usedArea || 0} / {w.totalArea} m\u00b2</span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill transition-all duration-700"
                          style={{
                            width: `${occupancyPct}%`,
                            background: occupancyPct > 85 ? "var(--color-error)" : "linear-gradient(90deg,var(--color-info),var(--color-info))",
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1.5 text-center border-t" style={{ borderColor: "var(--border-light)" }}>
                      <div className="space-y-0.5 transition-transform group-hover:scale-105">
                        <div className="text-[10px] lg:text-xs" style={{ color: "var(--text-muted)" }}>Phân khu</div>
                        <div className="font-bold text-xs lg:text-sm flex items-center justify-center gap-1" style={{ color: "var(--text-primary)" }}>
                          <Layers size={11} style={{ color: "var(--color-info)" }} />
                          {w._count?.zones || 0}
                        </div>
                      </div>
                      <div className="space-y-0.5 transition-transform group-hover:scale-105">
                        <div className="text-[10px] lg:text-xs" style={{ color: "var(--text-muted)" }}>Mặt hàng</div>
                        <div className="font-bold text-xs lg:text-sm flex items-center justify-center gap-1" style={{ color: "var(--text-primary)" }}>
                          <Package size={11} style={{ color: "var(--color-success)" }} />
                          {w._count?.inventory || 0}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[10px] lg:text-xs" style={{ color: "var(--text-muted)" }}>Trưởng kho</div>
                        <div className="font-semibold text-[11px] lg:text-xs truncate max-w-full" style={{ color: "var(--text-primary)" }}>
                          {w.manager?.name || "\u2014"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/warehouse/${w.id}`}
                    className="btn btn-secondary btn-xs lg:btn-sm w-full mt-3 lg:mt-5 justify-center transition-all group-hover:!bg-[var(--color-warning)] group-hover:text-white group-hover:border-transparent"
                  >
                    Chi tiết kho
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function WarehouseOverview({
  warehouses,
  managedIds,
  assignedWarehouses,
  role,
}: {
  warehouses: WarehouseItem[];
  managedIds: string[];
  assignedWarehouses: { id: string; name: string; code: string; address: string; city: string; province: string }[];
  role: string;
}) {
  const [search, setSearch] = useState("");
  const isManager = role === 'MANAGER';
  const gradient = isManager
    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
    : 'linear-gradient(135deg, #f97316, #ea580c)';

  // Use API data directly (backend already filters by role).
  // Only filter by managedIds if the API returned more warehouses than expected.
  // Fallback: if no matching warehouses from API, use auth context data.
  let myWarehouses = warehouses.filter((w) => managedIds.includes(w.id));
  
  // If the API returned warehouses but the IDs don't match auth context,
  // use the API data directly (backend guarantees correct filtering)
  if (myWarehouses.length === 0 && warehouses.length > 0) {
    myWarehouses = warehouses;
  }
  
  // If still empty, use auth context data as fallback
  if (myWarehouses.length === 0 && assignedWarehouses.length > 0) {
    myWarehouses = assignedWarehouses.map((aw) => ({
      id: aw.id,
      name: aw.name,
      code: aw.code,
      address: aw.address,
      city: aw.city,
      province: aw.province,
      totalArea: 0,
      usedArea: 0,
      capacity: 0,
      status: 'ACTIVE' as const,
    }));
  }

  // If exactly one warehouse, show focused overview
  if (myWarehouses.length === 1) {
    const w = myWarehouses[0];
    const occupancyPct = Math.min(Math.round(((w.usedArea || 0) / (w.totalArea || 1)) * 100), 100);

    const statusBadgeMap: Record<string, string> = {
      ACTIVE: "badge-success",
      INACTIVE: "badge-danger",
      MAINTENANCE: "badge-warning",
    };
    const statusLabelMap: Record<string, string> = {
      ACTIVE: "Đang hoạt động",
      INACTIVE: "Dừng hoạt động",
      MAINTENANCE: "Bảo trì",
    };

    const metrics = [
      {
        label: "Sức chứa",
        value: `${occupancyPct}%`,
        sub: `${w.usedArea || 0} / ${w.totalArea || 0} m²`,
        color: occupancyPct > 85 ? "var(--color-error)" : occupancyPct > 60 ? "var(--color-warning)" : "var(--color-success)",
        bg: occupancyPct > 85 ? "var(--color-error-bg)" : occupancyPct > 60 ? "var(--color-warning-bg)" : "var(--color-success-bg)",
        icon: Warehouse,
      },
      {
        label: "Phân khu",
        value: String(w._count?.zones || 0),
        sub: "khu vực lưu trữ",
        color: "var(--color-info)",
        bg: "var(--color-info-bg)",
        icon: Layers,
      },
      {
        label: "Mặt hàng",
        value: String(w._count?.inventory || 0),
        sub: "mục tồn kho",
        color: "var(--color-success)",
        bg: "var(--color-success-bg)",
        icon: Package,
      },
    ];

    // Unified quick actions — role-aware content
    const quickActions = isManager
      ? [
          {
            label: "Quản lý tồn kho",
            desc: "Xem, thêm, sửa hàng hóa trong kho",
            href: `/dashboard/inventory?warehouseId=${w.id}`,
            icon: Package,
            color: "var(--color-warning)",
            bg: "var(--color-warning-bg)",
          },
          {
            label: "Vận đơn đi",
            desc: "Lên lịch và theo dõi xuất hàng",
            href: `/dashboard/shipments/new?origin=${w.id}`,
            icon: Truck,
            color: "var(--color-info)",
            bg: "var(--color-info-bg)",
          },
          {
            label: "Quét QR",
            desc: "Kiểm kê hàng hóa bằng QR",
            href: "/dashboard/qr-scan",
            icon: QrCode,
            color: "var(--color-info)",
            bg: "var(--color-info-bg)",
          },
          {
            label: "Chi tiết kho",
            desc: "Phân khu, nhân sự, thông số",
            href: `/dashboard/warehouse/${w.id}`,
            icon: Warehouse,
            color: "var(--color-info)",
            bg: "var(--color-info-bg)",
          },
        ]
      : [
          {
            label: "Xem tồn kho",
            desc: "Kiểm tra hàng hóa trong kho",
            href: `/dashboard/inventory?warehouseId=${w.id}`,
            icon: Package,
            color: "var(--color-warning)",
            bg: "var(--color-warning-bg)",
          },
          {
            label: "Chi tiết kho",
            desc: "Phân khu, thông số vận hành",
            href: `/dashboard/warehouse/${w.id}`,
            icon: Warehouse,
            color: "var(--color-info)",
            bg: "var(--color-info-bg)",
          },
          {
            label: "Kiểm kho QR",
            desc: "Quét mã hàng hóa",
            href: "/dashboard/qr-scan",
            icon: QrCode,
            color: "var(--color-info)",
            bg: "var(--color-info-bg)",
          },
          {
            label: "Vận đơn",
            desc: "Xem danh sách vận chuyển",
            href: "/dashboard/shipments",
            icon: Truck,
            color: "var(--color-info)",
            bg: "var(--color-info-bg)",
          },
        ];

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Hero card */}
        <div className="card overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: gradient }}
              >
                <Warehouse size={30} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {w.name}
                  </h2>
                  <span className={`badge ${statusBadgeMap[w.status]}`}>
                    {statusLabelMap[w.status]}
                  </span>
                </div>
                <code className="text-xs mt-1 inline-block" style={{ color: "var(--text-muted)" }}>
                  {w.code}
                </code>
                <p className="text-sm mt-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                  <MapPin size={14} style={{ color: "var(--color-warning)" }} className="flex-shrink-0" />
                  {w.address}, {w.city}
                </p>
              </div>
              {w.manager?.name && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg flex-shrink-0" style={{ background: "var(--bg-input)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: gradient }}>
                    {w.manager.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Trưởng kho</div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{w.manager.name}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>        {/* Quick stats row */}
      <div className="flex overflow-x-auto gap-2 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:snap-none">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className="card p-4 sm:p-5 flex items-center gap-3 snap-start shrink-0 min-w-[150px] sm:min-w-0 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: m.bg }}
              >
                <m.icon size={18} style={{ color: m.color }} />
              </div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl font-bold" style={{ color: m.color }}>{m.value}</div>
                <div className="text-[10px] sm:text-xs font-medium" style={{ color: "var(--text-muted)" }}>{m.label}</div>
                <div className="text-[9px] sm:text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{m.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Thao tác nhanh</p>          <div className="flex overflow-x-auto gap-2 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:snap-none">
          {quickActions.map((action, i) => (
            <Link
              key={action.label}
              href={action.href}
              className="card card-hover p-3 sm:p-5 group snap-start shrink-0 min-w-[170px] sm:min-w-0 animate-fade-in transition-all duration-200 hover:-translate-y-0.5"
              style={{ animationDelay: `${(i + 3) * 80}ms` }}
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div
                  className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: action.bg }}
                >
                  <action.icon size={16} style={{ color: action.color }} />
                </div>
                <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: "var(--text-muted)" }} />
              </div>                  <div className="font-semibold text-xs sm:text-sm" style={{ color: "var(--text-primary)" }}>{action.label}</div>
                  <div className="text-[10px] sm:text-xs mt-0.5 leading-tight" style={{ color: "var(--text-muted)" }}>{action.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // If multiple warehouses, show compact grid
  if (myWarehouses.length > 1) {
    const filtered = myWarehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.code.toLowerCase().includes(search.toLowerCase()) ||
        w.city.toLowerCase().includes(search.toLowerCase())
    );

    const statusBadgeMap: Record<string, string> = {
      ACTIVE: "badge-success",
      INACTIVE: "badge-danger",
      MAINTENANCE: "badge-warning",
    };
    const statusLabelMap: Record<string, string> = {
      ACTIVE: "Đang hoạt động",
      INACTIVE: "Dừng hoạt động",
      MAINTENANCE: "Bảo trì",
    };

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card p-3 flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kho..."
              className="input-base pl-9 py-1.5 text-sm"
              style={{ height: "36px" }}
            />
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{filtered.length} kho</span>
        </div>

        <div className="flex overflow-x-auto gap-3 snap-x snap-mandatory no-scrollbar md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-4 md:overflow-visible md:snap-none">
          {filtered.map((w, i) => {
            const occupancyPct = getStockPercent(w.usedArea || 0, w.totalArea / 2);
            return (
              <div
                key={w.id}
                className="card card-hover p-3 lg:p-5 flex flex-col justify-between animate-fade-in group transition-all duration-200 snap-start shrink-0 min-w-[250px] md:min-w-0"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="space-y-2 lg:space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "var(--color-info-bg)" }}
                      >
                        <Warehouse size={14} style={{ color: "var(--color-info)" }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs lg:text-sm truncate group-hover:text-[var(--color-warning)] transition-colors" style={{ color: "var(--text-primary)" }}>
                          <Link href={`/dashboard/warehouse/${w.id}`}>{w.name}</Link>
                        </h3>
                        <code className="text-[10px]" style={{ color: "var(--text-muted)" }}>{w.code}</code>
                      </div>
                    </div>
                    <span className={`badge text-[10px] shrink-0 ${statusBadgeMap[w.status]}`}>
                      {statusLabelMap[w.status]}
                    </span>
                  </div>
                  <p className="text-[11px] flex items-center gap-1 truncate" style={{ color: "var(--text-secondary)" }}>
                    <MapPin size={10} style={{ color: "var(--color-warning)" }} className="shrink-0" />
                    {w.city}
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                      <span>Công suất</span>
                      <span>{w.usedArea || 0} / {w.totalArea} m²</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${occupancyPct}%`, background: occupancyPct > 85 ? "var(--color-error)" : "linear-gradient(90deg,var(--color-success),var(--color-success))" }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] gap-1">
                    <span style={{ color: "var(--text-muted)" }}><Layers size={10} className="inline mr-0.5" style={{ color: "var(--color-info)" }} />{w._count?.zones || 0}</span>
                    <span style={{ color: "var(--text-muted)" }}><Package size={10} className="inline mr-0.5" style={{ color: "var(--color-success)" }} />{w._count?.inventory || 0}</span>
                    <span style={{ color: "var(--text-muted)" }}><User size={10} className="inline mr-0.5" style={{ color: "var(--color-warning)" }} />{w.manager?.name?.split(" ").pop() || "—"}</span>
                  </div>
                </div>
                <Link href={`/dashboard/warehouse/${w.id}`} className="btn btn-secondary btn-xs w-full mt-2 lg:mt-3 justify-center">Chi tiết kho</Link>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // No warehouse assigned
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
      <Warehouse size={56} style={{ opacity: 0.2, color: "var(--text-muted)" }} />
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Chưa được phân công kho</p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Vui lòng liên hệ Admin để được gán quyền quản lý kho</p>
      </div>
    </div>
  );
}

// ─── STAFF: Show inventory items inside their assigned warehouse ───
interface InventoryItem {
  id: string; quantity: number; reservedQty: number;
  rack?: string; shelf?: string; lastAuditAt?: string;
  product: { id: string; name: string; sku: string; category: string; unit: string; minStockLevel: number };
  warehouse: { id: string; name: string; code: string; city: string };
  zone?: { name: string };
}

function StaffWarehouseInventory({ assignedWarehouses }: { assignedWarehouses: { id: string; name: string; code: string; address: string; city: string; province: string }[] }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const wh = assignedWarehouses.length > 0 ? assignedWarehouses[0] : null;

  const fetchInventory = useCallback(async () => {
    try {
      const res = await inventoryApi.getAll({ limit: "100" });
      const data = (res.data.data || []) as InventoryItem[];
      setItems(data);
    } catch {}
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInventory();
    const interval = setInterval(fetchInventory, 15_000);
    return () => clearInterval(interval);
  }, [fetchInventory]);

  useEffect(() => {
    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));
      socket.on("alert:new", () => fetchInventory());
      return socket;
    };
    const cleanup = initSocket();
    return () => { cleanup.then((s) => { s?.off("alert:new"); s?.disconnect(); }); };
  }, [fetchInventory]);

  const filtered = items.filter((item) => {
    const matchSearch = !search ||
      item.product.name.toLowerCase().includes(search.toLowerCase()) ||
      item.product.sku.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ||
      (filter === "low" && item.quantity < item.product.minStockLevel && item.quantity > 0) ||
      (filter === "out" && item.quantity === 0);
    return matchSearch && matchFilter;
  });

  const lowCount = items.filter((i) => i.quantity < i.product.minStockLevel && i.quantity > 0).length;
  const outCount = items.filter((i) => i.quantity === 0).length;

  if (!wh) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
        <Warehouse size={56} style={{ opacity: 0.2, color: "var(--text-muted)" }} />
        <div className="text-center">
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Chưa được phân công kho</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Vui lòng liên hệ Admin để được gán quyền quản lý kho</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card overflow-hidden">
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
        <div className="px-5 sm:px-6 pb-3">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            {wh.name}
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {wh.address}, {wh.city} · {items.length} mặt hàng trong kho
          </p>
        </div>
        <div className="px-5 sm:px-6 pb-4 sm:pb-5" style={{ borderTop: "1px solid var(--border-light)" }}>
          <div className="pt-3 flex gap-2 w-full sm:w-auto">
            <button onClick={fetchInventory} disabled={loading} className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center">               <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>{loading ? "Đang tải..." : "Làm mới"}</span>
            </button>
            <Link href={`/dashboard/warehouse/${wh.id}`} className="btn btn-secondary btn-sm flex-1 sm:flex-none justify-center">
              <Warehouse size={14} /> Chi tiết kho
            </Link>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm sản phẩm, SKU..."
            className="input-base pl-9 py-2 text-sm"
            style={{ height: "38px" }}
          />
        </div>
        <div className="flex gap-1">
          {[
            { v: "all" as const, label: "Tất cả" },
            { v: "low" as const, label: `Sắp hết (${lowCount})` },
            { v: "out" as const, label: `Hết hàng (${outCount})` },
          ].map((tab) => (
            <button
              key={tab.v}
              onClick={() => setFilter(tab.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === tab.v ? "text-white" : "hover:bg-[var(--bg-input)]"}`}
              style={filter === tab.v ? { background: "linear-gradient(135deg,#f97316,#ea580c)" } : { color: "var(--text-secondary)" }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory cards */}
      {loading && items.length === 0 ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--text-muted)" }}>
          <Package size={48} style={{ opacity: 0.2 }} />
          <p className="text-sm">Không tìm thấy sản phẩm nào</p>
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-3 snap-x snap-mandatory no-scrollbar md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-4 md:overflow-visible md:snap-none">
          {filtered.map((item, i) => {
            const pct = getStockPercent(item.quantity, item.product.minStockLevel);
            const isLow = item.quantity < item.product.minStockLevel;
            const isOut = item.quantity === 0;

            return (
              <div
                key={item.id}
                className={`card card-hover p-5 animate-fade-in snap-start shrink-0 min-w-[280px] md:min-w-0 ${isOut ? "border-error" : isLow ? "border-warning" : ""}`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: isOut ? "var(--color-error-bg)" : isLow ? "var(--color-warning-bg)" : "var(--bg-input)" }}
                    >
                      <Package size={18} style={{ color: isOut ? "var(--color-error)" : isLow ? "var(--color-warning)" : "var(--text-secondary)" }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm line-clamp-1" style={{ color: "var(--text-primary)" }}>{item.product.name}</p>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {item.product.sku} · {getCategoryLabel(item.product.category)}
                      </div>
                    </div>
                  </div>
                  {isOut ? (
                    <span className="badge badge-danger shrink-0">Hết hàng</span>
                  ) : isLow ? (
                    <span className="badge badge-warning shrink-0">Sắp hết</span>
                  ) : (
                    <span className="badge badge-success shrink-0">Còn hàng</span>
                  )}
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    <span>Tồn kho</span>
                    <span className="font-bold" style={{ color: isOut ? "var(--color-error)" : isLow ? "var(--color-warning)" : "var(--text-primary)" }}>
                      {item.quantity} {item.product.unit}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: isOut ? "var(--color-error)" : isLow ? "var(--color-warning)" : "var(--color-success)" }} />
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Tối thiểu: {item.product.minStockLevel} {item.product.unit}
                  </div>
                </div>

                <div className="flex items-center text-xs" style={{ color: "var(--text-muted)" }}>
                  <MapPin size={11} className="mr-1 shrink-0" />
                  {item.zone && <span>{item.zone.name} / </span>}
                  {item.rack ? (
                    <span>Kệ {item.rack}{item.shelf ? `-${item.shelf}` : ""}</span>
                  ) : (
                    <span>Chưa có vị trí</span>
                  )}
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--border-light)" }}>
                  <Link href={`/dashboard/warehouse/${wh.id}`} className="btn btn-ghost btn-sm flex-1 justify-center">
                    <Eye size={13} /> Xem kho
                  </Link>
                  <Link href={`/dashboard/qr-scan?productId=${item.product.id}`} className="btn btn-secondary btn-sm flex-1 justify-center">
                    <QrCode size={13} /> Kiểm kho
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

