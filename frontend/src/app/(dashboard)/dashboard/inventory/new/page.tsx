import type { Metadata } from "next";
import { auth } from "@/auth";
import axios from "axios";
import NewInventoryClient from "./_components/new-inventory-client";

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:5000/api";

export const metadata: Metadata = {
  title: "Nhập hàng mới | LogistiQ",
  description: "Thêm mặt hàng tồn kho mới vào hệ thống — chọn sản phẩm, kho lưu trữ, phân khu và nhập số lượng ban đầu.",
  openGraph: {
    title: "Nhập hàng mới | LogistiQ",
    description: "Quản lý tồn kho thông minh — nhập hàng, theo dõi số lượng và cảnh báo tồn kho tự động.",
  },
};

// Fetch data on the server side using the server session token
async function getFormData() {
  const session = await auth();
  const token = session?.accessToken;

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const [warehousesRes, productsRes] = await Promise.all([
      axios.get(`${API_URL}/warehouses`, { headers }).catch(err => {
        console.warn("Lỗi tải kho trên Server:", err.message);
        return { data: { data: [] } };
      }),
      axios.get(`${API_URL}/products`, { headers }).catch(err => {
        console.warn("Lỗi tải sản phẩm trên Server:", err.message);
        return { data: { data: [] } };
      }),
    ]);

    return {
      warehouses: warehousesRes.data?.data || [],
      products: productsRes.data?.data || [],
    };
  } catch (error: unknown) {
    console.error("Lỗi fetch server-side cho trang New Inventory:", (error as Error)?.message);
    return { warehouses: [], products: [] };
  }
}

export default async function NewInventoryPage() {
  const { warehouses, products } = await getFormData();

  return (
    <NewInventoryClient
      warehouses={warehouses}
      products={products}
    />
  );
}
