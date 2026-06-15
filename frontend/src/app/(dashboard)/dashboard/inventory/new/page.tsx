import type { Metadata } from "next";
import { isrFetch } from "@/lib/server-api";
import NewInventoryClient from "./_components/new-inventory-client";

export const metadata: Metadata = {
  title: "Nhập hàng mới | LogistiQ",
  description: "Thêm mặt hàng tồn kho mới vào hệ thống — chọn sản phẩm, kho lưu trữ, phân khu và nhập số lượng ban đầu.",
  openGraph: {
    title: "Nhập hàng mới | LogistiQ",
    description: "Quản lý tồn kho thông minh — nhập hàng, theo dõi số lượng và cảnh báo tồn kho tự động.",
  },
};

// ISR: Form reference data (warehouses, products) changes infrequently.
// Cache 120s with periodic revalidation — no need for fresh data per request.
export default async function NewInventoryPage() {
  const [warehouses, products] = await Promise.all([
    isrFetch("/warehouses", 120),
    isrFetch("/products", 120),
  ]);

  return (
    <NewInventoryClient
      warehouses={Array.isArray(warehouses) ? warehouses : []}
      products={Array.isArray(products) ? products : []}
    />
  );
}
