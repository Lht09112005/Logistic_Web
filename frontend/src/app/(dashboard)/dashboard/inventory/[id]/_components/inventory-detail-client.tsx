"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Package, ArrowLeft, Save, MapPin, AlertTriangle, CheckCircle, Info, RefreshCw, ShieldBan
} from "lucide-react";
import { updateInventoryAction } from "@/app/actions/inventory";
import { getStockPercent, getCategoryLabel, formatDate } from "@/lib/utils";
import { inventoryApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { offlineDB } from "@/lib/offline-db";
import { CACHE_KEYS } from "@/lib/use-offline-cache";
import { OptimizedImage } from "@/components/ui/optimized-image";

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
  const itemId = initial.id;
  const liveItemRef = useRef(liveItem);
  liveItemRef.current = liveItem;

  const fetchAll = useCallback(async () => {
    try {
      const res = await inventoryApi.getById(itemId);
      const data = res.data.data;
      if (data) {
        setLiveItem(data);
      }
      // Cache for offline use
      offlineDB.cacheAppData(CACHE_KEYS.INVENTORY_DETAIL(itemId), data || liveItemRef.current, "inventory").catch((e) => console.warn('[OfflineCache] inventory detail cache error:', e));
    } catch {
      // Try offline cache
      const cached = await offlineDB.getCachedAppData<typeof liveItem>(CACHE_KEYS.INVENTORY_DETAIL(itemId));
      if (cached) {
        setLiveItem(cached);
      }
    }
    setLastUpdated(new Date());
  }, [itemId]);

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
  const { user, isLoading } = useAuth();
  const { liveItem, lastUpdated, socketConnected, refresh, refreshing } = useRealtimeInventoryDetail(initialItem);

  // ── All hooks MUST be before any early return (Rules of Hooks) ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states (initialized once from initialItem, not overwritten by polling)
  const [quantity, setQuantity] = useState(initialItem.quantity);
  const [rack, setRack] = useState(initialItem.rack || "");
  const [shelf, setShelf] = useState(initialItem.shelf || "");
  const [zoneId, setZoneId] = useState(initialItem.zoneId || "");
  const [notes, setNotes] = useState(initialItem.notes || "");

  // Route guard — only ADMIN & MANAGER
  if (isLoading) return null;
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <ShieldBan size={64} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Truy cập bị từ chối</h2>
        <p className="text-sm max-w-md" style={{ color: "var(--text-secondary)" }}>
          Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.
        </p>
      </div>
    );
  }

  // Use live item for display but keep form state stable
  const item = liveItem;

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
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-2 sm:gap-3">
        <div className="flex items-start sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <button type="button" onClick={() => router.back()} className="btn btn-secondary p-2 rounded-xl flex-shrink-0" title="Quay lại">
            <ArrowLeft size={14} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold truncate max-w-full" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
                Chi tiết tồn kho
              </h1>
              <div className={`flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${socketConnected ? "bg-success text-success" : ""}`} style={{ background: socketConnected ? undefined : "var(--bg-input)", color: socketConnected ? undefined : "var(--text-muted)" }}>
                <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "animate-pulse" : ""}`} style={{ background: socketConnected ? "var(--color-success)" : "var(--text-muted)" }} />
                <span className="hidden sm:inline">{socketConnected ? "Trực tiếp" : "Đang kết nối..."}</span>
              </div>
              <span className="text-[10px] hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
            <p className="text-xs sm:text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
              Quản lý vị trí, kiểm toán số lượng và điều chỉnh kệ kho hàng
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm px-2 sm:px-3">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> <span className="hidden sm:inline">{refreshing ? "Đang tải..." : "Làm mới"}</span>
          </button>
          <span className={`badge text-[10px] sm:text-sm py-1 sm:py-1.5 px-2 sm:px-4 ${
            isOut ? "badge-danger" : isLow ? "badge-warning" : "badge-success"
          }`}>
            {isOut ? <><span className="hidden sm:inline">Hết hàng</span><span className="sm:hidden">Hết</span></> : isLow ? <><span className="hidden sm:inline">Sắp hết hàng</span><span className="sm:hidden">Sắp hết</span></> : <><span className="hidden sm:inline">Đủ hàng</span><span className="sm:hidden">Đủ</span></>}
          </span>
        </div>
      </div>

      {error && (
        <div className="card p-4 flex items-center gap-3 animate-slide-left bg-error border-error text-error">
          <AlertTriangle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="card p-4 flex items-center gap-3 animate-slide-left bg-success border-success text-success">
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Info Card & Stock Details (Col 1 & 2) */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Product and Stock Status */}
          <div className="card p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex items-start gap-3 sm:gap-4">
              {item.product.imageUrl ? (
                <OptimizedImage
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  width={64}
                  height={64}
                  rounded="xl"
                  containerClassName="w-10 h-10 sm:w-16 sm:h-16 shrink-0"
                  fallback={
                    <div
                      className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: isOut ? "var(--color-error-bg)" : isLow ? "var(--color-warning-bg)" : "var(--bg-input)" }}
                    >
                      <Package size={22} className="sm:w-8 sm:h-8" style={{ color: isOut ? "var(--color-error)" : isLow ? "var(--color-warning)" : "var(--text-secondary)" }} />
                    </div>
                  }
                />
              ) : (
                <div
                  className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: isOut ? "var(--color-error-bg)" : isLow ? "var(--color-warning-bg)" : "var(--bg-input)" }}
                >
                  <Package size={22} className="sm:w-8 sm:h-8" style={{ color: isOut ? "var(--color-error)" : isLow ? "var(--color-warning)" : "var(--text-secondary)" }} />
                </div>
              )}
              <div className="space-y-1 min-w-0 flex-1">
                <h2 className="text-base sm:text-xl font-bold truncate" style={{ color: "var(--text-primary)" }}>{item.product.name}</h2>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="font-semibold px-1.5 sm:px-2 py-0.5 rounded" style={{ background: "var(--bg-input)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "middle", maxWidth: "100%" }}>SKU: {item.product.sku}</span>
                  <span className="font-semibold px-1.5 sm:px-2 py-0.5 rounded" style={{ background: "var(--bg-input)" }}>Phân loại: {getCategoryLabel(item.product.category)}</span>
                  <span className="font-semibold px-1.5 sm:px-2 py-0.5 rounded" style={{ background: "var(--bg-input)" }}>Đơn vị: {item.product.unit}</span>
                </div>
              </div>
            </div>

            {/* Stock Meter */}
            <div className="p-3 sm:p-4 rounded-xl space-y-2 sm:space-y-3" style={{ background: "var(--bg-input)" }}>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Trạng thái số lượng</span>
                <span className="font-extrabold" style={{ color: isOut ? "var(--color-error)" : isLow ? "var(--color-warning)" : "var(--color-success)" }}>
                  {item.quantity} / {item.product.minStockLevel * 2} {item.product.unit}
                </span>
              </div>
              
              <div className="progress-bar" style={{ height: "8px" }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: isOut ? "var(--color-error)" : isLow ? "var(--color-warning)" : "var(--color-success)",
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-1 text-[10px] sm:text-xs" style={{ color: "var(--text-muted)" }}>
                <span>Ngưỡng tối thiểu: {item.product.minStockLevel} {item.product.unit}</span>
                <span>Hàng đặt trước: {item.reservedQty} {item.product.unit}</span>
              </div>
            </div>

            {/* Storage Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
              <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                <MapPin size={16} className="sm:w-[18px] sm:h-[18px]" style={{ color: "var(--color-warning)" }} />
                <div className="min-w-0">
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Kho hàng</div>
                  <div className="text-xs sm:text-sm font-semibold truncate">{item.warehouse.name} ({item.warehouse.code})</div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                <Info size={16} className="sm:w-[18px] sm:h-[18px]" style={{ color: "var(--color-info)" }} />
                <div className="min-w-0">
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Kiểm kê cuối</div>
                  <div className="text-xs sm:text-sm font-semibold truncate">
                    {item.lastAuditAt ? formatDate(item.lastAuditAt, "dd/MM/yyyy HH:mm") : "Chưa kiểm kê"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Audit History details */}
          <div className="card p-4 sm:p-6 space-y-3 sm:space-y-4">
            <h3 className="text-sm sm:text-md font-semibold" style={{ color: "var(--text-primary)" }}>Lịch sử & Phụ trách</h3>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
              <div className="flex justify-between py-1 border-b gap-2" style={{ borderColor: "var(--border-light)" }}>
                <span>Người kiểm kho:</span>
                <span className="font-semibold text-right" style={{ color: "var(--text-primary)" }}>{item.auditedBy?.name || "Hệ thống"}</span>
              </div>
              <div className="flex justify-between py-1 border-b gap-2" style={{ borderColor: "var(--border-light)" }}>
                <span>Ngày tạo:</span>
                <span className="text-right">{item.lastAuditAt ? formatDate(item.lastAuditAt, "dd/MM/yyyy") : "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b gap-2" style={{ borderColor: "var(--border-light)" }}>
                <span>Vị trí:</span>
                <span className="font-semibold text-right" style={{ color: "var(--text-primary)" }}>
                  {item.zone?.name || "Chưa phân khu"} {item.rack ? `/ Kệ ${item.rack}` : ""} {item.shelf ? `- Ngăn ${item.shelf}` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form Sidebar (Col 3) */}
        <div>
          <form onSubmit={handleUpdate} className="card p-4 sm:p-6 space-y-4 sm:space-y-5">
            <h3 className="text-base sm:text-lg font-bold border-b pb-2 sm:pb-3" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
              Hiệu chỉnh vị trí & SL
            </h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="detail-inventory-quantity" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Số lượng thực tế *</label>
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
                <label htmlFor="detail-inventory-zone" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Phân khu (Zone)</label>
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
                <label htmlFor="detail-inventory-rack" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Kệ hàng (Rack)</label>
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
                <label htmlFor="detail-inventory-shelf" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Ngăn kệ (Shelf)</label>
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
                <label htmlFor="detail-inventory-notes" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Ghi chú điều chỉnh</label>
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
