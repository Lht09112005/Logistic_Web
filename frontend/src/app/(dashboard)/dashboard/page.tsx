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
  estimatedArrival?: string;
  driver?: { name: string; phone?: string } | null;
}

import { auth } from "@/auth";
import DashboardDriver from "./_components/dashboard-driver";

export default async function DashboardPage() {
  // Get session to check role
  const session = await auth();
  const isDriver = (session?.user as any)?.role === 'DRIVER';

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
