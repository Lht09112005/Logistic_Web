"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Package, ArrowLeft, Save, MapPin, AlertTriangle, CheckCircle, Info, Activity
} from "lucide-react";
import { updateInventoryAction } from "@/app/actions/inventory";
import { getStockPercent, getCategoryLabel, formatDate } from "@/lib/utils";
import { inventoryApi } from "@/lib/api";

interface Product {
  id: string; name: string; sku: string; category: string; unit: string; minStockLevel: number;
  imageUrl?: string; qrCode?: string;
}
interface Warehouse {
  id: string; name: string; code: string; city: string;
}
interface Zone {
  id: string; name: string; description?: string;
}

interface InventoryItem {
  id: string;
  quantity: number;
  reservedQty: number;
  rack?: string;
  shelf?: string;
  notes?: string;
  lastAuditAt?: string;
  zoneId?: string;
  product: Product;
  warehouse: Warehouse;
  zone?: Zone;
  auditedBy?: { id: string; name: string };
}

interface Props {
  item: InventoryItem;
  zones: Zone[];
}

const POLL_INTERVAL = 15_000;

function useRealtimeInventoryDetail(initial: InventoryItem) {
  const [liveItem, setLiveItem] = useState(initial);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [socketConnected, setSocketConnected] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const res = await inventoryApi.getById(initial.id);
      const data = res.data.data ?? initial;
      setLiveItem(data);
    } catch {
      // keep existing data
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

  return { liveItem, lastUpdated, socketConnected, refresh: handleRefresh, refreshing };
}

