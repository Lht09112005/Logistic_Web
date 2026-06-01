"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  QrCode, Camera, CheckCircle, AlertCircle, Loader2,
  Package, RotateCcw, Minus, Plus, Save, X, Scan,
} from "lucide-react";
import { productsApi, inventoryApi } from "@/lib/api";
import { getCategoryLabel } from "@/lib/utils";

interface ScannedProduct {
  id: string; name: string; sku: string; category: string;
  unit: string; minStockLevel: number; qrCode?: string;
  inventory: { id: string; quantity: number; warehouse: { name: string; code: string } }[];
}

type ScanState = "idle" | "scanning" | "found" | "notfound" | "updating" | "success" | "error";

export default function QRScanClient() {
  const searchParams = useSearchParams();
  const preloadId = searchParams.get("productId");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [adjustment, setAdjustment] = useState(0);
  const [notes, setNotes] = useState("");
  const [manualQr, setManualQr] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Pre-load from URL param
  useEffect(() => {
    if (preloadId) {
      productsApi.getById(preloadId).then((res) => {
        const p = res.data.data as ScannedProduct;
        setProduct(p);
        setScanState("found");
        if (p.inventory?.[0]) setSelectedInventoryId(p.inventory[0].id);
      }).catch(() => {});
    }
  }, [preloadId]);

  const handleQRResult = useCallback(async (qrCode: string) => {
    setScanState("scanning");
    stopCamera();
    try {
      const res = await productsApi.getByQR(qrCode);
      const p = res.data.data as ScannedProduct;
      setProduct(p);
      setScanState("found");
      if (p.inventory?.[0]) setSelectedInventoryId(p.inventory[0].id);
    } catch {
      setScanState("notfound");
    }
  }, []);

  const startCamera = async () => {
    setCameraError("");
    setScanState("scanning");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-area");

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          handleQRResult(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      console.warn(err.message || err);
      setCameraError("Không thể truy cập camera. Vui lòng cho phép quyền camera.");
      setScanState("idle");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleReset = () => {
    stopCamera();
    setProduct(null);
    setScanState("idle");
    setAdjustment(0);
    setNotes("");
    setManualQr("");
    setSuccessMsg("");
    setSelectedInventoryId("");
  };

  const handleManualLookup = async () => {
    if (!manualQr.trim()) return;
    await handleQRResult(manualQr.trim());
  };

  const handleUpdateInventory = async () => {
    if (!selectedInventoryId) return;
    setIsUpdating(true);
    const invItem = product?.inventory.find((i) => i.id === selectedInventoryId);
    if (!invItem) { setIsUpdating(false); return; }

    const newQty = Math.max(0, invItem.quantity + adjustment);
    try {
      await inventoryApi.update(selectedInventoryId, { quantity: newQty, notes });
      setSuccessMsg(`Cập nhật thành công! Tồn kho mới: ${newQty} ${product?.unit}`);
      setScanState("success");
    } catch {
      setScanState("error");
    } finally {
      setIsUpdating(false);
    }
  };

  const selectedInv = product?.inventory.find((i) => i.id === selectedInventoryId);
  const newQty = selectedInv ? Math.max(0, selectedInv.quantity + adjustment) : 0;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
        >
          <QrCode size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Kiểm kho QR
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Quét mã QR để cập nhật số lượng tồn kho
          </p>
        </div>
      </div>

      {/* Scanner area */}
      {scanState === "idle" || scanState === "scanning" ? (
        <div className="card overflow-hidden">
          {/* Camera viewport */}
          <div
            id="qr-reader-area"
            className="relative flex items-center justify-center overflow-hidden"
            style={{ background: "#0d1117", minHeight: "260px" }}
          >
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            {/* Idle overlay */}
            {scanState === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(249,115,22,0.2)", border: "2px dashed #f97316" }}
                >
                  <Camera size={30} className="sm:w-9 sm:h-9" style={{ color: "#f97316" }} />
                </div>
                <p className="text-white text-xs sm:text-sm font-medium">Camera chưa bật</p>
                <p className="text-gray-400 text-[10px] sm:text-xs">Nhấn nút bên dưới để bắt đầu</p>
              </div>
            )}

            {/* Scanning overlay */}
            {scanState === "scanning" && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Scan frame - responsive size */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-56 sm:h-56">
                  <div className="absolute top-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-l-4 border-orange-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-r-4 border-orange-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-l-4 border-orange-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-r-4 border-orange-400 rounded-br" />
                  {/* Scanning line */}
                  <div
                    className="absolute w-full h-0.5"
                    style={{
                      background: "linear-gradient(90deg,transparent,#f97316,transparent)",
                      animation: "scan-line 2s linear infinite",
                      top: "50%",
                    }}
                  />
                </div>
                <p className="absolute bottom-3 sm:bottom-4 inset-x-0 text-center text-white text-[11px] sm:text-sm opacity-80">
                  Hướng camera vào mã QR
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
            {cameraError && (
              <div className="flex items-center gap-2 text-xs sm:text-sm p-2.5 sm:p-3 rounded-lg" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <AlertCircle size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                id="start-camera"
                onClick={scanState === "scanning" ? stopCamera : startCamera}
                className={`btn flex-1 justify-center text-xs sm:text-sm ${scanState === "scanning" ? "btn-secondary" : "btn-primary"}`}
                style={{ height: "42px" }}
              >
                {scanState === "scanning" ? (
                  <><X size={16} /> Dừng</>
                ) : (
                  <><Camera size={16} /> Bật camera</>
                )}
              </button>

              {/* Manual input - compact on mobile */}
              <div className="flex-1 flex gap-1.5">
                <input
                  value={manualQr}
                  onChange={(e) => setManualQr(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                  placeholder="Mã QR..."
                  className="input-base text-xs sm:text-sm flex-1 min-w-0"
                  style={{ height: "42px" }}
                />
                <button onClick={handleManualLookup} className="btn btn-secondary px-3" style={{ height: "42px", flexShrink: 0 }}>
                  <Scan size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : scanState === "notfound" ? (
        <div className="card p-6 sm:p-8 text-center space-y-3">
          <AlertCircle size={40} className="mx-auto" style={{ color: "#ef4444" }} />
          <h3 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>Không tìm thấy sản phẩm</h3>
          <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
            Mã QR này không khớp với sản phẩm nào trong hệ thống.
          </p>
          <button onClick={handleReset} className="btn btn-primary btn-sm"><RotateCcw size={14} /> Quét lại</button>
        </div>
      ) : scanState === "success" ? (
        <div className="card p-6 sm:p-8 text-center space-y-3">
          <CheckCircle size={40} className="mx-auto" style={{ color: "#10b981" }} />
          <h3 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>Cập nhật thành công!</h3>
          <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>{successMsg}</p>
          <button onClick={handleReset} className="btn btn-primary btn-sm"><RotateCcw size={14} /> Kiểm kho tiếp</button>
        </div>
      ) : null}

      {/* Product found — update form */}
      {(scanState === "found" || scanState === "error") && product && (
        <div className="space-y-3 sm:space-y-4 animate-scale-in">
          {/* Product info card */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#fff7ed" }}
              >
                <Package size={18} className="sm:w-[22px] sm:h-[22px]" style={{ color: "#f97316" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base truncate" style={{ color: "var(--text-primary)" }}>{product.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <code className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                        {product.sku}
                      </code>
                      <span className="text-[10px] sm:text-xs" style={{ color: "var(--text-muted)" }}>
                        {getCategoryLabel(product.category)}
                      </span>
                    </div>
                  </div>
                  <button onClick={handleReset} className="btn-icon shrink-0" title="Quét lại">
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory selection */}
          {product.inventory.length > 1 && (
            <div className="card p-3 sm:p-4">
              <label className="block text-xs sm:text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                Chọn vị trí kho
              </label>
              <select
                value={selectedInventoryId}
                onChange={(e) => setSelectedInventoryId(e.target.value)}
                className="input-base text-xs sm:text-sm"
              >
                {product.inventory.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.warehouse.code} — Tồn: {inv.quantity} {product.unit}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Update form */}
          {selectedInv && (
            <div className="card p-4 sm:p-5 space-y-4 sm:space-y-5">
              <h3 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                Cập nhật — {selectedInv.warehouse.code}
              </h3>

              {/* Current qty display */}
              <div className="rounded-xl p-3 sm:p-4 text-center" style={{ background: "var(--bg-input)" }}>
                <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                  Hiện tại → Sau cập nhật
                </div>
                <div className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{selectedInv.quantity}</span>
                  {" → "}
                  <span style={{ color: newQty < product.minStockLevel ? "#ef4444" : "#10b981" }}>
                    {newQty}
                  </span>
                  <span className="text-sm sm:text-base font-normal" style={{ color: "var(--text-muted)" }}> {product.unit}</span>
                </div>
                {newQty < product.minStockLevel && (
                  <div className="text-[10px] sm:text-xs mt-1" style={{ color: "#ef4444" }}>
                    Dưới mức tối thiểu ({product.minStockLevel} {product.unit})
                  </div>
                )}
              </div>

              {/* Adjustment controls */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{ color: "var(--text-primary)" }}>
                  Điều chỉnh số lượng
                </label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setAdjustment((a) => a - 1)}
                    disabled={newQty <= 0}
                    className="btn btn-secondary w-9 h-9 sm:w-10 sm:h-10 p-0"
                  >
                    <Minus size={14} className="sm:w-4 sm:h-4" />
                  </button>
                  <input
                    type="number"
                    value={adjustment}
                    onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                    className="input-base text-center font-bold text-base sm:text-lg flex-1"
                    style={{ height: "40px" }}
                  />
                  <button
                    onClick={() => setAdjustment((a) => a + 1)}
                    className="btn btn-primary w-9 h-9 sm:w-10 sm:h-10 p-0"
                  >
                    <Plus size={14} className="sm:w-4 sm:h-4" />
                  </button>
                </div>
                {/* Quick adjust buttons - scrollable on mobile */}
                <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                  {[-10, -5, -1, +1, +5, +10].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAdjustment((a) => Math.max(-selectedInv.quantity, a + v))}
                      className="btn btn-ghost btn-xs flex-shrink-0 px-3"
                    >
                      {v > 0 ? "+" : ""}{v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  Ghi chú kiểm kho
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú..."
                  rows={2}
                  className="input-base text-xs sm:text-sm resize-none"
                />
              </div>

              {scanState === "error" && (
                <div className="text-xs sm:text-sm p-2.5 sm:p-3 rounded-lg" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                  Cập nhật thất bại. Vui lòng thử lại.
                </div>
              )}

              <button
                id="update-inventory"
                onClick={handleUpdateInventory}
                disabled={isUpdating || adjustment === 0}
                className="btn btn-primary w-full justify-center py-2.5 sm:py-3 text-xs sm:text-sm"
              >
                {isUpdating
                  ? <><Loader2 size={16} className="animate-spin" /> Đang cập nhật...</>
                  : <><Save size={16} /> Lưu cập nhật tồn kho</>
                }
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes scan-line {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}
