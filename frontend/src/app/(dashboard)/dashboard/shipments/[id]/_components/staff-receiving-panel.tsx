"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Package, CheckCircle2, Loader2, ClipboardList,
  Warehouse, ArrowLeftToLine, CheckCircle, XCircle,
  MapPin, PlusCircle,
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
  destinationWarehouse?: { id: string; name: string } | null;
  onStatusUpdate: (newStatus: string) => void;
}

export default function StaffReceivingPanel({
  shipmentId, shipmentCode, status, items,
  destinationWarehouse, onStatusUpdate,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Only show for DELIVERING or IN_TRANSIT (when arriving)
  if (status !== "DELIVERING" && status !== "DELIVERED") return null;

  // Already delivered, show completed state
  if (status === "DELIVERED" && !success) {
    // Still show the panel but as read-only
  }

  const handleReceive = async () => {
    setLoading(true);
    setError(null);
    try {
      await shipmentsApi.receive(shipmentId);
      setSuccess(true);
      onStatusUpdate("DELIVERED");
    } catch {
      setError("Tiếp nhận hàng thất bại, vui lòng thử lại!");
    }
    setLoading(false);
  };

  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);

  // Success state
  if (success || status === "DELIVERED") {
    return (
      <div className="card border-success overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3 gradient-success">
          <div className="w-10 h-10 rounded-full bg-success/50 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-success" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-success">
              {success ? "Đã nhập hàng vào kho" : "Đã tiếp nhận hàng"}
            </h3>
            <p className="text-xs" style={{ color: "var(--color-success)" }}>
              {totalQty} sản phẩm đã được thêm vào {destinationWarehouse?.name || "kho đích"}
            </p>
          </div>
        </div>
        <div className="px-5 py-3 border-t flex items-center gap-2" style={{ borderColor: "var(--border-color)" }}>
          <Warehouse size={14} style={{ color: "var(--text-muted)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Kiểm tra tồn kho tại{" "}
            <Link
              href={`/dashboard/warehouse/${destinationWarehouse?.id || ""}`}
              className="font-medium underline text-success"
            >
              {destinationWarehouse?.name || "kho đích"}
            </Link>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-success overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 gradient-success">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-success" />
          <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--color-success)" }}>
            Nhân viên kho nhập
          </h3>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--color-success)" }}>
          {shipmentCode} • Tiếp nhận hàng tại {destinationWarehouse?.name || "kho đích"}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-3 p-2.5 text-xs rounded-lg bg-error text-error">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="px-5 py-3 grid grid-cols-3 gap-3">
        {[
          { label: "Số loại hàng", value: items.length, icon: Package, color: "#6366f1" },
          { label: "Tổng số lượng", value: totalQty, icon: PlusCircle, color: "#f97316" },
          { label: "Tổng khối lượng", value: `${(totalWeight || 0).toLocaleString()} kg`, icon: MapPin, color: "#10b981" },
        ].map((stat) => (
          <div key={stat.label} className="text-center p-2 rounded-lg" style={{ background: "var(--bg-input)" }}>
            <div className="flex items-center justify-center gap-1 text-xs font-semibold" style={{ color: stat.color }}>
              <stat.icon size={14} /> {stat.value}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Item checklist */}
      <div className="px-5 pb-3 space-y-2 max-h-48 overflow-y-auto">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          <Package size={14} /> Danh sách hàng đến
        </div>
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-2.5 rounded-lg animate-fade-in"
            style={{ background: "var(--bg-input)", animationDelay: `${idx * 50}ms` }}
          >
            <CheckCircle2 size={16} className="text-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {item.product.name}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                SKU: {item.product.sku}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-bold text-success">
                +{item.quantity} {item.product.unit}
              </div>
              {item.weight && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {item.weight} kg/đv
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action button */}
      <div className="px-5 py-3 border-t" style={{ borderColor: "var(--border-color)", background: "var(--bg-input)" }}>
        <button
          disabled={loading}
          onClick={handleReceive}
          className="btn w-full"
          style={{
            background: "linear-gradient(135deg,var(--color-success),#059669)",
            color: "white",
            border: "none",
          }}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <><ArrowLeftToLine size={16} /> Xác nhận nhập hàng vào kho</>
          )}
        </button>
        <p className="text-[10px] text-center mt-1.5" style={{ color: "var(--text-muted)" }}>
          Hàng sẽ được thêm vào tồn kho tại {destinationWarehouse?.name || "kho đích"}
        </p>
      </div>
    </div>
  );
}