export default function InventoryDetailClient({ item: initialItem, zones }: Props) {
  const router = useRouter();
  const { liveItem, lastUpdated, socketConnected, refresh, refreshing } = useRealtimeInventoryDetail(initialItem);
  // Use live item for display but keep form state stable
  const item = liveItem;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states (initialized once from initialItem, not overwritten by polling)
  const [quantity, setQuantity] = useState(initialItem.quantity);
  const [rack, setRack] = useState(initialItem.rack || "");
  const [shelf, setShelf] = useState(initialItem.shelf || "");
  const [zoneId, setZoneId] = useState(initialItem.zoneId || "");
  const [notes, setNotes] = useState(initialItem.notes || "");

  // Derived stock status uses live item for display
  const pct = getStockPercent(item.quantity, item.product.minStockLevel);
  const isLow = item.quantity < item.product.minStockLevel;
  const isOut = item.quantity === 0;

  // Submit edit form
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      quantity,
      rack: rack || undefined,
      shelf: shelf || undefined,
      zoneId: zoneId || undefined,
      notes: notes || undefined
    };

    const res = await updateInventoryAction(item.id, payload);
    setLoading(false);

    if (res.success) {
      setSuccess("Cập nhật thông tin tồn kho thành công!");
      router.refresh();
    } else {
      setError(res.message || "Cập nhật tồn kho thất bại!");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.back()} className="btn btn-secondary p-2.5 rounded-xl flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
                Chi tiết tồn kho
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
              Quản lý vị trí, kiểm toán số lượng và điều chỉnh kệ kho hàng
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
          <span className={`badge text-sm py-1.5 px-4 ${
            isOut ? "badge-danger" : isLow ? "badge-warning" : "badge-success"
          }`}>
            {isOut ? "Hết hàng" : isLow ? "Sắp hết hàng" : "Đủ hàng"}
          </span>
        </div>
      </div>

      {error && (
        <div className="card p-4 flex items-center gap-3 animate-slide-left" style={{ background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c" }}>
          <AlertTriangle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="card p-4 flex items-center gap-3 animate-slide-left" style={{ background: "#dcfce7", borderColor: "#86efac", color: "#15803d" }}>
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card & Stock Details (Col 1 & 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product and Stock Status */}
          <div className="card p-6 space-y-6">
            <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: isOut ? "#fee2e2" : isLow ? "#fff7ed" : "var(--bg-input)" }}
              >
                <Package size={32} style={{ color: isOut ? "#ef4444" : isLow ? "#f97316" : "var(--text-secondary)" }} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{item.product.name}</h2>
                <div className="flex flex-wrap gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="font-semibold px-2 py-0.5 rounded" style={{ background: "var(--bg-input)" }}>SKU: {item.product.sku}</span>
                  <span className="font-semibold px-2 py-0.5 rounded" style={{ background: "var(--bg-input)" }}>Phân loại: {getCategoryLabel(item.product.category)}</span>
                  <span className="font-semibold px-2 py-0.5 rounded" style={{ background: "var(--bg-input)" }}>Đơn vị: {item.product.unit}</span>
                </div>
              </div>
            </div>

            {/* Stock Meter */}
            <div className="p-4 rounded-xl space-y-3" style={{ background: "var(--bg-input)" }}>
              <div className="flex justify-between text-sm">
                <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Trạng thái số lượng</span>
                <span className="font-extrabold" style={{ color: isOut ? "#ef4444" : isLow ? "#f97316" : "#10b981" }}>
                  {item.quantity} / {item.product.minStockLevel * 2} {item.product.unit}
                </span>
              </div>
              
              <div className="progress-bar" style={{ height: "8px" }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: isOut ? "#ef4444" : isLow ? "#f97316" : "linear-gradient(90deg,#10b981,#059669)",
                  }}
                />
              </div>

              <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                <span>Ngưỡng tối thiểu: {item.product.minStockLevel} {item.product.unit}</span>
                <span>Hàng đặt trước (Reserved): {item.reservedQty} {item.product.unit}</span>
              </div>
            </div>

            {/* Storage Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                <MapPin size={18} className="text-orange-500" />
                <div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Kho hàng</div>
                  <div className="text-sm font-semibold">{item.warehouse.name} ({item.warehouse.code})</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                <Info size={18} className="text-indigo-500" />
                <div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Kiểm kê cuối</div>
                  <div className="text-sm font-semibold">
                    {item.lastAuditAt ? formatDate(item.lastAuditAt, "dd/MM/yyyy HH:mm") : "Chưa kiểm kê"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Audit History details */}
          <div className="card p-6 space-y-4">
            <h3 className="text-md font-semibold" style={{ color: "var(--text-primary)" }}>Lịch sử & Phụ trách</h3>
            <div className="space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--border-light)" }}>
                <span>Người kiểm kho gần nhất:</span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{item.auditedBy?.name || "Hệ thống"}</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--border-light)" }}>
                <span>Ngày tạo bản ghi:</span>
                <span>{item.lastAuditAt ? formatDate(item.lastAuditAt, "dd/MM/yyyy") : "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--border-light)" }}>
                <span>Vị trí hiện tại:</span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {item.zone?.name || "Chưa phân khu"} {item.rack ? `/ Kệ ${item.rack}` : ""} {item.shelf ? `- Ngăn ${item.shelf}` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form Sidebar (Col 3) */}
        <div>
          <form onSubmit={handleUpdate} className="card p-6 space-y-5">
            <h3 className="text-lg font-bold border-b pb-3" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
              Hiệu chỉnh vị trí & SL
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Số lượng thực tế *</label>
                <input
                  id="detail-inventory-quantity"
                  name="quantity"
                  type="number"
                  required
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input-base text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Phân khu (Zone)</label>
                <select
                  id="detail-inventory-zone"
                  name="zoneId"
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="">-- Chọn phân khu --</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Kệ hàng (Rack)</label>
                <input
                  id="detail-inventory-rack"
                  name="rack"
                  value={rack}
                  onChange={(e) => setRack(e.target.value)}
                  placeholder="VD: R1"
                  className="input-base text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Ngăn kệ (Shelf)</label>
                <input
                  id="detail-inventory-shelf"
                  name="shelf"
                  value={shelf}
                  onChange={(e) => setShelf(e.target.value)}
                  placeholder="VD: S1"
                  className="input-base text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Ghi chú điều chỉnh</label>
                <textarea
                  id="detail-inventory-notes"
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nhập ghi chú hoặc lý do điều chỉnh kệ/số lượng..."
                  className="input-base text-sm h-24"
                  style={{ resize: "none" }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full justify-center py-2.5 rounded-xl font-semibold"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={15} />
                    Lưu thay đổi
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-secondary w-full justify-center py-2.5 rounded-xl"
              >
                Quay lại
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
