"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { inventoryApi } from "@/lib/api";
import { RoleGuard } from "@/components/auth/role-guard";
import InventoryClient from "./_components/inventory-client";

interface InventoryItem {
  id: string;
  [key: string]: unknown;
}

interface AlertItem {
  id: string;
  [key: string]: unknown;
}

function InventoryContent() {
  const searchParams = useSearchParams();
  const page = searchParams.get("page") || "1";
  const search = searchParams.get("search") || undefined;
  const warehouseId = searchParams.get("warehouseId") || undefined;
  const lowStock = searchParams.get("lowStock") || undefined;

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInventoryData = async () => {
      setLoading(true);
      try {
        const [invRes, alertRes] = await Promise.allSettled([
          inventoryApi.getAll({
            page,
            limit: "20",
            ...(search && { search }),
            ...(warehouseId && { warehouseId }),
            ...(lowStock && { lowStock }),
          }),
          inventoryApi.getAlerts({ isResolved: "false" }),
        ]);

        if (invRes.status === "fulfilled") {
          setInventory(invRes.value.data.data || []);
          setTotal(invRes.value.data.meta?.total || 0);
        }
        if (alertRes.status === "fulfilled") {
          setAlerts(alertRes.value.data.data || []);
        }
      } catch (err: unknown) {
        console.warn("Lỗi lấy dữ liệu tồn kho:", (err as Error)?.message || err);
      } finally {
        setLoading(false);
      }
    };
    fetchInventoryData();
  }, [page, search, warehouseId, lowStock]);

  if (loading && inventory.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  return <InventoryClient inventory={inventory} total={total} alerts={alerts} initialPage={parseInt(page)} initialSearch={search || ""} initialWarehouseId={warehouseId || ""} lowStock={lowStock || ""} />;
}

export default function InventoryPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN", "MANAGER"]} fallback="denied">
    <Suspense fallback={
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    }>
      <Suspense fallback={
        <div className="space-y-6 animate-pulse">
          <div className="skeleton h-10 w-48 rounded-xl" />
          <div className="skeleton h-14 rounded-xl" />
          <div className="skeleton h-96 rounded-2xl" />
        </div>
      }>
        <InventoryContent />
      </Suspense>
    </Suspense>
    </RoleGuard>
  );
}
