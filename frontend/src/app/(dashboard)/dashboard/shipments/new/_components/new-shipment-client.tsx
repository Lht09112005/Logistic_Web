"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Truck, ArrowLeft, Plus, Trash2, MapPin, Calendar, Clipboard, User, Package, AlertCircle, Shield, Warehouse
} from "lucide-react";
import { createShipmentAction } from "@/app/actions/shipments";
import { RoleGuard } from "@/components/auth/role-guard";
import { useAuth } from "@/context/auth-context";

interface Warehouse {
  id: string; name: string; code: string; address: string; city: string;
  latitude?: number; longitude?: number;
}
interface Product {
  id: string; name: string; sku: string; unit: string; weight?: number;
}
interface Driver {
  id: string; name: string; phone?: string; email: string;
}

interface Props {
  warehouses: Warehouse[];
  products: Product[];
  drivers: Driver[];
}

export default function NewShipmentClient({ warehouses, products, drivers }: Props) {
  const router = useRouter();
  const { managedWarehouse, isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [driverId, setDriverId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("truck");
  const [originWarehouseId, setOriginWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [notes, setNotes] = useState("");

  // Dynamic arrays
  const [items, setItems] = useState<{ productId: string; quantity: number; weight?: number; notes?: string }[]>([
    { productId: "", quantity: 1 }
  ]);
  const [checkpoints, setCheckpoints] = useState<{ name: string; address: string; sequence: number; estimatedAt?: string }[]>([]);

  // Auto-fill origin warehouse info
  const handleOriginChange = (whId: string) => {
    setOriginWarehouseId(whId);
    const wh = warehouses.find(w => w.id === whId);
    if (wh) {
      setOriginAddress(wh.address);
    }
  };

  // Auto-fill destination warehouse for managers
  useEffect(() => {
    if (!isAdmin && managedWarehouse) {
      handleDestinationChange(managedWarehouse.id);
    }
  }, [managedWarehouse, isAdmin]);

  // Auto-fill destination warehouse info
  const handleDestinationChange = (whId: string) => {
    setDestinationWarehouseId(whId);
    const wh = warehouses.find(w => w.id === whId);
    if (wh) {
      setDestinationAddress(wh.address);
    }
  };

  // Manage dynamic items
  const addItem = () => {
    setItems([...items, { productId: "", quantity: 1 }]);
  };
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  const updateItem = (index: number, fields: Partial<typeof items[0]>) => {
    setItems(items.map((item, i) => i === index ? { ...item, ...fields } : item));
  };

  // Manage dynamic checkpoints
  const addCheckpoint = () => {
    setCheckpoints([...checkpoints, { name: "", address: "", sequence: checkpoints.length + 1 }]);
  };
  const removeCheckpoint = (index: number) => {
    const updated = checkpoints.filter((_, i) => i !== index);
    // Recalculate sequences
    setCheckpoints(updated.map((cp, idx) => ({ ...cp, sequence: idx + 1 })));
  };
  const updateCheckpoint = (index: number, fields: Partial<typeof checkpoints[0]>) => {
    setCheckpoints(checkpoints.map((cp, i) => i === index ? { ...cp, ...fields } : cp));
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originAddress || !destinationAddress) {
      setError("Vui lòng điền đầy đủ địa chỉ xuất phát và điểm đến!");
      return;
    }
    const filteredItems = items.filter(item => item.productId !== "");
    if (filteredItems.length === 0) {
      setError("Vui lòng chọn ít nhất một sản phẩm cần vận chuyển!");
      return;
    }

    setLoading(true);
    setError(null);

    // Find lat/lng for warehouses if available
    const originWH = warehouses.find(w => w.id === originWarehouseId);
    const destWH = warehouses.find(w => w.id === destinationWarehouseId);

    const payload = {
      driverId: driverId || undefined,
      vehicleNumber: vehicleNumber || undefined,
      vehicleType,
      originWarehouseId: originWarehouseId || undefined,
      destinationWarehouseId: destinationWarehouseId || undefined,
      originAddress,
      destinationAddress,
      originLat: originWH?.latitude,
      originLng: originWH?.longitude,
      destinationLat: destWH?.latitude,
      destinationLng: destWH?.longitude,
      estimatedArrival: estimatedArrival || undefined,
      notes: notes || undefined,
      items: filteredItems,
      checkpoints: checkpoints.filter(cp => cp.name !== "" && cp.address !== "")
    };

    const res = await createShipmentAction(payload);
    setLoading(false);

    if (res.success) {
      router.push("/dashboard/shipments");
      router.refresh();
    } else {
      setError(res.message || "Tạo vận đơn thất bại!");
    }
  };

  return (
    <RoleGuard allowedRoles={["ADMIN", "MANAGER"]} fallback="redirect">
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="btn btn-secondary p-2.5 rounded-xl shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Tạo vận đơn mới
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Khởi tạo lộ trình vận chuyển, phân phối hàng hóa liên kho
          </p>
        </div>
      </div>

      {error && (
        <div className="card p-4 flex items-center gap-3" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}>
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Details (Col 1 & 2) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Lộ trình */}
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <MapPin size={18} className="text-orange-500" />
              Lộ trình & Điểm đi/đến
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="shipment-origin-warehouse" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  <Warehouse size={12} className="inline mr-1" style={{ color: "#059669" }} />
                  Kho xuất phát
                </label>
                <select
                  id="shipment-origin-warehouse"
                  value={originWarehouseId}
                  onChange={(e) => {
                    handleOriginChange(e.target.value);
                    if (e.target.value === destinationWarehouseId) {
                      setDestinationWarehouseId("");
                    }
                  }}
                  className="input-base text-sm"
                >
                  <option value="">-- Chọn kho xuất phát (Tùy chọn) --</option>
                  {warehouses
                    .filter((w) => isAdmin || !managedWarehouse || w.id !== managedWarehouse.id)
                    .map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
                {!isAdmin && managedWarehouse && (
                  <p className="text-xs mt-1" style={{ color: "#6b7280" }}>
                    Chọn kho có hàng cần chuyển đến kho của bạn
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="shipment-destination-warehouse" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  <MapPin size={12} className="inline mr-1" style={{ color: "#ef4444" }} />
                  Kho điểm đến
                </label>
                {isAdmin ? (
                  /* Admin: select dropdown with full freedom */
                  <select
                    id="shipment-destination-warehouse"
                    value={destinationWarehouseId}
                    onChange={(e) => {
                      handleDestinationChange(e.target.value);
                      if (e.target.value === originWarehouseId) {
                        setOriginWarehouseId("");
                      }
                    }}
                    className="input-base text-sm"
                  >
                    <option value="">-- Chọn kho điểm đến (Tùy chọn) --</option>
                    {warehouses
                      .filter((w) => w.id !== originWarehouseId)
                      .map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                ) : managedWarehouse ? (
                  /* Manager with warehouse: read-only card locked to managed warehouse */
                  <>
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
                      style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe" }}
                    >
                      <Shield size={16} />
                      <div>
                        <span className="font-semibold">{managedWarehouse.name}</span>
                        <span className="ml-2 text-xs opacity-70">({managedWarehouse.code})</span>
                        <div className="text-xs opacity-70 mt-0.5">
                          {[managedWarehouse.address, managedWarehouse.city].filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#8b5cf6" }}>
                      <span>📍</span> Hàng sẽ được nhập vào kho bạn đang quản lý
                    </p>
                  </>
                ) : (
                  /* Manager without warehouse assignment: show disabled message */
                  <>
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                      style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
                    >
                      <AlertCircle size={16} />
                      <div>
                        <span className="font-semibold">Chưa có kho quản lý</span>
                        <div className="text-xs opacity-80 mt-0.5">
                          Liên hệ Admin để được phân quyền kho trước khi tạo vận đơn
                        </div>
                      </div>
                    </div>
                    <input type="hidden" value="" />
                  </>
                )}
              </div>

              <div>
                <label htmlFor="shipment-origin-address" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Địa chỉ xuất phát *</label>
                <input
                  id="shipment-origin-address"
                  required
                  value={originAddress}
                  onChange={(e) => setOriginAddress(e.target.value)}
                  placeholder="Nhập địa chỉ nhận hàng"
                  className="input-base text-sm"
                />
              </div>

              <div>
                <label htmlFor="shipment-destination-address" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Địa chỉ điểm đến *</label>
                <input
                  id="shipment-destination-address"
                  required
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="Nhập địa chỉ giao hàng"
                  className="input-base text-sm"
                />
              </div>
            </div>
          </div>

          {/* Hàng hóa */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Package size={18} className="text-orange-500" />
                Mặt hàng vận chuyển *
              </h2>
              <button type="button" onClick={addItem} className="btn btn-secondary btn-sm rounded-lg">
                <Plus size={14} /> Thêm dòng
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-end flex-wrap md:flex-nowrap p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                  <div className="flex-1 min-w-48">
                    <label htmlFor={`shipment-item-product-${idx}`} className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Sản phẩm *</label>
                    <select
                      id={`shipment-item-product-${idx}`}
                      required
                      value={item.productId}
                      onChange={(e) => updateItem(idx, { productId: e.target.value })}
                      className="input-base text-sm"
                      style={{ background: "var(--bg-card)" }}
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label htmlFor={`shipment-item-qty-${idx}`} className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Số lượng *</label>
                    <input
                      id={`shipment-item-qty-${idx}`}
                      type="number"
                      required
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                      className="input-base text-sm"
                      style={{ background: "var(--bg-card)" }}
                    />
                  </div>

                  <div className="w-28">
                    <label htmlFor={`shipment-item-weight-${idx}`} className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>KL (kg/tùy chọn)</label>
                    <input
                      id={`shipment-item-weight-${idx}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.weight || ""}
                      placeholder="Trọng lượng"
                      onChange={(e) => updateItem(idx, { weight: parseFloat(e.target.value) || undefined })}
                      className="input-base text-sm"
                      style={{ background: "var(--bg-card)" }}
                    />
                  </div>

                  <div className="flex-1 min-w-32">
                    <label htmlFor={`shipment-item-notes-${idx}`} className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Ghi chú</label>
                    <input
                      id={`shipment-item-notes-${idx}`}
                      value={item.notes || ""}
                      placeholder="Ghi chú hàng"
                      onChange={(e) => updateItem(idx, { notes: e.target.value })}
                      className="input-base text-sm"
                      style={{ background: "var(--bg-card)" }}
                    />
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="btn btn-icon text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg p-2.5 mb-0.5"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Trạm kiểm soát Checkpoints */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <MapPin size={18} className="text-indigo-500" />
                Các trạm kiểm soát trung gian (Checkpoints)
              </h2>
              <button type="button" onClick={addCheckpoint} className="btn btn-secondary btn-sm rounded-lg">
                <Plus size={14} /> Thêm trạm
              </button>
            </div>

            {checkpoints.length === 0 ? (
              <p className="text-xs text-center py-6 border-2 border-dashed rounded-lg" style={{ color: "var(--text-muted)", borderColor: "var(--border-color)" }}>
                Chưa có trạm trung gian nào được thêm. Vận đơn sẽ đi thẳng từ Điểm đi tới Điểm đến.
              </p>
            ) : (
              <div className="space-y-3">
                {checkpoints.map((cp, idx) => (
                  <div key={idx} className="flex gap-3 items-end p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                    <div className="w-12 text-center text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                      #{idx + 1}
                    </div>

                    <div className="flex-1">
                      <label htmlFor={`shipment-cp-name-${idx}`} className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Tên trạm *</label>
                      <input
                        id={`shipment-cp-name-${idx}`}
                        required
                        value={cp.name}
                        placeholder="VD: Trạm dừng chân Ninh Bình"
                        onChange={(e) => updateCheckpoint(idx, { name: e.target.value })}
                        className="input-base text-sm"
                        style={{ background: "var(--bg-card)" }}
                      />
                    </div>

                    <div className="flex-1">
                      <label htmlFor={`shipment-cp-address-${idx}`} className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Địa chỉ trạm *</label>
                      <input
                        id={`shipment-cp-address-${idx}`}
                        required
                        value={cp.address}
                        placeholder="Địa chỉ cụ thể của trạm"
                        onChange={(e) => updateCheckpoint(idx, { address: e.target.value })}
                        className="input-base text-sm"
                        style={{ background: "var(--bg-card)" }}
                      />
                    </div>

                    <div className="w-48">
                      <label htmlFor={`shipment-cp-time-${idx}`} className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Dự kiến ghé qua</label>
                      <input
                        id={`shipment-cp-time-${idx}`}
                        type="datetime-local"
                        value={cp.estimatedAt || ""}
                        onChange={(e) => updateCheckpoint(idx, { estimatedAt: e.target.value })}
                        className="input-base text-sm"
                        style={{ background: "var(--bg-card)", height: "38px" }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCheckpoint(idx)}
                      className="btn btn-icon text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg p-2.5"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info (Col 3) */}
        <div className="space-y-6">
          {/* Phân bổ vận chuyển */}
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <User size={18} className="text-orange-500" />
              Phương tiện & Tài xế
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="shipment-driver" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Tài xế nhận đơn</label>
                <select
                  id="shipment-driver"
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="">-- Chưa phân bổ tài xế --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone || "Không có SĐT"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="shipment-vehicle-type" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Loại phương tiện</label>
                <select
                  id="shipment-vehicle-type"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="truck">Xe tải (Truck)</option>
                  <option value="van">Xe bán tải (Van)</option>
                  <option value="motorbike">Xe máy (Motorbike)</option>
                </select>
              </div>

              <div>
                <label htmlFor="shipment-vehicle-number" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Biển kiểm soát</label>
                <input
                  id="shipment-vehicle-number"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="VD: 51C-999.99"
                  className="input-base text-sm"
                />
              </div>

              <div>
                <label htmlFor="shipment-estimated-arrival" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Thời gian dự kiến giao</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input
                    id="shipment-estimated-arrival"
                    type="datetime-local"
                    value={estimatedArrival}
                    onChange={(e) => setEstimatedArrival(e.target.value)}
                    className="input-base pl-9 text-sm"
                    style={{ height: "38px" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ghi chú */}
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Clipboard size={18} className="text-orange-500" />
              Thông tin bổ sung
            </h2>

            <div>
              <label htmlFor="shipment-notes" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Ghi chú đơn hàng</label>
              <textarea
                id="shipment-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhập ghi chú hoặc hướng dẫn vận chuyển đặc biệt..."
                className="input-base text-sm w-full h-28"
                style={{ resize: "none" }}
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center py-3 text-sm rounded-xl font-bold"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Truck size={16} />
                  Xác nhận & Khởi tạo
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-secondary w-full justify-center py-3 text-sm rounded-xl"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      </form>
    </div>
    </RoleGuard>
  );
}
