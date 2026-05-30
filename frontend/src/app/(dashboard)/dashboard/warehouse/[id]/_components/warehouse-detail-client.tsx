"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Warehouse, MapPin, Layers, Package,
  User, Mail, Phone, Maximize, AlertCircle, Activity
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
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              {warehouse.name}
            </h1>
            <span className={`badge ${statusBadgeMap[warehouse.status]}`}>
              {statusLabelMap[warehouse.status]}
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: socketConnected ? "#dcfce7" : "#f1f5f9", color: socketConnected ? "#15803d" : "var(--text-muted)" }}>
              <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Mã kho: {warehouse.code} • Hoạt động từ {formatDate(warehouse.createdAt, "dd/MM/yyyy")}
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
          <Activity size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Đang tải..." : "Làm mới"}
        </button>
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
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Địa chỉ</div>
                <div className="text-sm font-semibold flex items-start gap-1.5" style={{ color: "var(--text-primary)" }}>
                  <MapPin size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                  <span>{warehouse.address}, {warehouse.city}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Diện tích sử dụng</div>
                <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                  <Maximize size={16} className="text-indigo-500 flex-shrink-0" />
                  <span>{warehouse.usedArea} / {warehouse.totalArea} m²</span>
                </div>
              </div>
            </div>
          </div>

          {/* Zones */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Phân khu quản lý ({warehouse.zones.length})
              </h3>
            </div>
            {warehouse.zones.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Kho này chưa được chia phân khu.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {warehouse.zones.map((zone) => (
                  <div key={zone.id} className="p-4 rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-input)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Layers size={16} className="text-indigo-500" />
                      <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        Phân khu {zone.name}
                      </span>
                    </div>
                    {zone.description && (
                      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{zone.description}</p>
                    )}
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Sức chứa: <b>{zone.capacity}</b> kiện
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Manager info & Quick links */}
        <div className="space-y-6">
          {/* Manager card */}
          <div className="card p-6">
            <h3 className="font-bold text-sm uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
              Quản lý kho
            </h3>
            {warehouse.manager ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
                    {warehouse.manager.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{warehouse.manager.name}</div>
                    <div className="text-xs text-orange-500 font-medium">Trưởng kho</div>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t text-sm" style={{ borderColor: "var(--border-light)", color: "var(--text-secondary)" }}>
                  <a href={`mailto:${warehouse.manager.email}`} className="flex items-center gap-2 hover:underline">
                    <Mail size={14} /> {warehouse.manager.email}
                  </a>
                  {warehouse.manager.phone && (
                    <a href={`tel:${warehouse.manager.phone}`} className="flex items-center gap-2 hover:underline">
                      <Phone size={14} /> {warehouse.manager.phone}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <AlertCircle size={16} /> Chưa phân công quản lý
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warehouse Inventory items */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
          <h3 className="font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Package size={18} className="text-orange-500" />
            Mặt hàng lưu trữ ({warehouse.inventory.length})
          </h3>
          <Link href={`/dashboard/inventory?warehouseId=${warehouse.id}`} className="text-sm font-semibold hover:underline" style={{ color: "#f97316" }}>
            Quản lý tồn kho
          </Link>
        </div>

        {warehouse.inventory.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Kho trống. Chưa có mặt hàng nào được lưu trữ.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>SKU</th>
                  <th>Số lượng</th>
                  <th>Phân khu / Vị trí</th>
                </tr>
              </thead>
              <tbody>
                {warehouse.inventory.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium text-sm">{item.product.name}</td>
                    <td><code className="text-xs">{item.product.sku}</code></td>
                    <td>{item.quantity} {item.product.unit}</td>
                    <td>
                      {item.zone?.name ? `Khu ${item.zone.name}` : "—"}
                      {item.rack ? ` / Kệ ${item.rack}-${item.shelf}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
