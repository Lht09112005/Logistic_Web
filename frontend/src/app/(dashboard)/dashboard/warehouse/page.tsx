import { ssrFetch } from "@/lib/server-api";
import WarehouseClient from "./_components/warehouse-client";

export const dynamic = 'force-dynamic';

export default async function WarehousePage() {
  // SSR: Fetch fresh data per-request (attaches user's auth token)
  const warehouses = await ssrFetch("/warehouses");
  const list: unknown[] = Array.isArray(warehouses) ? warehouses : [];

  return <WarehouseClient warehouses={list} />;
}
