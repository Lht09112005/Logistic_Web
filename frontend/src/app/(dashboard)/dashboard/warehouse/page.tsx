import type { Metadata } from "next";
import { ssrFetch } from "@/lib/server-api";
import WarehouseClient from "./_components/warehouse-client";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Quản lý kho | LogistiQ",
  description: "Danh sách và quản lý tất cả kho hàng — theo dõi sức chứa, phân khu, nhân sự và mặt hàng tồn kho theo từng kho.",
  openGraph: {
    title: "Quản lý kho | LogistiQ",
    description: "Hệ thống quản lý kho hàng thông minh với phân khu, QR code và giám sát tồn kho realtime.",
  },
};

export default async function WarehousePage() {
  // SSR: Fetch fresh data per-request (attaches user's auth token)
  const warehouses = await ssrFetch("/warehouses");
  const list: unknown[] = Array.isArray(warehouses) ? warehouses : [];

  return <WarehouseClient warehouses={list} />;
}
