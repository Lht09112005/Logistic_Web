"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Layers, Package,
  Mail, Phone, Maximize, AlertCircle, Activity
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { warehousesApi } from "@/lib/api";

interface Zone {
  id: string;
  name: string;
  capacity: number;
  description?: string;
}

interface InventoryItem {
  id: string;
  quantity: number;
  product: {
    name: string;
    sku: string;
    category: string;
    unit: string;
  };
  zone?: {
    name: string;
  };
  rack?: string;
  shelf?: string;
}

interface WarehouseDetail {
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
  description?: string;
  createdAt: string;
  manager?: {
    name: string;
    email: string;
    phone?: string;
  };
  zones: Zone[];
  inventory: InventoryItem[];
}

interface Props {
  warehouse: WarehouseDetail;
}

const POLL_INTERVAL = 15_000;

function useRealtimeWarehouseDetail(initial: WarehouseDetail) {
  const fallbackRef = useRef(initial);
  const [warehouse, setWarehouse] = useState<WarehouseDetail>(initial);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [socketConnected, setSocketConnected] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const res = await warehousesApi.getById(initial.id);
      const data = res.data.data ?? fallbackRef.current;
      setWarehouse(data);
      fallbackRef.current = data;
    } catch {
      // keep existing data on failure
    }
    setLastUpdated(new Date());
  }, [initial.id]);

  // Initial fetch + polling
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Socket.io
  useEffect(() => {
    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));
      // Refresh when inventory alert comes (could affect this warehouse)
      socket.on("alert:new", () => fetchAll());
      return socket;
    };
    const cleanup = initSocket();
    return () => {
      cleanup.then((s) => {
        s?.off("alert:new");
        s?.disconnect();
      });
    };
  }, [fetchAll]);

  // Manual refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  return { warehouse, lastUpdated, socketConnected, refresh: handleRefresh, refreshing };
}

