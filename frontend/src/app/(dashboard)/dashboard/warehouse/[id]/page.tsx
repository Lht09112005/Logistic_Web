import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ssrFetch } from "@/lib/server-api";
import WarehouseDetailClient from "./_components/warehouse-detail-client";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const warehouse = await ssrFetch(`/warehouses/${id}`);
  if (!warehouse) {
    return { title: "Kho hàng không tồn tại" };
  }
  const name = (warehouse as any)?.name || "Kho hàng";
  const address = (warehouse as any)?.address || "";
  const city = (warehouse as any)?.city || "";
  const code = (warehouse as any)?.code || "";
  return {
    title: name,
    description: `Thông tin chi tiết kho ${name} (${code}) — ${address}, ${city}. Quản lý mặt hàng tồn kho, phân khu, thông số vận hành.`,
    openGraph: {
      title: `${name} | LogistiQ`,
      description: `Kho hàng tại ${address}, ${city} — Mã kho: ${code}`,
    },
  };
}
// SSR: Fetch warehouse detail fresh per-request (attaches user's auth token)
export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const warehouse = await ssrFetch(`/warehouses/${id}`);

  if (!warehouse) {
    return notFound();
  }

  return <WarehouseDetailClient warehouse={warehouse as any} />;
}
