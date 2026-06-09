"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, MapPin, Clipboard, Tag, AlertCircle
} from "lucide-react";
import { createInventoryAction } from "@/app/actions/inventory";
import { RoleGuard } from "@/components/auth/role-guard";

interface Warehouse {
  id: string; name: string; code: string; city: string; zones?: { id: string; name: string }[];
}
interface Product {
  id: string; name: string; sku: string; category: string; unit: string;
}

interface Props {
  warehouses: Warehouse[];
  products: Product[];
}

export default function NewInventoryClient({ warehouses, products }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [rack, setRack] = useState("");
  const [shelf, setShelf] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState("");

  // Get zones for selected warehouse
  const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
  const zones = selectedWarehouse?.zones || [];

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !warehouseId) {
      setError("Vui lòng chọn đầy đủ Sản phẩm và Kho hàng!");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      productId,
      warehouseId,
      zoneId: zoneId || undefined,
      rack: rack || undefined,
      shelf: shelf || undefined,
      quantity: quantity || 0,
      notes: notes || undefined
    };

    const res = await createInventoryAction(payload);
    setLoading(false);

    if (res.success) {
      router.push("/dashboard/inventory");
      router.refresh();
    } else {
      setError(res.message || "Thêm vào tồn kho thất bại!");
    }
  };

  return (
    <RoleGuard allowedRoles={["ADMIN", "MANAGER", "STAFF"]} fallback="redirect">
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => router.back()} className="btn btn-secondary p-2.5 rounded-xl flex-shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Thêm tồn kho mới
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Khai báo và phân bổ sản phẩm vào vị trí cụ thể trong hệ thống kho
          </p>
        </div>
      </div>

      {error && (
        <div className="card p-4 flex items-center gap-3 bg-error border-error text-error">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Fields (Cols 1 & 2) */}
        <div className="md:col-span-2 space-y-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Tag size={18} style={{ color: "var(--color-warning)" }} />
              Sản phẩm & Địa điểm *
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="new-inventory-product" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Sản phẩm *</label>
                <select
                  id="new-inventory-product"
                  name="productId"
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="">-- Chọn sản phẩm trong hệ thống --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="new-inventory-warehouse" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Kho lưu trữ *</label>
                <select
                  id="new-inventory-warehouse"
                  name="warehouseId"
                  required
                  value={warehouseId}
                  onChange={(e) => {
                    setWarehouseId(e.target.value);
                    setZoneId(""); // Reset zone
                  }}
                  className="input-base text-sm"
                >
                  <option value="">-- Chọn kho lưu trữ --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code}) - {w.city}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <MapPin size={18} style={{ color: "var(--color-warning)" }} />
              Vị trí chi tiết & Số lượng
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-inventory-zone" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Phân khu (Zone)</label>
                <select
                  id="new-inventory-zone"
                  name="zoneId"
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="input-base text-sm"
                  disabled={!warehouseId}
                >
                  <option value="">-- Chọn Zone (Không bắt buộc) --</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
                {!warehouseId && (
                  <p className="text-[10px] mt-1" style={{ color: "var(--color-warning)" }}>Vui lòng chọn Kho trước để hiện phân khu</p>
                )}
              </div>

              <div>
                <label htmlFor="new-inventory-quantity" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Số lượng tồn kho ban đầu *</label>
                <input
                  id="new-inventory-quantity"
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
                <label htmlFor="new-inventory-rack" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Kệ hàng (Rack)</label>
                <input
                  id="new-inventory-rack"
                  name="rack"
                  value={rack}
                  onChange={(e) => setRack(e.target.value)}
                  placeholder="VD: R-A1"
                  className="input-base text-sm"
                />
              </div>

              <div>
                <label htmlFor="new-inventory-shelf" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Ngăn chứa (Shelf)</label>
                <input
                  id="new-inventory-shelf"
                  name="shelf"
                  value={shelf}
                  onChange={(e) => setShelf(e.target.value)}
                  placeholder="VD: S-02"
                  className="input-base text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Actions (Col 3) */}
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Clipboard size={18} style={{ color: "var(--color-warning)" }} />
              Thông tin bổ sung
            </h2>

            <div>
              <label htmlFor="new-inventory-notes" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Ghi chú kệ kho</label>
              <textarea
                id="new-inventory-notes"
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Hàng dễ vỡ, lưu ý nhiệt độ phòng..."
                className="input-base text-sm w-full h-28"
                style={{ resize: "none" }}
              />
            </div>
          </div>

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
                  <Plus size={16} />
                  Thêm tồn kho
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
