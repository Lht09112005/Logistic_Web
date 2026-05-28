"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { warehousesApi } from "@/lib/api";
import WarehouseDetailClient from "./_components/warehouse-detail-client";

export default function WarehouseDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [warehouse, setWarehouse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    const fetchWarehouse = async () => {
      try {
        const res = await warehousesApi.getById(id);
        setWarehouse(res.data.data);
      } catch (err: any) {
        console.warn("Lỗi lấy chi tiết kho:", err.message || err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchWarehouse();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  if (error || !warehouse) {
    return notFound();
  }

  return <WarehouseDetailClient warehouse={warehouse} />;
}
