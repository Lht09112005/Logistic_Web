"use client";

import { useEffect, useState } from "react";
import { shipmentsApi, inventoryApi, warehousesApi } from "@/lib/api";
import DashboardClient from "./_components/dashboard-client";

export default function DashboardPage() {
  const [shipmentStats, setShipmentStats] = useState({ total: 0, inTransit: 0, delivered: 0, pending: 0, failed: 0 });
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [warehouseCount, setWarehouseCount] = useState(0);
  const [recentShipments, setRecentShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, alertsRes, warehousesRes, shipmentsRes] = await Promise.allSettled([
          shipmentsApi.getStats(),
          inventoryApi.getAlerts({ isResolved: "false" }),
          warehousesApi.getAll(),
          shipmentsApi.getAll({ limit: 5, status: "IN_TRANSIT" }),
        ]);

        if (statsRes.status === "fulfilled") setShipmentStats(statsRes.value.data.data);
        if (alertsRes.status === "fulfilled") setActiveAlerts(alertsRes.value.data.data || []);
        if (warehousesRes.status === "fulfilled") setWarehouseCount((warehousesRes.value.data.data || []).length);
        if (shipmentsRes.status === "fulfilled") setRecentShipments(shipmentsRes.value.data.data || []);
      } catch (err) {
        console.error("Lỗi lấy dữ liệu trang tổng quan:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="skeleton h-80 rounded-2xl lg:col-span-2" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <DashboardClient
      shipmentStats={shipmentStats}
      activeAlerts={activeAlerts}
      warehouseCount={warehouseCount}
      recentShipments={recentShipments}
    />
  );
}
