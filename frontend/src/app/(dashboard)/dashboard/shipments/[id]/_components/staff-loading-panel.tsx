"use client";

import { useState } from "react";
import {
  Package, CheckCircle2, Loader2, ClipboardList,
  Warehouse, CheckCircle, Navigation,
} from "lucide-react";
import { shipmentsApi } from "@/lib/api";

interface ShipmentItem {
  id: string; quantity: number; weight?: number;
  product: { name: string; sku: string; unit: string };
}

interface Props {
  shipmentId: string;
  shipmentCode: string;
  status: string;
  items: ShipmentItem[];
  originWarehouse?: { id: string; name: string } | null;
  onStatusUpdate: (newStatus: string) => void;
}

export default function StaffLoadingPanel({
  shipmentId, shipmentCode, status, items,
  originWarehouse, onStatusUpdate,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show when CONFIRMED (ready to load) or LOADING (already loading)
  if (status !== "CONFIRMED" && status !== "LOADING") return null;

  const handleStartLoading = async () => {
    setLoading(true);
    setError(null);
    try {
      await shipmentsApi.startLoading(shipmentId);
      onStatusUpdate("LOADING");
    } catch {
      setError("Xác nhận xếp hàng thất bại, vui lòng thử lại!");
    }
    setLoading(false);
  };

  const handleCompleteLoading = async () => {
    setLoading(true);
    setError(null);
    try {
      // Transition from LOADING to IN_TRANSIT via update endpoint
      await shipmentsApi.update(shipmentId, { status: "IN_TRANSIT" });
      onStatusUpdate("IN_TRANSIT");
    } catch {
      setError("Xác nhận xếp hàng thất bại, vui lòng thử lại!");
    }
    setLoading(false);
  };

  // LOADING state — already being loaded
  if (status === "LOADING") {
    return (
      <div className="card border-info overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: "rgba(249,115,22,0.1)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.2)" }}>
            <Loader2 size={22} className="animate-spin" style={{ color: "#f97316" }} />
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color: "#f97316" }}>Đang xếp hàng lên xe</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{originWarehouse?.name || "Kho xuất"}</p>
          </div>
        </div>
        <div className="px-5 py-3 border-t flex items-center gap-2 justify-center" style={{ borderColor: "var(--border-color)" }}>
          <button onClick={handleCompleteLoading} disabled={loading} className="btn btn-primary btn-sm w-full">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            Xác nhận đã xếp hàng xong &amp; Bắt đầu vận chuyển
          </button>
        </div>
      </div>
    );
  }

  // CONFIRMED state — ready to load
  return (
    <div className="card border-info overflow-hidden">
      <div className="px-5 py-4" style={{ background: "rgba(99,102,241,0.1)" }}>
        <div className="flex items-center gap-2">
          <ClipboardList size={20} style={{ color: "#6366f1" }} />
          <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: "#6366f1" }}>
            Nhân viên kho xuất
          </h3>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {shipmentCode} • Chuẩn bị hàng hóa tại {originWarehouse?.name || "kho xuất"}
        </p>
      </div>

      {error && (
        <div className="mx-5 mt-3 p-2.5 text-xs rounded-lg" style={{ background: "#fee2e2", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          <Package size={16} /> Danh sách hàng hóa ({items.length} loại)
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--bg-input)" }}>
              <CheckCircle size={16} className="text-success flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.product.name}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>SKU: {item.product.sku}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.quantity} {item.product.unit}</div>
                {item.weight && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{item.weight} kg</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 border-t" style={{ borderColor: "var(--border-color)", background: "var(--bg-input)" }}>
        <button disabled={loading} onClick={handleStartLoading} className="btn btn-primary btn-sm w-full">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Xác nhận đã lấy hàng &amp; Bắt đầu xếp lên xe</>}
        </button>
      </div>

      <div className="px-5 py-2.5 text-[10px]" style={{ color: "var(--text-muted)", background: "var(--bg-card)", textAlign: "center" }}>
        <Warehouse size={11} className="inline mr-1" /> Hàng sẽ được trừ khỏi tồn kho sau khi xác nhận xếp lên xe
      </div>
    </div>
  );
}
