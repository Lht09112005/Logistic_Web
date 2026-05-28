"use client";

import { useEffect, useState } from "react";
import { warehousesApi } from "@/lib/api";
import WarehouseClient from "./_components/warehouse-client";

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await warehousesApi.getAll();
        setWarehouses(res.data.data || []);
      } catch (err: any) {
        console.warn("Lỗi lấy danh sách kho:", err.message || err);
      } finally {
        setLoading(false);
      }
    };
    fetchWarehouses();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return <WarehouseClient warehouses={warehouses} />;
}
