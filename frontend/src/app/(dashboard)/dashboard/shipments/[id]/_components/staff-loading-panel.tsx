"use client";

import { useState } from "react";
import {
  Package, CheckCircle2, Loader2, ClipboardList,
  Warehouse, CheckCircle,
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
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmReady = async () => {
    setLoading(true);
    setError(null);
    try {
      await shipmentsApi.update(shipmentId, { status: "CONFIRMED" });
      setConfirmed(true);
      onStatusUpdate("CONFIRMED");
    } catch {
      setError("Xác nhận thất bại, vui lòng thử lại!");
    }
    setLoading(false);
  };

  // If not PENDING, show done state if we confirmed, otherwise hide
  if (status !== "PENDING") {
    if (confirmed || status === "CONFIRMED") {
      return (
        <div className="card border-success overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3 gradient-success">
            <div className="w-10 h-10 rounded-full bg-success/50 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-success" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-success">Đã chuẩn bị hàng xong</h3>
              <p className="text-xs" style={{ color: "var(--color-success)" }}>Hàng đã sẵn sàng để tài xế lấy</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="card border-info overflow-hidden">
      <div className="px-5 py-4 bg-info">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-info" />
          <h3 className="font-bold text-sm uppercase tracking-wide text-info">
            Nhân viên kho xuất
          </h3>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--color-info)" }}>
          {shipmentCode} • Chuẩn bị hàng hóa tại {originWarehouse?.name || "kho xuất"}
        </p>
      </div>

      {error && (
        <div className="mx-5 mt-3 p-2.5 text-xs rounded-lg bg-error text-error">
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
        <button disabled={loading || confirmed} onClick={handleConfirmReady} className="btn btn-primary btn-sm w-full">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Xác nhận đã chuẩn bị hàng xong</>}
        </button>
      </div>

      <div className="px-5 py-2.5 text-[10px]" style={{ color: "var(--text-muted)", background: "var(--bg-card)", textAlign: "center" }}>
        <Warehouse size={11} className="inline mr-1" /> Xác nhận hàng hóa tại kho trước khi tài xế lấy hàng
      </div>
    </div>
  );
}
