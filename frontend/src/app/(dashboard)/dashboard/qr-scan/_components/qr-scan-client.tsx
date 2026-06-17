"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  QrCode, Camera, CheckCircle, AlertCircle, Loader2,
  Package, RotateCcw, Minus, Plus, Save, X, Scan,
  Barcode, PlusCircle,
  ArrowRight, Warehouse,
} from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { productsApi, inventoryApi, warehousesApi } from "@/lib/api";
import { getCategoryLabel } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";

type ScanMode = "QR_CODE" | "BARCODE";

interface ScannedProduct {
  id: string; name: string; sku: string; category: string;
  unit: string; minStockLevel: number; qrCode?: string; barcode?: string;
}

/** Inventory record từ inventoryApi (đã được backend filter theo role) */
interface InventoryRecord {
  id: string;
  quantity: number;
  warehouse: { id: string; name: string; code: string };
  zone?: { id: string; name: string; description?: string | null } | null;
  rack?: string | null;
  shelf?: string | null;
}

type ScanState = "idle" | "scanning" | "found" | "new_product" | "add_inventory" | "updating" | "success" | "error";

export default function QRScanClient() {
  const searchParams = useSearchParams();
  const preloadId = searchParams.get("productId");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanMode, setScanMode] = useState<ScanMode>("QR_CODE");
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [inventoryRecords, setInventoryRecords] = useState<InventoryRecord[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [adjustment, setAdjustment] = useState(0);
  const [notes, setNotes] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCheckingInventory, setIsCheckingInventory] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const { assignedWarehouses, isStaffOnly } = useAuth();

  // New product form state
  const [newProductName, setNewProductName] = useState("");
  const [newBarcode, setNewBarcode] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newMinStockLevel, setNewMinStockLevel] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Add inventory state (after creating new product)
  const [editProductName, setEditProductName] = useState("");
  const [initWarehouseId, setInitWarehouseId] = useState("");
  const [initQuantity, setInitQuantity] = useState(1);
  const [initZone, setInitZone] = useState("");
  const [initRack, setInitRack] = useState("");
  const [initShelf, setInitShelf] = useState("");
  const [initNotes, setInitNotes] = useState("");
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [isAddingInventory, setIsAddingInventory] = useState(false);
  const [addInventoryError, setAddInventoryError] = useState("");

  /**
   * Tra cứu inventory của product thông qua inventoryApi (backend tự động lọc theo role):
   * - ADMIN: xem tất cả inventory
   * - STAFF: chỉ xem inventory trong kho được phân quyền
   */
  const lookupInventory = useCallback(async (productId: string): Promise<InventoryRecord[]> => {
    try {
      const res = await inventoryApi.getAll({ productId, limit: "50" });
      return (res.data.data || []) as InventoryRecord[];
    } catch {
      return [];
    }
  }, []);

  // Hàm cleanup đồng bộ
  const destroyScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => () => { destroyScanner(); }, [destroyScanner]);

  // Pre-load from URL param — gọi inventoryApi để backend tự filter theo role
  useEffect(() => {
    if (preloadId) {
      setIsCheckingInventory(true);
      productsApi.getById(preloadId).then(async (res) => {
        const p = res.data.data as ScannedProduct;
        setProduct(p);
        setScanState("found");
        // Dùng inventoryApi thay vì product.inventory — backend tự filter theo role
        const records = await lookupInventory(p.id);
        setInventoryRecords(records);
        if (records[0]) setSelectedInventoryId(records[0].id);
      }).catch(() => {}).finally(() => {
        setIsCheckingInventory(false);
      });
    }
  }, [preloadId, lookupInventory]);

  // Sync editProductName when product changes on found state
  useEffect(() => {
    if (product && scanState === "found") {
      setEditProductName(product.name);
    }
  }, [product, scanState]);

  // Load warehouse list on mount / user load if not staff only
  useEffect(() => {
    if (!isStaffOnly && warehouses.length === 0) {
      warehousesApi.getAll().then((res) => {
        const whList = (res.data.data || []) as { id: string; name: string; code: string }[];
        setWarehouses(whList);
      }).catch(() => {});
    }
  }, [isStaffOnly, warehouses.length]);

  // Set default initWarehouseId when warehouses or assignedWarehouses are available
  useEffect(() => {
    if (!initWarehouseId) {
      if (isStaffOnly && assignedWarehouses.length > 0) {
        setInitWarehouseId(assignedWarehouses[0].id);
      } else if (!isStaffOnly && warehouses.length > 0) {
        setInitWarehouseId(warehouses[0].id);
      }
    }
  }, [initWarehouseId, isStaffOnly, assignedWarehouses, warehouses]);

  // Pre-populate warehouse details when entering "found" with no inventory in accessible warehouses
  useEffect(() => {
    if (scanState === "found" && product && inventoryRecords.length === 0) {
      setInitQuantity(1);
    }
  }, [scanState, product, inventoryRecords]);

  const lookupProduct = useCallback(async (code: string) => {
    if (scanMode === "QR_CODE") {
      return productsApi.getByQR(code);
    } else {
      return productsApi.getByBarcode(code);
    }
  }, [scanMode]);

  // Try to find a product by a scanned code using QR, barcode, and SKU lookups
  const findProductByCode = useCallback(async (code: string): Promise<ScannedProduct | null> => {
    // Try 1: exact match by QR code
    try {
      const res = await productsApi.getByQR(code);
      return res.data.data as ScannedProduct;
    } catch { /* not found by QR */ }
    // Try 2: exact match by barcode
    try {
      const res = await productsApi.getByBarcode(code);
      return res.data.data as ScannedProduct;
    } catch { /* not found by barcode */ }
    // Try 3: search by SKU hoặc tên sản phẩm
    try {
      const searchRes = await productsApi.getAll({ search: code, limit: "10" });
      const list = (searchRes.data.data || []) as ScannedProduct[];
      if (list.length > 0) {
        // Get full detail for the first match
        const detailRes = await productsApi.getById(list[0].id);
        return detailRes.data.data as ScannedProduct;
      }
    } catch { /* search failed */ }
    return null;
  }, []);

  const handleScanResult = useCallback(async (code: string) => {
    setScanState("scanning");
    setIsCheckingInventory(true);
    try {
      const res = await lookupProduct(code);
      const p = res.data.data as ScannedProduct;
      setProduct(p);
      setScanState("found");
      // Tra cứu inventory qua inventoryApi — backend tự filter theo role
      const records = await lookupInventory(p.id);
      setInventoryRecords(records);
      if (records[0]) setSelectedInventoryId(records[0].id);
    } catch {
      // Primary lookup failed — try the other scan method before giving up
      const fallback = await findProductByCode(code);
      if (fallback) {
        setProduct(fallback);
        setScanState("found");
        // Tra cứu inventory qua inventoryApi — backend tự filter theo role
        const records = await lookupInventory(fallback.id);
        setInventoryRecords(records);
        if (records[0]) setSelectedInventoryId(records[0].id);
      } else {
        // Không tìm thấy → chuyển sang form nhập tên, số lượng & mức cảnh báo
        setNewProductName("");
        setNewBarcode(code);
        setNewQuantity(1);
        setNewMinStockLevel(10);
        setCreateError("");
        setScanState("new_product");
      }
    } finally {
      setIsCheckingInventory(false);
    }
  }, [lookupProduct, findProductByCode, lookupInventory]);

  // Lưu sản phẩm mới + thêm vào kho — tự động sinh tên/SKU, chỉ cần số lượng & mức cảnh báo
  const handleCreateProduct = async () => {
    setCreateError("");

    // Ensure warehouse ID is set before proceeding
    let whId = initWarehouseId;
    if (!whId) {
      if (isStaffOnly && assignedWarehouses.length > 0) {
        whId = assignedWarehouses[0].id;
        setInitWarehouseId(whId);
      } else if (warehouses.length > 0) {
        whId = warehouses[0].id;
        setInitWarehouseId(whId);
      } else {
        // Try to fetch warehouses
        try {
          const whRes = await warehousesApi.getAll();
          const whList = (whRes.data.data || []) as { id: string; name: string; code: string }[];
          setWarehouses(whList);
          if (whList.length > 0) {
            whId = whList[0].id;
            setInitWarehouseId(whId);
          }
        } catch { /* ignore */ }
      }
    }

    if (!whId) {
      setCreateError("Vui lòng chọn kho lưu trữ.");
      return;
    }

    setIsCreating(true);
    try {
      const productName = newProductName.trim() || `Sản phẩm - ${newBarcode}`;
      const autoSku = `SP-${newBarcode}`;
      const payload: Record<string, unknown> = {
        name: productName,
        sku: autoSku,
        qrCode: scanMode === "QR_CODE" ? newBarcode : undefined,
        barcode: scanMode === "BARCODE" ? newBarcode : undefined,
        category: "OTHER",
        unit: "pcs",
        minStockLevel: newMinStockLevel,
      };
      const res = await productsApi.create(payload);
      const createdProduct = res.data.data as ScannedProduct;

      // Create inventory record in one step
      await inventoryApi.create({
        productId: createdProduct.id,
        warehouseId: whId,
        quantity: newQuantity,
      });

      // Fetch full detail with inventory — dùng inventoryApi để backend tự filter theo role
      const records = await lookupInventory(createdProduct.id);
      setProduct({ id: createdProduct.id, name: createdProduct.name, sku: createdProduct.sku, category: createdProduct.category, unit: createdProduct.unit, minStockLevel: createdProduct.minStockLevel });
      setInventoryRecords(records);
      setSuccessMsg(`Tạo sản phẩm thành công! Tồn kho: ${newQuantity} pcs`);
      setScanState("success");
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string } } };

      // 409 = SKU/barcode already exists → try to find and show the existing product
      if (apiErr?.response?.status === 409) {
        setIsCheckingInventory(true);
        try {
          const existingProduct = await findProductByCode(newBarcode);
          if (existingProduct) {
            setProduct(existingProduct);
            setScanState("found");
            const records = await lookupInventory(existingProduct.id);
            setInventoryRecords(records);
            if (records[0]) setSelectedInventoryId(records[0].id);
            setIsCreating(false);
            return;
          }
          // If can't find by QR/barcode, try searching by auto-generated SKU
          try {
            const searchRes = await productsApi.getAll({ search: `SP-${newBarcode}`, limit: "5" });
            const list = (searchRes.data.data || []) as ScannedProduct[];
            if (list.length > 0) {
              const detailRes = await productsApi.getById(list[0].id);
              const foundProduct = detailRes.data.data as ScannedProduct;
              setProduct(foundProduct);
              setScanState("found");
              const records = await lookupInventory(foundProduct.id);
              setInventoryRecords(records);
              if (records[0]) setSelectedInventoryId(records[0].id);
              setIsCreating(false);
              return;
            }
          } catch { /* silent fallthrough */ }
        } finally {
          setIsCheckingInventory(false);
        }
      }

      setCreateError(apiErr?.response?.data?.message || "Không thể tạo sản phẩm. Vui lòng thử lại.");
    } finally {
      setIsCreating(false);
    }
  };

  // Thêm sản phẩm mới vào kho
  const handleAddInventory = async () => {
    if (!product || !initWarehouseId) return;
    setIsAddingInventory(true);
    setAddInventoryError("");
    try {
      // Cập nhật tên sản phẩm nếu người dùng thay đổi
      const trimmedName = editProductName.trim();
      if (trimmedName && trimmedName !== product.name) {
        await productsApi.update(product.id, { name: trimmedName });
        setProduct({ ...product, name: trimmedName });
      }

      await inventoryApi.create({
        productId: product.id,
        warehouseId: initWarehouseId,
        quantity: initQuantity,
        zoneId: initZone || undefined,
        rack: initRack || undefined,
        shelf: initShelf || undefined,
        notes: initNotes || undefined,
      });

      // Fetch lại inventory qua inventoryApi — backend tự filter theo role
      const records = await lookupInventory(product.id);
      setInventoryRecords(records);
      setScanState("found");
      if (records[0]) setSelectedInventoryId(records[0].id);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setAddInventoryError(apiErr?.response?.data?.message || "Không thể thêm vào kho. Vui lòng thử lại.");
    } finally {
      setIsAddingInventory(false);
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
    setInventoryRecords([]);
    setScanState("idle");
    setIsCheckingInventory(false);
    setAdjustment(0);
    setNotes("");
    setManualCode("");
    setSuccessMsg("");
    setSelectedInventoryId("");
    setEditProductName("");
    setNewProductName("");
    setNewBarcode("");
    setNewQuantity(1);
    setNewMinStockLevel(10);
    setCreateError("");
    setInitWarehouseId("");
    setInitQuantity(1);
    setInitZone("");
    setInitRack("");
    setInitShelf("");
    setInitNotes("");
    setAddInventoryError("");
  };

  const handleManualLookup = async () => {
    if (!manualCode.trim()) return;
    destroyScanner();
    setScanState("scanning");
    await handleScanResult(manualCode.trim());
  };

  const handleUpdateInventory = async () => {
    if (!selectedInventoryId || !product) return;
    setIsUpdating(true);
    const invItem = inventoryRecords.find((i) => i.id === selectedInventoryId);
    if (!invItem) { setIsUpdating(false); return; }

    const newQty = Math.max(0, invItem.quantity + adjustment);
    try {
      await inventoryApi.update(selectedInventoryId, { quantity: newQty, notes });

      // Refresh inventory records to reflect latest state
      const records = await lookupInventory(product.id);
      setInventoryRecords(records);

      setSuccessMsg(`Cập nhật thành công! Tồn kho mới: ${newQty} ${product.unit}`);
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

  // selectedInv: tìm trong inventoryRecords (đã được backend filter theo role)
  // Helper hiển thị vị trí lưu trữ (zone → rack → shelf)
  const formatLocation = (inv: InventoryRecord): string => {
    const parts: string[] = [];
    if (inv.zone?.name) parts.push(`Khu ${inv.zone.name}`);
    if (inv.rack) parts.push(`Kệ ${inv.rack}`);
    if (inv.shelf) parts.push(`Ngăn ${inv.shelf}`);
    return parts.length > 0 ? parts.join(' • ') : '';
  };

  const selectedInv = inventoryRecords.find((i) => i.id === selectedInventoryId);
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
        /* ─── Form thêm sản phẩm mới — chỉ nhập số lượng & mức cảnh báo ─── */
        <div className="space-y-4 animate-scale-in">
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#fff7ed" }}
              >
                <Package size={20} className="sm:w-6 sm:h-6" style={{ color: "#f97316" }} />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                  Sản phẩm mới
                </h2>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                  Mã này chưa có trong hệ thống. Nhập số lượng và mức tồn tối thiểu.
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
              {/* Mã quét được (read-only) */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  {scanMode === "QR_CODE" ? "Mã QR" : "Mã vạch"}
                </label>
                <div className="input-base text-sm flex items-center gap-2 overflow-x-auto no-scrollbar" style={{ opacity: 0.7 }}>
                  <span className="shrink-0">{scanMode === "QR_CODE" ? <QrCode size={14} /> : <Barcode size={14} />}</span>
                  <span className="font-mono whitespace-nowrap">{newBarcode}</span>
                </div>
              </div>

              {/* Tên sản phẩm */}
              <div>
                <label htmlFor="new-product-name" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Tên sản phẩm <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="new-product-name"
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="VD: Máy in Laser HP 1018..."
                  className="input-base text-sm"
                  autoFocus
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Để trống để hệ thống tự động đặt tên
                </p>
              </div>

              {/* Số lượng nhập kho */}
              <div>
                <label htmlFor="new-product-qty" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Số lượng tồn kho <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="new-product-qty"
                  type="number"
                  min={1}
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input-base text-sm"
                />
              </div>

              {/* Mức tồn tối thiểu (trigger alert) */}
              <div>
                <label htmlFor="new-product-min-stock" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Mức cảnh báo tồn kho tối thiểu <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="new-product-min-stock"
                  type="number"
                  min={0}
                  value={newMinStockLevel}
                  onChange={(e) => setNewMinStockLevel(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input-base text-sm"
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Hệ thống sẽ cảnh báo khi tồn kho dưới mức này
                </p>
              </div>

              {/* Chọn kho */}
              <div>
                <label htmlFor="new-product-warehouse" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Kho lưu trữ <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {isStaffOnly && assignedWarehouses.length === 1 ? (
                  <div className="input-base text-sm flex items-center gap-2" style={{ opacity: 0.7 }}>
                    <Warehouse size={14} />
                    <span>{assignedWarehouses[0].name} ({assignedWarehouses[0].code})</span>
                  </div>
                ) : (
                  <select
                    id="new-product-warehouse"
                    value={initWarehouseId}
                    onChange={(e) => setInitWarehouseId(e.target.value)}
                    className="input-base text-sm"
                  >
                    {(isStaffOnly ? assignedWarehouses : warehouses).length === 0 ? (
                      <option value="">Đang tải danh sách kho...</option>
                    ) : (
                      (isStaffOnly ? assignedWarehouses : warehouses).map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name} ({wh.code})
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleReset} className="btn btn-secondary flex-1 justify-center">
                  <X size={14} /> Hủy
                </button>
                <button
                  onClick={handleCreateProduct}
                  disabled={isCreating}
                  className="btn btn-primary flex-1 justify-center"
                >
                  {isCreating
                    ? <><Loader2 size={14} className="animate-spin" /> Đang tạo...</>
                    : <><Save size={14} /> Thêm vào kho</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : scanState === "add_inventory" ? (
        /* ─── Thêm sản phẩm mới vào kho ─── */
        <div className="space-y-4 animate-scale-in">
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#fff7ed" }}
              >
                <Package size={20} className="sm:w-6 sm:h-6" style={{ color: "#f97316" }} />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                  Thêm vào kho
                </h2>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                  Sản phẩm <strong>{product?.name}</strong> đã được tạo. Vui lòng chọn kho và nhập số lượng ban đầu.
                </p>
              </div>
            </div>

            {addInventoryError && (
              <div className="flex items-center gap-2 text-xs sm:text-sm p-2.5 sm:p-3 mb-4 rounded-lg" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <AlertCircle size={14} className="shrink-0" />
                <span>{addInventoryError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Chọn kho */}
              <div>
                <label htmlFor="init-warehouse" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Kho lưu trữ <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {isStaffOnly && assignedWarehouses.length === 1 ? (
                  /* Staff có 1 kho — hiển thị dạng text */
                  <div className="input-base text-sm flex items-center gap-2" style={{ opacity: 0.7 }}>
                    <Package size={14} />
                    <span>{assignedWarehouses[0].name} ({assignedWarehouses[0].code})</span>
                  </div>
                ) : (
                  /* Nhiều kho — cho phép chọn */
                  <select
                    id="init-warehouse"
                    value={initWarehouseId}
                    onChange={(e) => setInitWarehouseId(e.target.value)}
                    className="input-base text-sm"
                  >
                    {(isStaffOnly ? assignedWarehouses : warehouses).length === 0 ? (
                      <option value="">Đang tải danh sách kho...</option>
                    ) : (
                      (isStaffOnly ? assignedWarehouses : warehouses).map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name} ({wh.code})
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              {/* Số lượng */}
              <div>
                <label htmlFor="init-quantity" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Số lượng tồn kho ban đầu <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="init-quantity"
                  type="number"
                  min={1}
                  value={initQuantity}
                  onChange={(e) => setInitQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input-base text-sm"
                  autoFocus
                />
              </div>

              {/* Zone + Rack + Shelf */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="init-zone" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Phân khu (Zone)
                  </label>
                  <input
                    id="init-zone"
                    value={initZone}
                    onChange={(e) => setInitZone(e.target.value)}
                    placeholder="VD: A"
                    className="input-base text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="init-rack" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Kệ (Rack)
                  </label>
                  <input
                    id="init-rack"
                    value={initRack}
                    onChange={(e) => setInitRack(e.target.value)}
                    placeholder="VD: 01"
                    className="input-base text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="init-shelf" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Ngăn (Shelf)
                  </label>
                  <input
                    id="init-shelf"
                    value={initShelf}
                    onChange={(e) => setInitShelf(e.target.value)}
                    placeholder="VD: 3"
                    className="input-base text-sm"
                  />
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label htmlFor="init-notes" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Ghi chú
                </label>
                <textarea
                  id="init-notes"
                  value={initNotes}
                  onChange={(e) => setInitNotes(e.target.value)}
                  placeholder="Ghi chú nhập kho..."
                  rows={2}
                  className="input-base text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleReset} className="btn btn-secondary flex-1 justify-center">
                  <X size={14} /> Hủy
                </button>
                <button
                  onClick={handleAddInventory}
                  disabled={isAddingInventory || !initWarehouseId}
                  className="btn btn-primary flex-1 justify-center"
                >
                  {isAddingInventory
                    ? <><Loader2 size={14} className="animate-spin" /> Đang thêm vào kho...</>
                    : <><Save size={14} /> Thêm vào kho</>
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
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={handleReset} className="btn btn-primary btn-sm"><RotateCcw size={14} /> Kiểm kho tiếp</button>
            <Link
              href="/dashboard/warehouse"
              className="btn btn-secondary btn-sm"
            >
              <Warehouse size={14} /> Xem kho hàng
            </Link>
          </div>
        </div>
      ) : null}

      {/* Product found — inventory check loading */}
      {scanState === "found" && product && isCheckingInventory && (
        <div className="card p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin" style={{ color: "#f97316" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Đang kiểm tra tồn kho...
            </p>
          </div>
        </div>
      )}

      {/* Product found — update form */}
      {(scanState === "found" || scanState === "error") && product && !isCheckingInventory && (
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
                      <code className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate" style={{ background: "var(--bg-input)", color: "var(--text-muted)", display: "inline-block", verticalAlign: "middle", maxWidth: "100%" }}>
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

          {/* Inventory selection (khi có nhiều inventory trong warehouse được phân quyền) */}
          {/* Inventory status badge */}
          <div
            className={`card p-3 sm:p-4 flex items-center gap-3 ${
              inventoryRecords.length > 0
                ? "border-success/30"
                : "border-warning/30"
            }`}
            style={{
              background: inventoryRecords.length > 0
                ? "var(--color-success-bg)"
                : "var(--color-warning-bg)",
            }}
          >
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${
                inventoryRecords.length > 0 ? "bg-success" : ""
              }`}
              style={{
                background: inventoryRecords.length > 0
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(245,158,11,0.15)",
              }}
            >
              {inventoryRecords.length > 0 ? (
                <CheckCircle size={18} style={{ color: "#10b981" }} />
              ) : (
                <AlertCircle size={18} style={{ color: "#f59e0b" }} />
              )}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold" style={{ color: inventoryRecords.length > 0 ? "#059669" : "#d97706" }}>
                {inventoryRecords.length > 0
                  ? "Đã có trong kho"
                  : "Chưa có trong kho"}
              </p>
              <p className="text-[10px] sm:text-xs mt-0.5" style={{ color: inventoryRecords.length > 0 ? "#047857" : "#b45309" }}>
                {inventoryRecords.length > 0
                  ? `${inventoryRecords.length} vị trí lưu trữ • Tổng: ${inventoryRecords.reduce((s, r) => s + r.quantity, 0)} ${product.unit}`
                  : "Sản phẩm chưa được nhập vào kho nào. Thêm vào kho bên dưới."}
              </p>
            </div>
          </div>

          {/* Inventory summary (when there are multiple records) */}
          {inventoryRecords.length > 1 && (
            <div className="card p-3 sm:p-4">
              <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                Chọn vị trí kho
              </label>
              <div className="space-y-1.5">
                {inventoryRecords.map((inv) => {
                  const loc = formatLocation(inv);
                  const isSelected = selectedInventoryId === inv.id;
                  return (
                    <button
                      key={inv.id}
                      onClick={() => setSelectedInventoryId(inv.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${
                        isSelected ? "font-semibold" : "hover:bg-(--bg-input)"
                      }`}
                      style={{
                        background: isSelected ? "rgba(249,115,22,0.1)" : "transparent",
                        color: isSelected ? "#ea580c" : "var(--text-primary)",
                        boxShadow: isSelected ? "0 0 0 1px rgba(249,115,22,0.3)" : "none",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Warehouse size={14} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                          <span className="font-medium">{inv.warehouse.name} ({inv.warehouse.code})</span>
                          {loc && (
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {loc}
                            </span>
                          )}
                        </div>
                        <span className="font-bold shrink-0 ml-2">
                          {inv.quantity} {product.unit}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* No inventory in accessible warehouse — inline add-to-warehouse form */}
          {inventoryRecords.length === 0 && (
            <div className="card p-4 sm:p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "#fff7ed" }}
                >
                  <Package size={20} style={{ color: "#f97316" }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                    Thêm sản phẩm vào kho
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Sản phẩm chưa có trong kho. Nhập số lượng và vị trí lưu trữ.
                  </p>
                </div>
              </div>

              {addInventoryError && (
                <div className="flex items-center gap-2 text-xs sm:text-sm p-2.5 sm:p-3 rounded-lg" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{addInventoryError}</span>
                </div>
              )}

              <div className="space-y-3">
                {/* Tên sản phẩm (có thể sửa) */}
                <div>
                  <label htmlFor="inline-product-name" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Tên sản phẩm
                  </label>
                  <input
                    id="inline-product-name"
                    type="text"
                    value={editProductName}
                    onChange={(e) => setEditProductName(e.target.value)}
                    placeholder="Nhập tên sản phẩm..."
                    className="input-base text-sm"
                  />
                </div>

                {/* Warehouse */}
                <div>
                  <label htmlFor="inline-warehouse" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Kho lưu trữ <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  {isStaffOnly && assignedWarehouses.length === 1 ? (
                    <div className="input-base text-sm flex items-center gap-2" style={{ opacity: 0.7 }}>
                      <Package size={14} />
                      <span>{assignedWarehouses[0].name} ({assignedWarehouses[0].code})</span>
                    </div>
                  ) : (
                    <select
                      id="inline-warehouse"
                      value={initWarehouseId}
                      onChange={(e) => setInitWarehouseId(e.target.value)}
                      className="input-base text-sm"
                    >
                      {(isStaffOnly ? assignedWarehouses : warehouses).length === 0 ? (
                        <option value="">Đang tải danh sách kho...</option>
                      ) : (
                        (isStaffOnly ? assignedWarehouses : warehouses).map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name} ({wh.code})
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <label htmlFor="inline-quantity" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Số lượng tồn kho ban đầu <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="inline-quantity"
                    type="number"
                    min={1}
                    value={initQuantity}
                    onChange={(e) => setInitQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input-base text-sm"
                    autoFocus
                  />
                </div>

                {/* Zone/Rack/Shelf */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="inline-zone" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Phân khu
                    </label>
                    <input
                      id="inline-zone"
                      value={initZone}
                      onChange={(e) => setInitZone(e.target.value)}
                      placeholder="VD: A"
                      className="input-base text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="inline-rack" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Kệ
                    </label>
                    <input
                      id="inline-rack"
                      value={initRack}
                      onChange={(e) => setInitRack(e.target.value)}
                      placeholder="VD: 01"
                      className="input-base text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="inline-shelf" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Ngăn
                    </label>
                    <input
                      id="inline-shelf"
                      value={initShelf}
                      onChange={(e) => setInitShelf(e.target.value)}
                      placeholder="VD: 3"
                      className="input-base text-sm"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleReset}
                    className="btn btn-secondary flex-1 justify-center text-sm"
                  >
                    <X size={14} /> Hủy
                  </button>
                  <button
                    onClick={handleAddInventory}
                    disabled={isAddingInventory || !initWarehouseId}
                    className="btn btn-primary flex-1 justify-center text-sm"
                  >
                    {isAddingInventory
                      ? <><Loader2 size={14} className="animate-spin" /> Đang thêm...</>
                      : <><Save size={14} /> Thêm vào kho</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Update form */}
          {selectedInv && (
            <div className="card p-4 sm:p-5 space-y-4 sm:space-y-5">
              <h3 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                Cập nhật — {selectedInv.warehouse.code}
              </h3>
              {selectedInv && formatLocation(selectedInv) ? (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Vị trí: {formatLocation(selectedInv)}
                </p>
              ) : null}

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
