import { isrFetch } from "@/lib/server-api";
import WarehouseClient from "./_components/warehouse-client";

export const revalidate = 60;

export default async function WarehousePage() {
  // ISR: Revalidate every 60 seconds — warehouse list changes infrequently
  const warehouses = await isrFetch("/warehouses", 60);
  const list: unknown[] = Array.isArray(warehouses) ? warehouses : [];

  return <WarehouseClient warehouses={list} />;
}
