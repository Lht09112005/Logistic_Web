"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, MapPin, Clipboard, Tag, AlertCircle, Package
} from "lucide-react";
import { createInventoryAction } from "@/app/actions/inventory";
import { productsApi } from "@/lib/api";
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
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("Cái");
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [rack, setRack] = useState("");
  const [shelf, setShelf] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Get zones for selected warehouse
  const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
  const zones = selectedWarehouse?.zones || [];

  // Auto-generate SKU from product name
  const generateSku = (name: string) => {
    const slug = name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 20)
      .toUpperCase();
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${slug}-${suffix}`;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate: need either productId OR newProductName
    const isNewProduct = !productId && newProductName.trim();
    if (!productId && !isNewProduct) {
      setError("Vui lòng chọn sản phẩm có sẵn hoặc nhập tên sản phẩm mới!");
      return;
    }
    if (!warehouseId) {
      setError("Vui lòng chọn Kho hàng!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalProductId = productId;

      // If creating a new product
      if (isNewProduct) {
        setIsCreatingProduct(true);
        const sku = generateSku(newProductName.trim());
        const createRes = await productsApi.create({
          name: newProductName.trim(),
          sku,
          unit: newProductUnit || "Cái",
          category: "OTHER",
          minStockLevel: 10,
        });
        const newProduct = createRes.data?.data;
        if (!newProduct?.id) {
          throw new Error("Không thể tạo sản phẩm mới!");
        }
        finalProductId = newProduct.id;
        setIsCreatingProduct(false);
      }

      const payload = {
        productId: finalProductId,
        warehouseId,
        zoneId: zoneId || undefined,
        rack: rack || undefined,
        shelf: shelf || undefined,
        quantity: quantity || 0,
        notes: notes || undefined
      };

      const res = await createInventoryAction(payload);

      if (res.success) {
        router.push("/dashboard/inventory");
        router.refresh();
      } else {
        setError(res.message || "Thêm vào tồn kho thất bại!");
      }
    } catch (err: unknown) {
      setIsCreatingProduct(false);
      const message = (err as { response?: { data?: { message?: string } }, message?: string })?.response?.data?.message
        || (err as Error)?.message
        || "Lỗi không xác định!";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["ADMIN", "MANAGER"]} fallback="redirect">
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

            <div className="space-y-5">
              {/* Existing product selector */}
              <div>
                <label htmlFor="new-inventory-product" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Chọn sản phẩm có sẵn
                </label>
                <select
                  id="new-inventory-product"
                  name="productId"
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    if (e.target.value) setNewProductName(""); // Clear new product name when selecting existing
                  }}
                  className="input-base text-sm"
                >
                  <option value="">-- Chọn sản phẩm trong hệ thống --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "var(--border-light)" }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Hoặc thêm mới</span>
                <div className="flex-1 h-px" style={{ background: "var(--border-light)" }} />
              </div>

              {/* New product fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-product-name" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    <Package size={12} className="inline mr-1" style={{ color: "var(--color-warning)" }} />
                    Tên sản phẩm mới
                  </label>
                  <input
                    id="new-product-name"
                    name="newProductName"
                    type="text"
                    value={newProductName}
                    onChange={(e) => {
                      setNewProductName(e.target.value);
                      if (e.target.value) setProductId(""); // Clear selected product when typing new name
                    }}
                    placeholder="VD: Máy in Laser HP 1018..."
                    className="input-base text-sm"
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>SKU sẽ được tự động tạo từ tên sản phẩm</p>
                </div>
                <div>
                  <label htmlFor="new-product-unit" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Đơn vị tính
                  </label>
                  <input
                    id="new-product-unit"
                    name="newProductUnit"
                    type="text"
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    placeholder="VD: Cái, Thùng, Kg..."
                    className="input-base text-sm"
                  />
                </div>
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
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isCreatingProduct ? "Đang tạo sản phẩm..." : "Đang thêm tồn kho..."}
                </span>
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
