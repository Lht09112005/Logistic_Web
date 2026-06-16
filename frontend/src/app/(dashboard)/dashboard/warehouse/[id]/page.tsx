import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isrFetch } from "@/lib/server-api";
import WarehouseDetailClient, { type WarehouseDetail } from "./_components/warehouse-detail-client";

// ISR + SSR hybrid: known warehouses are pre-rendered at build time via generateStaticParams,
// then revalidated every 60s so that inventory updates from QR scan are reflected promptly.

export async function generateStaticParams() {
  // Fetch all warehouse IDs at build time for static pre-rendering
  try {
    const warehouses = await isrFetch("/warehouses", 300);
    if (!Array.isArray(warehouses)) return [];
    return (warehouses as { id: string }[])
      .filter((w) => w.id)
      .map((w) => ({ id: w.id }));
  } catch {
    // If API is unavailable at build time, fall back to dynamic rendering
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const warehouse = await isrFetch(`/warehouses/${id}`, 60);
  if (!warehouse) {
    return { title: "Kho hàng không tồn tại" };
  }
  const name = (warehouse as Record<string, string>)?.name || "Kho hàng";
  const address = (warehouse as Record<string, string>)?.address || "";
  const city = (warehouse as Record<string, string>)?.city || "";
  const code = (warehouse as Record<string, string>)?.code || "";
  return {
    title: name,
    description: `Thông tin chi tiết kho ${name} (${code}) — ${address}, ${city}. Quản lý mặt hàng tồn kho, phân khu, thông số vận hành.`,
    openGraph: {
      title: `${name} | LogistiQ`,
      description: `Kho hàng tại ${address}, ${city} — Mã kho: ${code}`,
    },
  };
}

// ISR: Fetch warehouse detail with 60s revalidation (inventory updates reflect within 1 minute)
// The client component also auto-polls every 15s and listens to socket.io for instant refresh.
export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const warehouse = await isrFetch(`/warehouses/${id}`, 60);

  if (!warehouse) {
    return notFound();
  }

  return <WarehouseDetailClient warehouse={warehouse as unknown as WarehouseDetail} />;
}
