"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Truck, ArrowLeft, Plus, Trash2, MapPin, Calendar, Clipboard, User, Package, AlertCircle
} from "lucide-react";
import { createShipmentAction } from "@/app/actions/shipments";
import { RoleGuard } from "@/components/auth/role-guard";

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
        <button onClick={() => router.back()} className="btn btn-secondary p-2.5 rounded-xl flex-shrink-0">
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
        <div className="card p-4 flex items-center gap-3" style={{ background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c" }}>
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
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Kho xuất phát</label>
                <select
                  value={originWarehouseId}
                  onChange={(e) => handleOriginChange(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="">-- Chọn kho xuất phát (Tùy chọn) --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Kho điểm đến</label>
                <select
                  value={destinationWarehouseId}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="">-- Chọn kho điểm đến (Tùy chọn) --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Địa chỉ xuất phát *</label>
                <input
                  required
                  value={originAddress}
                  onChange={(e) => setOriginAddress(e.target.value)}
                  placeholder="Nhập địa chỉ nhận hàng"
                  className="input-base text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Địa chỉ điểm đến *</label>
                <input
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
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Sản phẩm *</label>
                    <select
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
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Số lượng *</label>
                    <input
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
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>KL (kg/tùy chọn)</label>
                    <input
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
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Ghi chú</label>
                    <input
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
                      className="btn btn-icon text-red-500 hover:bg-red-50 rounded-lg p-2.5 mb-0.5"
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
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Tên trạm *</label>
                      <input
                        required
                        value={cp.name}
                        placeholder="VD: Trạm dừng chân Ninh Bình"
                        onChange={(e) => updateCheckpoint(idx, { name: e.target.value })}
                        className="input-base text-sm"
                        style={{ background: "var(--bg-card)" }}
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Địa chỉ trạm *</label>
                      <input
                        required
                        value={cp.address}
                        placeholder="Địa chỉ cụ thể của trạm"
                        onChange={(e) => updateCheckpoint(idx, { address: e.target.value })}
                        className="input-base text-sm"
                        style={{ background: "var(--bg-card)" }}
                      />
                    </div>

                    <div className="w-48">
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Dự kiến ghé qua</label>
                      <input
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
                      className="btn btn-icon text-red-500 hover:bg-red-50 rounded-lg p-2.5"
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
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Tài xế nhận đơn</label>
                <select
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
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Loại phương tiện</label>
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

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Biển kiểm soát</label>
                <input
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="VD: 51C-999.99"
                  className="input-base text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Thời gian dự kiến giao</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input
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
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Ghi chú đơn hàng</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhập ghi chú hoặc hướng dẫn vận chuyển đặc biệt..."
                className="input-base text-sm w-100 h-28"
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