export default function WarehouseDetailClient({ warehouse: initial }: Props) {
  const router = useRouter();
  const { warehouse, lastUpdated, socketConnected, refresh, refreshing } = useRealtimeWarehouseDetail(initial);

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
    <div className="space-y-6">
      {/* Header — redesigned for mobile-first */}
      <div className="card overflow-hidden">
        {/* Top row: back button + live status + time */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-1">
          <button onClick={() => router.back()} className="btn btn-ghost btn-sm -ml-1.5" title="Quay lại">
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Quay lại</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              <span className="text-[11px] sm:text-xs font-medium hidden sm:inline" style={{ color: socketConnected ? "var(--color-success)" : "var(--text-muted)" }}>
                {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
              </span>
            </div>
            <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
              {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Title + description */}
        <div className="px-4 sm:px-6 pb-3">
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <h1 className="text-lg sm:text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              {warehouse.name}
            </h1>
            <span className={`badge text-[10px] sm:text-xs ${statusBadgeMap[warehouse.status]}`}>
              {statusLabelMap[warehouse.status]}
            </span>
          </div>
          <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Mã kho: {warehouse.code} • Hoạt động từ {formatDate(warehouse.createdAt, "dd/MM/yyyy")}
          </p>
        </div>

        {/* Action buttons row */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-5" style={{ borderTop: "1px solid var(--border-light)" }}>
          <div className="pt-3 flex gap-2 w-full sm:w-auto">
            <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center">
              <Activity size={14} className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Đang tải..." : "Làm mới"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Info panel */}
        <div className="xl:col-span-2 space-y-6">
          {/* General specs */}
          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Thông tin kho hàng
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {warehouse.description || "Không có mô tả chi tiết."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Địa chỉ</div>
                <div className="text-sm font-semibold flex items-start gap-1.5" style={{ color: "var(--text-primary)" }}>
                  <MapPin size={16} style={{ color: "var(--color-warning)" }} className="mt-0.5 flex-shrink-0" />
                  <span>{warehouse.address}, {warehouse.city}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Diện tích sử dụng</div>
                <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                  <Maximize size={16} style={{ color: "var(--color-info)" }} className="flex-shrink-0" />
                  <span>{warehouse.usedArea} / {warehouse.totalArea} m²</span>
                </div>
              </div>
            </div>
          </div>

          {/* Zones */}
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Phân khu ({warehouse.zones.length})
              </h3>
            </div>
            {warehouse.zones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 animate-fade-in" style={{ color: "var(--text-muted)" }}>
                <Layers size={36} style={{ opacity: 0.2 }} />
                <p className="text-sm mt-2">Kho này chưa được chia phân khu.</p>
              </div>
            ) : (
              <div className="flex overflow-x-auto gap-2 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:snap-none">
                {warehouse.zones.map((zone, i) => (
                  <div key={zone.id} className="card-hover p-2.5 sm:p-4 rounded-xl border transition-all duration-200 hover:shadow-md animate-fade-in snap-start shrink-0 min-w-[175px] sm:min-w-0"
                    style={{
                      borderColor: "var(--border-color)",
                      background: "var(--bg-input)",
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--color-info-bg)" }}>
                        <Layers size={12} style={{ color: "var(--color-info)" }} />
                      </div>
                      <span className="font-bold text-xs sm:text-sm" style={{ color: "var(--text-primary)" }}>
                        {zone.name}
                      </span>
                    </div>
                    {zone.description && (
                      <p className="text-[10px] sm:text-xs mb-2 sm:mb-3 leading-tight" style={{ color: "var(--text-secondary)" }}>{zone.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="font-semibold">Sức chứa:</span>
                      <span style={{ color: "var(--text-primary)" }}>{zone.capacity} kiện</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>          {/* Manager info & Quick links */}
        <div className="space-y-6">
          {/* Manager card */}
          <div className="card p-4 sm:p-6">
            <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-3 sm:mb-4" style={{ color: "var(--text-muted)" }}>
              Trưởng kho
            </h3>
            {warehouse.manager ? (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg" style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
                    {warehouse.manager.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{warehouse.manager.name}</div>
                    <div className="text-[11px] sm:text-xs font-medium" style={{ color: "var(--color-warning)" }}>Trưởng kho</div>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t text-sm" style={{ borderColor: "var(--border-light)", color: "var(--text-secondary)" }}>
                  <a href={`mailto:${warehouse.manager.email}`} className="flex items-center gap-2 py-1.5 -mx-1 px-1 rounded-lg hover:bg-[var(--bg-input)] transition-colors truncate">
                    <Mail size={14} className="flex-shrink-0" /> <span className="truncate">{warehouse.manager.email}</span>
                  </a>
                  {warehouse.manager.phone && (
                    <a href={`tel:${warehouse.manager.phone}`} className="flex items-center gap-2 py-1.5 -mx-1 px-1 rounded-lg hover:bg-[var(--bg-input)] transition-colors">
                      <Phone size={14} className="flex-shrink-0" /> {warehouse.manager.phone}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <AlertCircle size={16} /> Chưa có trưởng kho
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warehouse Inventory items — cards organized by zone */}
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <h3 className="font-bold text-sm sm:text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Package size={16} style={{ color: "var(--color-warning)" }} className="flex-shrink-0" />
            <span className="truncate">Mặt hàng ({warehouse.inventory.length})</span>
          </h3>
        </div>

        {warehouse.inventory.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Kho trống. Chưa có mặt hàng nào được lưu trữ.
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-6">
            {warehouse.zones.length > 0 ? (
              /* Group inventory by zone */
              warehouse.zones.map((zone) => {
                const zoneItems = warehouse.inventory.filter(
                  (item) => item.zone?.name === zone.name
                );
                if (zoneItems.length === 0) return null;
                return (
                  <div key={zone.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Layers size={16} style={{ color: "var(--color-info)" }} />
                      <h4 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {zone.name}
                      </h4>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                        {zoneItems.length} mặt hàng
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {zoneItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border p-4 transition-all hover:shadow-md"
                          style={{
                            borderColor: "var(--border-color)",
                            background: "var(--bg-card)",
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                                {item.product.name}
                              </p>
                              <code className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                {item.product.sku}
                              </code>
                            </div>
                            <span className="badge badge-info text-[10px] shrink-0 ml-2">
                              {item.quantity} {item.product.unit}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                            <MapPin size={11} />
                            {item.rack ? (
                              <span>Kệ {item.rack}{item.shelf ? ` - Ngăn ${item.shelf}` : ""}</span>
                            ) : (
                              <span>Chưa có vị trí</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              /* No zones — flat grid of all items */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {warehouse.inventory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border p-4 transition-all hover:shadow-md"
                    style={{
                      borderColor: "var(--border-color)",
                      background: "var(--bg-card)",
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                          {item.product.name}
                        </p>
                        <code className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {item.product.sku}
                        </code>
                      </div>
                      <span className="badge badge-info text-[10px] shrink-0 ml-2">
                        {item.quantity} {item.product.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <MapPin size={11} />
                      {item.rack ? (
                        <span>Kệ {item.rack}{item.shelf ? ` - Ngăn ${item.shelf}` : ""}</span>
                      ) : (
                        <span>Chưa có vị trí</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Items not assigned to any zone */}
            {warehouse.zones.length > 0 && (() => {
              const unassignedItems = warehouse.inventory.filter(
                (item) => !item.zone?.name
              );
              if (unassignedItems.length === 0) return null;
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} style={{ color: "var(--text-muted)" }} />
                    <h4 className="font-bold text-sm" style={{ color: "var(--text-muted)" }}>
                      Chưa phân khu
                    </h4>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                      {unassignedItems.length} mặt hàng
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {unassignedItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-dashed p-4 transition-all hover:shadow-md"
                        style={{
                          borderColor: "var(--border-color)",
                          background: "var(--bg-card)",
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                              {item.product.name}
                            </p>
                            <code className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {item.product.sku}
                            </code>
                          </div>
                          <span className="badge badge-info text-[10px] shrink-0 ml-2">
                            {item.quantity} {item.product.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          <MapPin size={11} />
                          {item.rack ? (
                            <span>Kệ {item.rack}{item.shelf ? ` - Ngăn ${item.shelf}` : ""}</span>
                          ) : (
                            <span>Chưa có vị trí</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
