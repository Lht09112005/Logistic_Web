import { notFound } from "next/navigation";
import { isrFetch, ssgFetch } from "@/lib/server-api";
import WarehouseDetailClient from "./_components/warehouse-detail-client";

export const revalidate = 30;

// SSG: Pre-generate warehouse detail pages at build time
// Falls back gracefully if the API is unavailable (returns empty array → all pages are ISR-only)
export async function generateStaticParams() {
  try {
    const warehouses = await ssgFetch("/warehouses");
    if (!Array.isArray(warehouses)) return [];
    return warehouses.map((w: { id: string }) => ({ id: w.id }));
  } catch {
    return [];
  }
}

// ISR: Fetch warehouse detail with revalidation every 30 seconds
// After revalidation, the page is re-rendered with fresh data
export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const warehouse = await isrFetch(`/warehouses/${id}`, 30);

  if (!warehouse) {
    return notFound();
  }

  return <WarehouseDetailClient warehouse={warehouse as any} />;
}
