"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Truck, Warehouse, Package, AlertTriangle, Loader2,
  MapPin, User, Calendar,
} from "lucide-react";
import { inventoryApi, warehousesApi, authApi } from "@/lib/api";
import { createShipmentAction } from "@/app/actions/shipments";
import { resolveAlertAction } from "../actions";
import { useAuth } from "@/context/auth-context";

interface Alert {
  id: string;
  productId: string;
  alertType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  currentQty: number;
  threshold: number;
  isResolved: boolean;
  createdAt: string;
  product?: { name: string; sku: string; category: string };
}

interface Warehouse {
  id: string; name: string; code: string; address: string; city: string;
  latitude?: number; longitude?: number;
}

interface InventoryItem {
  id: string; quantity: number; totalQuantity?: number;
  warehouse: { id: string; name: string; code: string; city: string };
  product: { name: string; sku: string; unit: string };
}

interface Driver {
  id: string; name: string; phone?: string;
}

interface Props {
  alert: Alert;
  onClose: () => void;
  onResolved: () => void;
}

export default function ResolveAlertDialog({ alert, onClose, onResolved }: Props) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"loading" | "form" | "submitting" | "success">("loading");
  const [error, setError] = useState<string | null>(null);

  // Guard: only mount on client so createPortal works (document.body not available in SSR)
  useEffect(() => { setMounted(true); }, []);

  // Data
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([]);
  const [sourceInventories, setSourceInventories] = useState<InventoryItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const { managedWarehouse, isAdmin } = useAuth();

  // Form fields
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [driverId, setDriverId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("truck");
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [notes, setNotes] = useState("");

  // Load data on mount
  useEffect(() => {
    (async () => {
      try {          const [invRes, whRes, driverRes] = await Promise.all([
            inventoryApi.getAll({ productId: alert.productId, limit: "100" }),
            warehousesApi.getAll({ all: "true" }),
            authApi.getDrivers().catch(() => null),
          ]);

          const inventoryItems = (invRes.data.data || []) as InventoryItem[];
          const warehouses = (whRes.data.data || []) as Warehouse[];

          // Filter inventory that has stock > 0
          const stocked = inventoryItems.filter(
            (item: InventoryItem) => item.quantity > 0
          );

          const driverList: Driver[] = driverRes?.data?.data || [];

        // Aggregate inventory by warehouse to avoid duplicate warehouse IDs
        const warehouseMap = new Map<string, InventoryItem>();
        stocked.forEach((inv: InventoryItem) => {
          const existing = warehouseMap.get(inv.warehouse.id);
          if (existing) {
            existing.totalQuantity = (existing.totalQuantity || existing.quantity) + inv.quantity;
          } else {
            warehouseMap.set(inv.warehouse.id, { ...inv, totalQuantity: inv.quantity });
          }
        });
        setSourceInventories(Array.from(warehouseMap.values()));
        setAllWarehouses(warehouses);
        setDrivers(driverList);
        setQuantity(1);

        setStep("form");
      } catch (err) {
        setError("Không thể tải dữ liệu. Vui lòng thử lại.");
        setStep("form");
      }
    })();
  }, [alert.productId]);

  // Auto-select destination warehouse when managedWarehouse becomes available
  // (separate effect so it re-runs when auth context refreshes)
  useEffect(() => {
    if (managedWarehouse) {
      setDestinationWarehouseId(managedWarehouse.id);
    }
  }, [managedWarehouse]);

  // Find max available quantity from selected source
  const selectedSourceInv = sourceInventories.find(
    (inv) => inv.warehouse.id === sourceWarehouseId
  );
  const maxQuantity = selectedSourceInv?.totalQuantity || selectedSourceInv?.quantity || 0;

  // Selected warehouse objects
  const destWarehouse = allWarehouses.find((w) => w.id === destinationWarehouseId);
  const srcWarehouse = allWarehouses.find((w) => w.id === sourceWarehouseId);

  const handleSubmit = async () => {
    if (!destinationWarehouseId || !sourceWarehouseId || quantity <= 0) {
      setError("Vui lòng chọn kho nguồn, kho đích và số lượng hợp lệ.");
      return;
    }
    if (sourceWarehouseId === destinationWarehouseId) {
      setError("Kho nguồn và kho đích không thể giống nhau. Vui lòng chọn hai kho khác nhau.");
      return;
    }
    if (quantity > maxQuantity) {
      setError(`Kho nguồn chỉ còn ${maxQuantity} sản phẩm. Vui lòng giảm số lượng.`);
      return;
    }

    setStep("submitting");
    setError(null);

    try {
      // 1. Create shipment
      const shipRes = await createShipmentAction({
        originWarehouseId: sourceWarehouseId,
        destinationWarehouseId,
        originAddress: srcWarehouse?.address || "",
        destinationAddress: destWarehouse?.address || "",
        originLat: srcWarehouse?.latitude,
        originLng: srcWarehouse?.longitude,
        destinationLat: destWarehouse?.latitude,
        destinationLng: destWarehouse?.longitude,
        driverId: driverId || undefined,
        vehicleNumber: vehicleNumber || undefined,
        vehicleType,
        estimatedArrival: estimatedArrival || undefined,
        notes: notes || `Chuyển hàng giải quyết cảnh báo: ${alert.message}`,
        items: [{ productId: alert.productId, quantity }],
        checkpoints: [],
      });

      if (!shipRes.success) {
        throw new Error(shipRes.message || "Tạo vận đơn thất bại");
      }

      // 2. Resolve the alert
      const resolveRes = await resolveAlertAction(alert.id);
      if (!resolveRes.success) {
        console.warn("Cảnh báo đã tạo vận đơn nhưng không thể đánh dấu đã giải quyết:", resolveRes.message);
      }

      setStep("success");
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra. Vui lòng thử lại.");
      setStep("form");
    }
  };

  // Render via portal to document.body so position:fixed isn't broken by ancestor transforms
  // (e.g. animate-fade-in on <main> uses transform which creates a new containing block)
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl border animate-scale-in"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
      >
        {/* Header — always visible at top */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#fff7ed" }}>
              <AlertTriangle size={18} style={{ color: "#f97316" }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Giải quyết cảnh báo
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {alert.product?.name} — {alert.product?.sku}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Content — scrollable middle area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin" style={{ color: "#f97316" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Đang tải dữ liệu kho hàng...
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#d1fae5" }}>
                <Truck size={28} style={{ color: "#059669" }} />
              </div>
              <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Đã tạo vận đơn thành công!
              </h3>
              <p className="text-sm text-center max-w-md" style={{ color: "var(--text-secondary)" }}>
                Vận đơn chuyển hàng từ <strong>{srcWarehouse?.name}</strong> đến{" "}
                <strong>{destWarehouse?.name}</strong> đã được khởi tạo.
              </p>
              <div className="flex gap-3 mt-2">
                <button onClick={onClose} className="btn btn-primary">
                  Hoàn tất
                </button>
              </div>
            </div>
          )}

          {step === "form" && (
            <>
              {/* Error */}
              {error && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                  {error}
                </div>
              )}

              {/* Current Alert Info */}
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "var(--bg-input)" }}>
                <Package size={20} style={{ color: "#f97316" }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {alert.product?.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Tồn hiện tại: <b style={{ color: alert.currentQty === 0 ? "#ef4444" : "#f97316" }}>{alert.currentQty}</b> / Tối thiểu: {alert.threshold}
                  </p>
                </div>
                <span className="badge" style={{ background: alert.severity === "CRITICAL" ? "#fee2e2" : "#fff7ed", color: alert.severity === "CRITICAL" ? "#dc2626" : "#ea580c" }}>
                  {alert.severity}
                </span>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Destination Warehouse — auto-set from manager's warehouse, read-only */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    <MapPin size={12} className="inline mr-1" style={{ color: "#ef4444" }} />
                    Kho cần nhập hàng (Kho đích) *
                  </label>
                  {isAdmin ? (
                    /* Admin: select dropdown with full freedom */
                    <select
                      value={destinationWarehouseId}
                      onChange={(e) => {
                        setDestinationWarehouseId(e.target.value);
                        if (e.target.value === sourceWarehouseId) {
                          setSourceWarehouseId("");
                        }
                      }}
                      className="input-base text-sm"
                    >
                      <option value="">-- Chọn kho điểm đến --</option>
                      {allWarehouses
                        .filter((w) => w.id !== sourceWarehouseId)
                        .map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  ) : managedWarehouse ? (
                    <>
                      <div
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
                        style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe" }}
                      >
                        <MapPin size={16} />
                        <div>
                          <span className="font-semibold">{managedWarehouse.name}</span>
                          <span className="ml-2 text-xs opacity-70">({managedWarehouse.code})</span>
                          <div className="text-xs opacity-70 mt-0.5">{managedWarehouse.address}, {managedWarehouse.city}</div>
                        </div>
                      </div>
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#8b5cf6" }}>
                        <span>📍</span> Hàng sẽ được nhập vào kho bạn đang quản lý
                      </p>
                    </>
                  ) : (
                    <>
                      <div
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                        style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
                      >
                        <AlertTriangle size={16} />
                        <div>
                          <span className="font-semibold">Chưa có kho quản lý</span>
                          <div className="text-xs opacity-80 mt-0.5">
                            Liên hệ Admin để được phân quyền kho trước khi giải quyết cảnh báo
                          </div>
                        </div>
                      </div>
                      <input type="hidden" value="" />
                    </>
                  )}
                </div>

                {/* Source Warehouse */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    <Warehouse size={12} className="inline mr-1" style={{ color: "#059669" }} />
                    Kho lấy hàng (Kho nguồn) *
                  </label>
                  <select
                    value={sourceWarehouseId}
                    onChange={(e) => {
                      setSourceWarehouseId(e.target.value);
                      if (e.target.value === destinationWarehouseId) {
                        setDestinationWarehouseId("");
                      }
                      const inv = sourceInventories.find(
                        (i) => i.warehouse.id === e.target.value
                      );
                      const qty = inv?.totalQuantity || inv?.quantity || 0;
                      if (inv && quantity > qty) {
                        setQuantity(qty);
                      }
                    }}
                    className="input-base text-sm"
                  >
                    <option value="">-- Chọn kho có hàng --</option>
                    {/* Warehouses with stock first (exclude destination) */}
                    {sourceInventories
                      .filter((inv) => inv.warehouse.id !== destinationWarehouseId)
                      .map((inv) => {
                        const qty = inv.totalQuantity || inv.quantity;
                        return (
                          <option key={inv.id} value={inv.warehouse.id}>
                            🟢 {inv.warehouse.name} ({inv.warehouse.code}) — còn {qty} sản phẩm
                          </option>
                        );
                    })}
                    {/* Warehouses without stock, disabled (exclude destination) */}
                    {allWarehouses
                      .filter((wh) => wh.id !== destinationWarehouseId)
                      .filter((wh) => !sourceInventories.some((inv) => inv.warehouse.id === wh.id))
                      .map((wh) => (
                        <option key={wh.id} value={wh.id} disabled>
                          🔴 {wh.name} ({wh.code}) — không có hàng
                        </option>
                      ))}
                  </select>
                  {sourceWarehouseId && !selectedSourceInv && (
                    <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                      Kho này hiện không có sản phẩm trong tồn kho.
                    </p>
                  )}
                  {selectedSourceInv && (
                    <p className="text-xs mt-1" style={{ color: "#059669" }}>
                      Có thể chuyển tối đa {maxQuantity} sản phẩm từ kho này.
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Số lượng cần chuyển *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxQuantity || 1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input-base text-sm"
                  />
                </div>

                {/* Driver */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    <User size={12} className="inline mr-1" />
                    Tài xế
                  </label>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="input-base text-sm"
                  >
                    <option value="">-- Chưa phân bổ tài xế --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.phone ? `(${d.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Loại phương tiện
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="input-base text-sm"
                  >
                    <option value="truck">Xe tải (Truck)</option>
                    <option value="van">Xe bán tải (Van)</option>
                    <option value="motorbike">Xe máy (Motorbike)</option>
                  </select>
                </div>

                {/* Vehicle Number */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Biển kiểm soát
                  </label>
                  <input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="VD: 51C-999.99"
                    className="input-base text-sm"
                  />
                </div>

                {/* Estimated Arrival */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    <Calendar size={12} className="inline mr-1" />
                    Dự kiến giao
                  </label>
                  <input
                    type="datetime-local"
                    value={estimatedArrival}
                    onChange={(e) => setEstimatedArrival(e.target.value)}
                    className="input-base text-sm"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Ghi chú
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ghi chú cho vận đơn chuyển hàng..."
                    rows={2}
                    className="input-base text-sm resize-none"
                    style={{ height: "60px" }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions — always visible at bottom */}
        {step === "form" && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <button onClick={onClose} className="btn btn-secondary">
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={!destinationWarehouseId || !sourceWarehouseId || quantity <= 0}
              className="btn btn-primary"
            >
              <Truck size={16} />
              Tạo vận đơn & Giải quyết
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
