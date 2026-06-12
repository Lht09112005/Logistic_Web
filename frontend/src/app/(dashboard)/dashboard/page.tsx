import type { Metadata } from "next";
import { ssrFetch } from "@/lib/server-api";
import DashboardClient from "./_components/dashboard-client";

// Dynamic: always render per-request so server can attach user's auth token
export const dynamic = 'force-dynamic';

interface ShipmentStats {
  total: number; inTransit: number; delivered: number; pending: number; failed: number;
}

interface ActiveAlert {
  id: string;
  severity: string;
  message: string;
  product?: { name: string } | null;
}

interface RecentShipment {
  id: string;
  shipmentCode: string;
  status: string;
  destinationAddress: string;
  originAddress: string;
  estimatedArrival?: string;
  actualArrival?: string;
  checkpoints?: { id: string; isCompleted: boolean }[];
  driver?: { name: string; phone?: string } | null;
}

import { auth } from "@/auth";
import DashboardDriver from "./_components/dashboard-driver";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  const isDriver = session?.user?.role === 'DRIVER';

  if (isDriver) {
    return {
      title: "Chuyến đi của tôi | LogistiQ",
      description: "Theo dõi lộ trình giao hàng, cập nhật trạng thái vận đơn và điểm danh tại các trạm kiểm soát.",
    };
  }

  return {
    title: "Tổng quan | LogistiQ",
    description: "Dashboard quản lý logistics thời gian thực — theo dõi vận đơn, tồn kho, cảnh báo và hiệu suất vận chuyển.",
  };
}

export default async function DashboardPage() {
  // Get session to check role
  const session = await auth();
  const isDriver = session?.user?.role === 'DRIVER';

  if (isDriver) {
    return <DashboardDriver />;
  }

  // SSR: Fetch fresh data per-request (attaches user's auth token via server-api.ts)
  const defaultStats: ShipmentStats = { total: 0, inTransit: 0, delivered: 0, pending: 0, failed: 0 };

  const [stats, alerts, warehouses, recentShipments] = await Promise.all([
    ssrFetch("/shipments/stats"),
    ssrFetch("/inventory/alerts?isResolved=false"),
    ssrFetch("/warehouses"),
    ssrFetch("/shipments?limit=5&status=IN_TRANSIT"),
  ]);

  const shipmentStats: ShipmentStats = (stats as ShipmentStats) ?? defaultStats;
  const activeAlerts: ActiveAlert[] = Array.isArray(alerts) ? (alerts as ActiveAlert[]) : [];
  const whList: unknown[] = Array.isArray(warehouses) ? (warehouses as unknown[]) : [];
  const recent: RecentShipment[] = Array.isArray(recentShipments) ? (recentShipments as RecentShipment[]) : [];

  return (
    <DashboardClient
      shipmentStats={shipmentStats}
      activeAlerts={activeAlerts}
      warehouseCount={whList.length}
      recentShipments={recent}
    />
  );
}
