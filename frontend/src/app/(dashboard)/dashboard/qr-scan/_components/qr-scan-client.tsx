"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  QrCode, Camera, CheckCircle, AlertCircle, Loader2,
  Package, RotateCcw, Minus, Plus, Save, X,
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

      // Dynamic import html5-qrcode
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-area");

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
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
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
          Kiểm kho bằng QR Code
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Quét mã QR để tìm sản phẩm và cập nhật số lượng tồn kho
        </p>
      </div>

      {/* Scanner area */}
      {scanState === "idle" || scanState === "scanning" ? (
        <div className="card overflow-hidden">
          {/* Camera view */}
          <div
            id="qr-reader-area"
            className="relative flex items-center justify-center"
            style={{ background: "#0d1117", minHeight: "320px" }}
          >
            <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-80 object-cover" />

            {scanState === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(249,115,22,0.2)", border: "2px dashed #f97316" }}
                >
                  <Camera size={36} style={{ color: "#f97316" }} />
                </div>
                <p className="text-white text-sm font-medium">Camera chưa bật</p>
              </div>
            )}

            {scanState === "scanning" && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Scan frame */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-400 rounded-br" />
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
                <p className="absolute bottom-4 inset-x-0 text-center text-white text-sm opacity-80">
                  Hướng camera vào mã QR
                </p>
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            {cameraError && (
              <div className="flex items-center gap-2 text-sm p-3 rounded-lg dark:bg-red-900/30 dark:text-red-400" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <AlertCircle size={16} /> {cameraError}
              </div>
            )}

            <button
              id="start-camera"
              onClick={scanState === "scanning" ? stopCamera : startCamera}
              className={`btn w-full btn-lg ${scanState === "scanning" ? "btn-secondary" : "btn-primary"}`}
            >
              {scanState === "scanning" ? (
                <><X size={18} /> Dừng quét</>
              ) : (
                <><Camera size={18} /> Bật camera quét QR</>
              )}
            </button>

            {/* Manual input */}
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  value={manualQr}
                  onChange={(e) => setManualQr(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                  placeholder="Hoặc nhập mã QR thủ công (LOGISTIQ-...)"
                  className="input-base text-sm"
                  style={{ height: "42px" }}
                />
              </div>
              <button onClick={handleManualLookup} className="btn btn-secondary" style={{ height: "42px" }}>
                <QrCode size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : scanState === "notfound" ? (
        <div className="card p-8 text-center space-y-3">
          <AlertCircle size={48} className="mx-auto" style={{ color: "#ef4444" }} />
          <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Không tìm thấy sản phẩm</h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Mã QR này không khớp với sản phẩm nào trong hệ thống.
          </p>
          <button onClick={handleReset} className="btn btn-primary"><RotateCcw size={16} /> Quét lại</button>
        </div>
      ) : scanState === "success" ? (
        <div className="card p-8 text-center space-y-3">
          <CheckCircle size={48} className="mx-auto" style={{ color: "#10b981" }} />
          <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Cập nhật thành công!</h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{successMsg}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={handleReset} className="btn btn-primary"><RotateCcw size={16} /> Kiểm kho tiếp</button>
          </div>
        </div>
      ) : null}

      {/* Product found — update form */}
      {(scanState === "found" || scanState === "error") && product && (
        <div className="space-y-4 animate-scale-in">
          {/* Product info */}
          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#fff7ed" }}
              >
                <Package size={22} style={{ color: "#f97316" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>{product.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                        {product.sku}
                      </code>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {getCategoryLabel(product.category)}
                      </span>
                    </div>
                  </div>
                  <button onClick={handleReset} className="btn-icon">
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory selection */}
          {product.inventory.length > 1 && (
            <div className="card p-4">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                Chọn vị trí kho
              </label>
              <select
                value={selectedInventoryId}
                onChange={(e) => setSelectedInventoryId(e.target.value)}
                className="input-base text-sm"
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
            <div className="card p-5 space-y-5">
              <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>
                Cập nhật số lượng — {selectedInv.warehouse.code}
              </h3>

              {/* Current qty display */}
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: "var(--bg-input)" }}
              >
                <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                  Hiện tại → Sau cập nhật
                </div>
                <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{selectedInv.quantity}</span>
                  {" → "}
                  <span style={{ color: newQty < product.minStockLevel ? "#ef4444" : "#10b981" }}>
                    {newQty}
                  </span>
                  {" "}
                  <span className="text-base font-normal" style={{ color: "var(--text-muted)" }}>{product.unit}</span>
                </div>
                {newQty < product.minStockLevel && (
                  <div className="text-xs mt-1" style={{ color: "#ef4444" }}>
                    ⚠️ Dưới mức tối thiểu ({product.minStockLevel} {product.unit})
                  </div>
                )}
              </div>

              {/* Adjustment controls */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                  Điều chỉnh số lượng
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAdjustment((a) => a - 1)}
                    disabled={newQty <= 0}
                    className="btn btn-secondary w-10 h-10 p-0"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    value={adjustment}
                    onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                    className="input-base text-center font-bold text-lg flex-1"
                    style={{ height: "44px" }}
                  />
                  <button
                    onClick={() => setAdjustment((a) => a + 1)}
                    className="btn btn-primary w-10 h-10 p-0"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  {[-10, -5, -1, +1, +5, +10].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAdjustment((a) => Math.max(-selectedInv.quantity, a + v))}
                      className="flex-1 btn btn-ghost btn-sm text-xs"
                    >
                      {v > 0 ? "+" : ""}{v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                  Ghi chú kiểm kho
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Kiểm kho định kỳ tháng 5, hàng nhập mới..."
                  rows={3}
                  className="input-base text-sm resize-none"
                />
              </div>

              {scanState === "error" && (
                <div className="text-sm p-3 rounded-lg dark:bg-red-900/30 dark:text-red-400" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                  Cập nhật thất bại. Vui lòng thử lại.
                </div>
              )}

              <button
                id="update-inventory"
                onClick={handleUpdateInventory}
                disabled={isUpdating || adjustment === 0}
                className="btn btn-primary w-full btn-lg"
              >
                {isUpdating
                  ? <><Loader2 size={18} className="animate-spin" /> Đang cập nhật...</>
                  : <><Save size={18} /> Lưu cập nhật tồn kho</>
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
