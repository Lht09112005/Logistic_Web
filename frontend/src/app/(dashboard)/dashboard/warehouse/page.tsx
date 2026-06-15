import type { Metadata } from "next";
import { isrFetch } from "@/lib/server-api";
import WarehouseClient from "./_components/warehouse-client";

export const metadata: Metadata = {
  title: "Quản lý kho | LogistiQ",
  description: "Danh sách và quản lý tất cả kho hàng — theo dõi sức chứa, phân khu, nhân sự và mặt hàng tồn kho theo từng kho.",
  openGraph: {
    title: "Quản lý kho | LogistiQ",
    description: "Hệ thống quản lý kho hàng thông minh với phân khu, QR code và giám sát tồn kho realtime.",
  },
};

// ISR: Revalidate warehouse list every 60 seconds
// Warehouse data (name, address, capacity) changes infrequently,
// so ISR is optimal — fast cached response with periodic refresh
export default async function WarehousePage() {
  const warehouses = await isrFetch("/warehouses", 60);
  const list: unknown[] = Array.isArray(warehouses) ? warehouses : [];

  return <WarehouseClient warehouses={list} />;
}
