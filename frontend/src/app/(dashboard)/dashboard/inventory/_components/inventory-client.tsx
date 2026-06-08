"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Search, Filter, AlertTriangle, QrCode, Plus, Eye } from "lucide-react";
import { formatDate, getCategoryLabel, getAlertSeverityBadge, getStockPercent } from "@/lib/utils";

interface InventoryItem {
  id: string; quantity: number; reservedQty: number;
  rack?: string; shelf?: string; lastAuditAt?: string;
  product: { id: string; name: string; sku: string; category: string; unit: string; minStockLevel: number; imageUrl?: string; qrCode?: string };
  warehouse: { id: string; name: string; code: string; city: string };
  zone?: { name: string };
}

interface Alert {
  id: string; severity: string; alertType: string; message: string;
  product?: { name: string };
}

interface Props {
  inventory: unknown[];
  total: number;
  alerts: unknown[];
}

export default function InventoryClient({ inventory, total, alerts }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const items = inventory as InventoryItem[];
  const alertItems = alerts as Alert[];

  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.product.name.toLowerCase().includes(search.toLowerCase()) ||
      item.product.sku.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === "all" ||
      (filter === "low" && item.quantity < item.product.minStockLevel && item.quantity > 0) ||
      (filter === "out" && item.quantity === 0);

    return matchSearch && matchFilter;
  });

  const lowCount = items.filter((i) => i.quantity < i.product.minStockLevel && i.quantity > 0).length;
  const outCount = items.filter((i) => i.quantity === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Tồn kho
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {total} mục tồn kho • {lowCount} sắp hết • {outCount} hết hàng
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/qr-scan" className="btn btn-secondary btn-sm">
            <QrCode size={14} /> Kiểm kho QR
          </Link>
          <Link href="/dashboard/inventory/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> Thêm tồn kho
          </Link>
        </div>
      </div>

      {/* Alert summary */}
      {alertItems.length > 0 && (
        <div className="card p-4" style={{ border: "1px solid #fed7aa", background: "linear-gradient(135deg,#fff7ed,#ffedd5)" }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} style={{ color: "#ea580c" }} />
            <span className="font-semibold text-sm" style={{ color: "#c2410c" }}>
              {alertItems.length} cảnh báo tồn kho cần xử lý
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertItems.slice(0, 3).map((a) => (
              <span key={a.id} className={`badge ${getAlertSeverityBadge(a.severity)}`}>
                {a.product?.name}
              </span>
            ))}
            {alertItems.length > 3 && (
              <Link href="/dashboard/alerts" className="badge badge-orange">+{alertItems.length - 3} xem thêm</Link>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm sản phẩm, SKU..."
            className="input-base pl-9 py-2 text-sm"
            style={{ height: "38px" }}
          />
        </div>
        <div className="flex gap-1">
          {[
            { v: "all" as const, label: "Tất cả" },
            { v: "low" as const, label: `Sắp hết (${lowCount})` },
            { v: "out" as const, label: `Hết hàng (${outCount})` },
          ].map((tab) => (
            <button
              key={tab.v}
              onClick={() => setFilter(tab.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === tab.v ? "text-white" : "hover:bg-[var(--bg-input)]"}`}
              style={filter === tab.v ? { background: "linear-gradient(135deg,#f97316,#ea580c)" } : { color: "var(--text-secondary)" }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => router.refresh()} className="btn btn-ghost btn-sm">
          <Filter size={14} /> Làm mới
        </button>
      </div>

      {/* Inventory grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((item, i) => {
          const pct = getStockPercent(item.quantity, item.product.minStockLevel);
          const isLow = item.quantity < item.product.minStockLevel;
          const isOut = item.quantity === 0;

          return (
            <div
              key={item.id}
              className="card card-hover p-5 animate-fade-in"
              style={{ animationDelay: `${i * 40}ms`, border: isOut ? "1px solid #fca5a5" : isLow ? "1px solid #fed7aa" : "1px solid var(--border-color)" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isOut ? "#fee2e2" : isLow ? "#fff7ed" : "var(--bg-input)" }}
                  >
                    <Package size={18} style={{ color: isOut ? "#ef4444" : isLow ? "#f97316" : "var(--text-secondary)" }} />
                  </div>
                  <div>
                    <Link
                      href={`/dashboard/inventory/${item.id}`}
                      className="font-semibold text-sm hover:underline line-clamp-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.product.name}
                    </Link>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {item.product.sku} • {getCategoryLabel(item.product.category)}
                    </div>
                  </div>
                </div>
                {isOut
                  ? <span className="badge badge-danger">Hết hàng</span>
                  : isLow
                  ? <span className="badge badge-warning">Sắp hết</span>
                  : <span className="badge badge-success">Còn hàng</span>
                }
              </div>

              {/* Stock bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                  <span>Tồn kho</span>
                  <span className="font-bold" style={{ color: isOut ? "#ef4444" : isLow ? "#f97316" : "var(--text-primary)" }}>
                    {item.quantity} / {item.product.minStockLevel * 2} {item.product.unit}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${pct}%`,
                      background: isOut ? "#ef4444" : isLow ? "#f97316" : "linear-gradient(90deg,#10b981,#059669)",
                    }}
                  />
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Tối thiểu: {item.product.minStockLevel} {item.product.unit}
                </div>
              </div>

              {/* Location & audit */}
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                <div>
                  <span className="font-medium">{item.warehouse.code}</span>
                  {item.zone && <span> / {item.zone.name}</span>}
                  {item.rack && <span> / {item.rack}-{item.shelf}</span>}
                </div>
                {item.lastAuditAt && (
                  <span>Kiểm: {formatDate(item.lastAuditAt, "dd/MM HH:mm")}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--border-light)" }}>
                <Link href={`/dashboard/inventory/${item.id}`} className="btn btn-ghost btn-sm flex-1 justify-center">
                  <Eye size={13} /> Chi tiết
                </Link>
                <Link href={`/dashboard/qr-scan?productId=${item.product.id}`} className="btn btn-secondary btn-sm flex-1 justify-center">
                  <QrCode size={13} /> Kiểm kho
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--text-muted)" }}>
          <Package size={48} style={{ opacity: 0.2 }} />
          <p>Không tìm thấy sản phẩm nào</p>
        </div>
      )}
    </div>
  );
}
