import type { Metadata } from "next";
import { auth } from "@/auth";
import axios from "axios";
import NewShipmentClient from "./_components/new-shipment-client";

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:5000/api";

export const metadata: Metadata = {
  title: "Tạo vận đơn | LogistiQ",
  description: "Tạo vận đơn vận chuyển hàng hóa mới — chọn kho nguồn, kho đích, sản phẩm, số lượng và phân công tài xế.",
  openGraph: {
    title: "Tạo vận đơn | LogistiQ",
    description: "Quản lý vận chuyển hàng hóa với quy trình tạo vận đơn thông minh, theo dõi realtime.",
  },
};

// Fetch data on the server side using the server session token
async function getFormData() {
  const session = await auth();
  const token = session?.accessToken;

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const [warehousesRes, productsRes, driversRes] = await Promise.all([
      axios.get(`${API_URL}/warehouses?all=true`, { headers }).catch(err => {
        console.warn("Lỗi tải kho trên Server:", err.message);
        return { data: { data: [] } };
      }),
      axios.get(`${API_URL}/products`, { headers }).catch(err => {
        console.warn("Lỗi tải sản phẩm trên Server:", err.message);
        return { data: { data: [] } };
      }),
      axios.get(`${API_URL}/auth/drivers`, { headers }).catch(err => {
        console.warn("Lỗi tải tài xế trên Server:", err.message);
        return { data: { data: [] } };
      }),
    ]);

    return {
      warehouses: warehousesRes.data?.data || [],
      products: productsRes.data?.data || [],
      drivers: driversRes.data?.data || [],
    };
  } catch (error: unknown) {
    console.error("Lỗi fetch server-side cho trang New Shipment:", (error as Error)?.message);
    return { warehouses: [], products: [], drivers: [] };
  }
}

export default async function NewShipmentPage() {
  const { warehouses, products, drivers } = await getFormData();

  return (
    <NewShipmentClient
      warehouses={warehouses}
      products={products}
      drivers={drivers}
    />
  );
}
