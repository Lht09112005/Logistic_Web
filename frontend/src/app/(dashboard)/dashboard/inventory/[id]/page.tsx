import { auth } from "@/auth";
import axios from "axios";
import { notFound } from "next/navigation";
import InventoryDetailClient from "./_components/inventory-detail-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

interface Params {
  params: Promise<{ id: string }>;
}

async function getInventoryDetail(id: string) {
  const session = await auth();
  const token = (session as any)?.accessToken;

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const res = await axios.get(`${API_URL}/inventory/${id}`, { headers });
    const item = res.data?.data;

    if (!item) return null;

    // Fetch warehouse zones to populate editing selection
    const whRes = await axios.get(`${API_URL}/warehouses/${item.warehouseId}`, { headers }).catch(err => {
      console.warn("Lỗi tải thông tin kho trên Server:", err.message);
      return { data: { data: { zones: [] } } };
    });
    const zones = whRes.data?.data?.zones || [];

    return { item, zones };
  } catch (error: any) {
    console.error("Lỗi fetch server-side cho trang Inventory Detail:", error.message);
    return null;
  }
}

export default async function InventoryDetailPage({ params }: Params) {
  const { id } = await params;
  const data = await getInventoryDetail(id);

  if (!data) {
    notFound();
  }

  return (
    <InventoryDetailClient
      item={data.item}
      zones={data.zones}
    />
  );
}
