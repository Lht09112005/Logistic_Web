"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { shipmentsApi } from "@/lib/api";
import ShipmentsClient from "./_components/shipments-client";

function ShipmentsContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || undefined;
  const page = searchParams.get("page") || "1";
  const search = searchParams.get("search") || undefined;

  const [shipments, setShipments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShipments = async () => {
      setLoading(true);
      try {
        const res = await shipmentsApi.getAll({
          page,
          limit: "15",
          ...(status && { status }),
          ...(search && { search }),
        });
        setShipments(res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      } catch (err: any) {
        console.warn("Lỗi lấy danh sách vận đơn:", err.message || err);
      } finally {
        setLoading(false);
      }
    };
    fetchShipments();
  }, [page, status, search]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  return <ShipmentsClient shipments={shipments} total={total} />;
}

export default function ShipmentsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    }>
      <ShipmentsContent />
    </Suspense>
  );
}
