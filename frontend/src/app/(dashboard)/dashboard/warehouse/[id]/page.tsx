"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { warehousesApi } from "@/lib/api";
import WarehouseDetailClient, { type WarehouseDetail } from "./_components/warehouse-detail-client";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [warehouse, setWarehouse] = useState<WarehouseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  const fetchWarehouse = useCallback(async () => {
    if (!id) return;
    try {
      const res = await warehousesApi.getById(id);
      setWarehouse(res.data.data);
      setErrorCode(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      const status = axiosErr?.response?.status || 500;
      setErrorCode(status);
    }
  }, [id]);

  useEffect(() => {
    fetchWarehouse().finally(() => setLoading(false));
  }, [fetchWarehouse]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  if (errorCode === 404 || (!loading && !warehouse)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 p-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.1)" }}>
          <AlertTriangle size={32} style={{ color: "#f97316" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Không tìm thấy kho hàng</h2>
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          Kho hàng không tồn tại hoặc đã bị xóa.
        </p>
        <button onClick={() => router.push("/dashboard/warehouse")} className="btn btn-primary btn-sm">
          Về danh sách kho hàng
        </button>
      </div>
    );
  }

  if (errorCode && errorCode >= 400) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 p-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
          <AlertTriangle size={32} style={{ color: "#ef4444" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Lỗi tải dữ liệu ({errorCode})</h2>
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          Bạn không có quyền xem kho này hoặc có lỗi xảy ra.
        </p>
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Quay lại
        </button>
      </div>
    );
  }

  return <WarehouseDetailClient warehouse={warehouse!} />;
}

