"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { shipmentsApi } from "@/lib/api";
import ShipmentDetailClient from "./_components/shipment-detail-client";
import type { Shipment } from "./_components/shipment-detail-client";
import { ArrowLeft, AlertTriangle, ShieldOff } from "lucide-react";

const POLL_INTERVAL = 15_000;

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchShipment = useCallback(async () => {
    if (!id) return;
    try {
      const res = await shipmentsApi.getById(id);
      setShipment(res.data.data);
      setErrorCode(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      const status = axiosErr?.response?.status || 500;
      setErrorCode(status);
    }
    setLastUpdated(new Date());
  }, [id]);

  // Initial fetch + polling
  useEffect(() => {
    fetchShipment().finally(() => setLoading(false));
    const interval = setInterval(fetchShipment, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchShipment]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchShipment();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  if (errorCode === 403) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 p-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
          <ShieldOff size={32} style={{ color: "#ef4444" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Không có quyền truy cập</h2>
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          Bạn không có quyền xem vận đơn này. Chỉ tài xế được phân công mới có thể xem.
        </p>
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Quay lại
        </button>
      </div>
    );
  }

  if (errorCode === 404 || (!loading && !shipment)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 p-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.1)" }}>
          <AlertTriangle size={32} style={{ color: "#f97316" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Không tìm thấy vận đơn</h2>
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          Vận đơn không tồn tại hoặc đã bị xóa.
        </p>
        <button onClick={() => router.push("/dashboard/shipments")} className="btn btn-primary btn-sm">
          Về danh sách vận đơn
        </button>
      </div>
    );
  }

  if (errorCode && errorCode >= 500) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 p-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
          <AlertTriangle size={32} style={{ color: "#ef4444" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Lỗi hệ thống</h2>
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          Không thể tải dữ liệu. Vui lòng thử lại sau.
        </p>
        <button onClick={handleRefresh} disabled={refreshing} className="btn btn-primary btn-sm">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <ShipmentDetailClient
      shipment={shipment!}
      lastUpdated={lastUpdated}
      refresh={handleRefresh}
      refreshing={refreshing}
    />
  );
}

