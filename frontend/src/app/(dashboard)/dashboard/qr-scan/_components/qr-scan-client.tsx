"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  QrCode, Camera, CheckCircle, AlertCircle, Loader2,
  Package, RotateCcw, Minus, Plus, Save, X, Scan,
  Barcode, PlusCircle,
  ArrowRight,
} from "lucide-react";
import { productsApi, inventoryApi } from "@/lib/api";
import { getCategoryLabel } from "@/lib/utils";

type ScanMode = "QR_CODE" | "BARCODE";

interface ScannedProduct {
  id: string; name: string; sku: string; category: string;
  unit: string; minStockLevel: number; qrCode?: string; barcode?: string;
  inventory: { id: string; quantity: number; warehouse: { name: string; code: string } }[];
}

type ScanState = "idle" | "scanning" | "found" | "new_product" | "updating" | "success" | "error";

const CATEGORIES = [
  "ELECTRONICS", "CLOTHING", "FOOD", "FURNITURE",
  "MEDICAL", "AUTOMOTIVE", "CHEMICAL", "OTHER",
];

export default function QRScanClient() {
  const searchParams = useSearchParams();
  const preloadId = searchParams.get("productId");
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    start: (
      config: Record<string, unknown>,
      options: Record<string, unknown>,
      onSuccess: (text: string) => void,
      onFailure: () => void
    ) => Promise<void>;
  } | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanMode, setScanMode] = useState<ScanMode>("QR_CODE");
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [adjustment, setAdjustment] = useState(0);
  const [notes, setNotes] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // New product form state
  const [newBarcode, setNewBarcode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSku, setNewSku] = useState("");
  const [newCategory, setNewCategory] = useState("OTHER");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newMinStockLevel, setNewMinStockLevel] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Hàm cleanup đồng bộ
  const destroyScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => () => { destroyScanner(); }, [destroyScanner]);

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

  // Tra cứu sản phẩm theo code
  const lookupProduct = useCallback(async (code: string) => {
    if (scanMode === "QR_CODE") {
      return productsApi.getByQR(code);
    } else {
      return productsApi.getByBarcode(code);
    }
  }, [scanMode]);

  const handleScanResult = useCallback(async (code: string) => {
    setScanState("scanning");
    try {
      const res = await lookupProduct(code);
      const p = res.data.data as ScannedProduct;
      setProduct(p);
      setScanState("found");
      if (p.inventory?.[0]) setSelectedInventoryId(p.inventory[0].id);
    } catch {
      // Không tìm thấy → chuyển sang form tạo sản phẩm mới với mã đã điền sẵn
      setNewBarcode(code);
      setNewSku("");
      setNewName("");
      setNewCategory("OTHER");
      setNewUnit("pcs");
      setNewMinStockLevel(10);
      setCreateError("");
      setScanState("new_product");
    }
  }, [lookupProduct]);

  // Tự động sinh SKU từ barcode nếu người dùng chưa nhập
  const generateSku = useCallback(() => {
    if (!newSku.trim() && newBarcode) {
      setNewSku(`SP-${newBarcode}`);
    }
  }, [newSku, newBarcode]);

  // Lưu sản phẩm mới
  const handleCreateProduct = async () => {
    if (!newName.trim()) return;
    setCreateError("");
    setIsCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: newName.trim(),
        sku: newSku.trim() || `SP-${newBarcode}`,
        qrCode: scanMode === "QR_CODE" ? newBarcode : undefined,
        barcode: scanMode === "BARCODE" ? newBarcode : undefined,
        category: newCategory,
        unit: newUnit,
        minStockLevel: newMinStockLevel,
      };
      const res = await productsApi.create(payload);
      const createdProduct = res.data.data as ScannedProduct;

      // Fetch lại với inventory để có đủ thông tin
      const detailRes = await productsApi.getById(createdProduct.id);
      const p = detailRes.data.data as ScannedProduct;
      setProduct(p);
      setScanState("found");
      if (p.inventory?.[0]) setSelectedInventoryId(p.inventory[0].id);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setCreateError(apiErr?.response?.data?.message || "Không thể tạo sản phẩm. Vui lòng thử lại.");
    } finally {
      setIsCreating(false);
    }
  };

  // Lấy formatsToSupport
  const getFormatsConfig = useCallback(async () => {
    const { Html5QrcodeSupportedFormats } = await import("html5-qrcode");
    if (scanMode === "QR_CODE") {
      return [Html5QrcodeSupportedFormats.QR_CODE];
    }
    return [
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.CODABAR,
      Html5QrcodeSupportedFormats.PDF_417,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
      Html5QrcodeSupportedFormats.AZTEC,
    ];
  }, [scanMode]);

  const startCamera = async () => {
    setCameraError("");
    setScanState("scanning");
    try {
      destroyScanner();

      const { Html5Qrcode } = await import("html5-qrcode");
      const formatsToSupport = await getFormatsConfig();
      const scanner = new Html5Qrcode("qr-reader-area", { formatsToSupport, verbose: false });
      scannerRef.current = scanner;

      const qrbox = scanMode === "QR_CODE"
        ? { width: 260, height: 260 }
        : { width: 400, height: 150 }; // Barcode cần qrbox rộng, tỷ lệ ~2.7:1

      await scanner.start(
        { facingMode: "environment" },
        { fps: scanMode === "QR_CODE" ? 10 : 20, qrbox },
        (decodedText) => {
          destroyScanner();
          handleScanResult(decodedText);
        },
        () => {}
      );
    } catch (err: unknown) {
      console.warn((err as Error)?.message || err);
      setCameraError("Không thể truy cập camera. Vui lòng cho phép quyền camera.");
      setScanState("idle");
    }
  };

  const stopCamera = async () => {
    destroyScanner();
  };

  const handleReset = () => {
    destroyScanner();
    setProduct(null);
    setScanState("idle");
    setAdjustment(0);
    setNotes("");
    setManualCode("");
    setSuccessMsg("");
    setSelectedInventoryId("");
    setNewBarcode("");
    setNewName("");
    setNewSku("");
    setNewCategory("OTHER");
    setNewUnit("pcs");
    setNewMinStockLevel(10);
    setCreateError("");
  };

  const handleManualLookup = async () => {
    if (!manualCode.trim()) return;
    destroyScanner();
    setScanState("scanning");
    await handleScanResult(manualCode.trim());
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

  const handleModeChange = (mode: ScanMode) => {
    if (mode === scanMode) return;
    destroyScanner();
    setScanState("idle");
    setScanMode(mode);
    setCameraError("");
  };

  const selectedInv = product?.inventory.find((i) => i.id === selectedInventoryId);
  const newQty = selectedInv ? Math.max(0, selectedInv.quantity + adjustment) : 0;

  const isScanning = scanState === "idle" || scanState === "scanning";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
        >
          <QrCode size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Kiểm kho
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {scanMode === "QR_CODE"
              ? "Quét mã QR để cập nhật số lượng tồn kho"
              : "Quét mã vạch để cập nhật số lượng tồn kho"}
          </p>
        </div>
      </div>

      {/* Scan mode selector */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: "var(--bg-input)", width: "fit-content" }}>
        <button
          onClick={() => handleModeChange("QR_CODE")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            scanMode === "QR_CODE"
              ? "text-white shadow-sm"
              : "hover:bg-(--bg-card)"
          }`}
          style={scanMode === "QR_CODE" ? { background: "linear-gradient(135deg, #f97316, #ea580c)" } : { color: "var(--text-secondary)" }}
        >
          <QrCode size={15} />
          QR Code
        </button>
        <button
          onClick={() => handleModeChange("BARCODE")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            scanMode === "BARCODE"
              ? "text-white shadow-sm"
              : "hover:bg-(--bg-card)"
          }`}
          style={scanMode === "BARCODE" ? { background: "linear-gradient(135deg, #6366f1, #4f46e5)" } : { color: "var(--text-secondary)" }}
        >
          <Barcode size={15} />
          Barcode
        </button>
      </div>

      {/* Scanner area */}
      {isScanning ? (
        <div className="card overflow-hidden">
          {/* Camera viewport */}
          <div className="relative" style={{ minHeight: "260px", background: "#0d1117" }}>
            <div id="qr-reader-area" className="w-full" style={{ minHeight: "260px" }} />

            {scanState === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ pointerEvents: "none" }}>
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: scanMode === "QR_CODE" ? "rgba(249,115,22,0.2)" : "rgba(99,102,241,0.2)", border: `2px dashed ${scanMode === "QR_CODE" ? "#f97316" : "#6366f1"}` }}
                >
                  {scanMode === "QR_CODE" ? (
                    <Camera size={30} className="sm:w-9 sm:h-9" style={{ color: "#f97316" }} />
                  ) : (
                    <Barcode size={30} className="sm:w-9 sm:h-9" style={{ color: "#6366f1" }} />
                  )}
                </div>
                <p className="text-white text-xs sm:text-sm font-medium">
                  {scanMode === "QR_CODE" ? "Camera QR chưa bật" : "Camera barcode chưa bật"}
                </p>
                <p className="text-gray-400 text-[10px] sm:text-xs">Nhấn nút bên dưới để bắt đầu</p>
              </div>
            )}

            {scanState === "scanning" && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{
                width: scanMode === "QR_CODE" ? "12rem" : "18rem",
                height: scanMode === "QR_CODE" ? "12rem" : "7rem",
                maxWidth: "85vw",
              }}>
                  <div className="absolute top-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-l-4 rounded-tl"
                    style={{ borderColor: scanMode === "QR_CODE" ? "#f97316" : "#6366f1" }} />
                  <div className="absolute top-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-r-4 rounded-tr"
                    style={{ borderColor: scanMode === "QR_CODE" ? "#f97316" : "#6366f1" }} />
                  <div className="absolute bottom-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-l-4 rounded-bl"
                    style={{ borderColor: scanMode === "QR_CODE" ? "#f97316" : "#6366f1" }} />
                  <div className="absolute bottom-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-r-4 rounded-br"
                    style={{ borderColor: scanMode === "QR_CODE" ? "#f97316" : "#6366f1" }} />
                  <div
                    className="absolute w-full h-0.5"
                    style={{
                      background: `linear-gradient(90deg,transparent,${scanMode === "QR_CODE" ? "#f97316" : "#6366f1"},transparent)`,
                      animation: "scan-line 2s linear infinite",
                      top: "50%",
                    }}
                  />
                </div>
                <p className="absolute bottom-3 sm:bottom-4 inset-x-0 text-center text-white text-[11px] sm:text-sm opacity-80">
                  {scanMode === "QR_CODE" ? "Hướng camera vào mã QR" : "Hướng camera vào mã vạch"}
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
            {cameraError && (
              <div className="flex items-center gap-2 text-xs sm:text-sm p-2.5 sm:p-3 rounded-lg" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <AlertCircle size={14} className="sm:w-4 sm:h-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                id="start-camera"
                onClick={async () => {
                  if (scanState === "scanning") {
                    await stopCamera();
                    setScanState("idle");
                  } else {
                    await startCamera();
                  }
                }}
                className={`btn flex-1 justify-center text-xs sm:text-sm ${scanState === "scanning" ? "btn-secondary" : "btn-primary"}`}
                style={{ height: "42px" }}
              >
                {scanState === "scanning" ? (
                  <><X size={16} /> Dừng</>
                ) : (
                  <><Camera size={16} /> Bật camera</>
                )}
              </button>

              <div className="flex-1 flex gap-1.5">
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                  placeholder={scanMode === "QR_CODE" ? "Mã QR..." : "Mã vạch..."}
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
      ) : scanState === "new_product" ? (
        /* ─── Form tạo sản phẩm mới ─── */
        <div className="space-y-4 animate-scale-in">
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#eef2ff" }}
              >
                <PlusCircle size={20} className="sm:w-6 sm:h-6" style={{ color: "#6366f1" }} />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                  Sản phẩm mới
                </h2>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                  Mã này chưa có trong hệ thống. Vui lòng nhập thông tin sản phẩm.
                </p>
              </div>
            </div>

            {createError && (
              <div className="flex items-center gap-2 text-xs sm:text-sm p-2.5 sm:p-3 mb-4 rounded-lg" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <AlertCircle size={14} className="shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Mã quét được (pre-filled, readonly) */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  {scanMode === "QR_CODE" ? "Mã QR" : "Mã vạch"}
                </label>
                <div className="input-base text-sm flex items-center gap-2" style={{ opacity: 0.7 }}>
                  {scanMode === "QR_CODE" ? <QrCode size={14} /> : <Barcode size={14} />}
                  <span className="font-mono">{newBarcode}</span>
                </div>
              </div>

              {/* Tên sản phẩm */}
              <div>
                <label htmlFor="new-product-name" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Tên sản phẩm <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="new-product-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Bóng đèn LED 12W"
                  className="input-base text-sm"
                  autoFocus
                />
              </div>

              {/* SKU */}
              <div>
                <label htmlFor="new-product-sku" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Mã SKU
                </label>
                <input
                  id="new-product-sku"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  onBlur={generateSku}
                  placeholder={`SP-${newBarcode}`}
                  className="input-base text-sm"
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Để trống để tự động sinh từ mã {scanMode === "QR_CODE" ? "QR" : "vạch"}
                </p>
              </div>

              {/* Category + Unit row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-product-category" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Danh mục
                  </label>
                  <select
                    id="new-product-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="input-base text-sm"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="new-product-unit" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Đơn vị
                  </label>
                  <select
                    id="new-product-unit"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="input-base text-sm"
                  >
                    {["pcs", "kg", "box", "liter", "m", "pair", "set"].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Min stock level */}
              <div>
                <label htmlFor="new-product-min-stock" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Tồn kho tối thiểu
                </label>
                <input
                  id="new-product-min-stock"
                  type="number"
                  min={0}
                  value={newMinStockLevel}
                  onChange={(e) => setNewMinStockLevel(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input-base text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleReset} className="btn btn-secondary flex-1 justify-center">
                  <X size={14} /> Hủy
                </button>
                <button
                  onClick={handleCreateProduct}
                  disabled={isCreating || !newName.trim()}
                  className="btn btn-primary flex-1 justify-center"
                >
                  {isCreating
                    ? <><Loader2 size={14} className="animate-spin" /> Đang tạo...</>
                    : <><Save size={14} /> Lưu sản phẩm</>
                  }
                </button>
              </div>
            </div>
          </div>
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
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#fff7ed" }}
              >
                <Package size={18} className="sm:w-5.5 sm:h-5.5" style={{ color: "#f97316" }} />
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
                      {product.barcode && (
                        <code className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                          {product.barcode}
                        </code>
                      )}
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

              <div className="rounded-xl p-3 sm:p-4 text-center" style={{ background: "var(--bg-input)" }}>
                <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                  Hiện tại <ArrowRight size={14} className="inline" style={{ color: "var(--text-muted)" }} /> Sau cập nhật
                </div>
                <div className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{selectedInv.quantity}</span>
                  <ArrowRight size={14} className="inline mx-1" style={{ color: "var(--text-muted)" }} />
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
                <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                  {[-10, -5, -1, +1, +5, +10].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAdjustment((a) => Math.max(-selectedInv.quantity, a + v))}
                      className="btn btn-ghost btn-xs shrink-0 px-3"
                    >
                      {v > 0 ? "+" : ""}{v}
                    </button>
                  ))}
                </div>
              </div>

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
