"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Warehouse, Plus, Search, MapPin, Layers, Activity, Package, QrCode, Truck, ArrowUpRight, User } from "lucide-react";
import { getStockPercent } from "@/lib/utils";
import { warehousesApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { useSharedDataStore } from "@/store/shared-data-store";

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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
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
  const { isAdmin, isManager, user } = useAuth();
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              Kho hàng
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: socketConnected ? "var(--color-success-bg)" : "var(--bg-input)", color: socketConnected ? "var(--color-success)" : "var(--text-muted)" }}>
              <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "animate-pulse" : ""}`} style={{ background: socketConnected ? "var(--color-success)" : "var(--text-muted)" }} />
              {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {!isAdmin ? "Tổng quan kho hàng được phân công" : "Quản lý mạng lưới kho phân phối toàn quốc"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
          {isAdmin || isManager ? (
            <Link href="/dashboard/warehouse/new" className="btn btn-primary btn-sm whitespace-nowrap">
              <Plus size={14} /> <span className="hidden sm:inline">Thêm </span>kho mới
            </Link>
          ) : null}
        </div>
      </div>

      {!isAdmin ? (
        <WarehouseOverview
          warehouses={list}
          managedIds={user?.managedWarehouses?.map((mw) => mw.id) || []}
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
                  className="card card-hover p-6 flex flex-col justify-between animate-fade-in group transition-all duration-200 snap-start shrink-0 min-w-[280px] md:min-w-0"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                        style={{ background: "var(--color-info-bg)" }}
                      >
                        <Warehouse size={22} style={{ color: "var(--color-info)" }} />
                      </div>
                      <span className={`badge ${statusBadgeMap[w.status]}`}>
                        {statusLabelMap[w.status]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg group-hover:text-[var(--color-primary)] transition-colors" style={{ color: "var(--text-primary)" }}>
                        <Link href={`/dashboard/warehouse/${w.id}`}>{w.name}</Link>
                      </h3>
                      <code className="text-xs" style={{ color: "var(--text-muted)" }}>{w.code}</code>
                      <p className="text-sm mt-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                        <MapPin size={14} className="flex-shrink-0" />
                        {w.address}, {w.city}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
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
                    <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t" style={{ borderColor: "var(--border-light)" }}>
                      <div className="space-y-0.5 transition-transform group-hover:scale-105">
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>Phân khu</div>
                        <div className="font-bold text-sm flex items-center justify-center gap-1" style={{ color: "var(--text-primary)" }}>
                          <Layers size={13} style={{ color: "var(--color-info)" }} />
                          {w._count?.zones || 0}
                        </div>
                      </div>
                      <div className="space-y-0.5 transition-transform group-hover:scale-105">
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>Mặt hàng</div>
                        <div className="font-bold text-sm flex items-center justify-center gap-1" style={{ color: "var(--text-primary)" }}>
                          <Layers size={13} style={{ color: "var(--color-success)" }} />
                          {w._count?.inventory || 0}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>Trưởng kho</div>
                        <div className="font-semibold text-xs truncate max-w-full" style={{ color: "var(--text-primary)" }}>
                          {w.manager?.name || "\u2014"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/warehouse/${w.id}`}
                    className="btn btn-secondary btn-sm w-full mt-5 transition-all group-hover:!bg-[var(--color-warning)] group-hover:text-white group-hover:border-transparent"
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
  role,
}: {
  warehouses: WarehouseItem[];
  managedIds: string[];
  role: string;
}) {
  const [search, setSearch] = useState("");
  const isManager = role === 'MANAGER';
  const gradient = isManager
    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
    : 'linear-gradient(135deg, #f97316, #ea580c)';

  // Only show warehouses assigned to this user
  const myWarehouses = warehouses.filter((w) => managedIds.includes(w.id));

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
        </div>

        {/* Quick stats row */}
        <div className="flex overflow-x-auto gap-3 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:snap-none">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className="card card-hover p-5 flex items-center gap-4 snap-start shrink-0 min-w-[200px] sm:min-w-0 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: m.bg }}
              >
                <m.icon size={22} style={{ color: m.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</div>
                <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{m.label}</div>
                <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{m.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Thao tác nhanh</p>
        <div className="flex overflow-x-auto gap-3 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:snap-none">
          {quickActions.map((action, i) => (
            <Link
              key={action.label}
              href={action.href}
              className="card card-hover p-5 group snap-start shrink-0 min-w-[220px] sm:min-w-0 animate-fade-in transition-all duration-200 hover:-translate-y-0.5"
              style={{ animationDelay: `${(i + 3) * 80}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: action.bg }}
                >
                  <action.icon size={22} style={{ color: action.color }} />
                </div>
                <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: "var(--text-muted)" }} />
              </div>
              <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{action.label}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{action.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // If multiple warehouses assigned (less common), show compact grid
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
                className="card card-hover p-4 sm:p-5 flex flex-col justify-between animate-fade-in group transition-all duration-200 snap-start shrink-0 min-w-[270px] md:min-w-0"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "var(--color-info-bg)" }}
                      >
                        <Warehouse size={18} style={{ color: "var(--color-info)" }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm truncate group-hover:text-[var(--color-warning)] transition-colors" style={{ color: "var(--text-primary)" }}>
                          <Link href={`/dashboard/warehouse/${w.id}`}>{w.name}</Link>
                        </h3>
                        <code className="text-[11px]" style={{ color: "var(--text-muted)" }}>{w.code}</code>
                      </div>
                    </div>
                    <span className={`badge text-[10px] ${statusBadgeMap[w.status]}`}>
                      {statusLabelMap[w.status]}
                    </span>
                  </div>
                  <p className="text-xs flex items-center gap-1 truncate" style={{ color: "var(--text-secondary)" }}>
                    <MapPin size={12} style={{ color: "var(--color-warning)" }} className="shrink-0" />
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
                  <div className="flex items-center justify-between text-[10px]">
                    <span style={{ color: "var(--text-muted)" }}><Layers size={11} className="inline mr-0.5" style={{ color: "var(--color-info)" }} />{w._count?.zones || 0} khu</span>
                    <span style={{ color: "var(--text-muted)" }}><Package size={11} className="inline mr-0.5" style={{ color: "var(--color-success)" }} />{w._count?.inventory || 0} mặt hàng</span>
                    <span style={{ color: "var(--text-muted)" }}><User size={11} className="inline mr-0.5" style={{ color: "var(--color-warning)" }} />{w.manager?.name?.split(" ").pop() || "—"}</span>
                  </div>
                </div>
                <Link href={`/dashboard/warehouse/${w.id}`} className="btn btn-secondary btn-xs sm:btn-sm w-full mt-3 justify-center">Chi tiết kho</Link>
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

