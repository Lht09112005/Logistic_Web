import type { Metadata } from "next";
import { isrFetch } from "@/lib/server-api";
import NewShipmentClient from "./_components/new-shipment-client";

export const metadata: Metadata = {
  title: "Tạo vận đơn | LogistiQ",
  description: "Tạo vận đơn vận chuyển hàng hóa mới — chọn kho nguồn, kho đích, sản phẩm, số lượng và phân công tài xế.",
  openGraph: {
    title: "Tạo vận đơn | LogistiQ",
    description: "Quản lý vận chuyển hàng hóa với quy trình tạo vận đơn thông minh, theo dõi realtime.",
  },
};

// ISR: Form reference data (warehouses, products, drivers) changes infrequently.
// Cache 120s with periodic revalidation — no need for fresh data per request.
export default async function NewShipmentPage() {
  const [warehouses, products, drivers] = await Promise.all([
    isrFetch("/warehouses?all=true", 120),
    isrFetch("/products", 120),
    isrFetch("/auth/drivers", 120),
  ]);

  return (
    <NewShipmentClient
      warehouses={Array.isArray(warehouses) ? warehouses : []}
      products={Array.isArray(products) ? products : []}
      drivers={Array.isArray(drivers) ? drivers : []}
    />
  );
}
