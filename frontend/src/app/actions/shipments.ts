"use server";

import axios from "axios";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

// Helper to create Axios instance with Server-side Authentication token
async function getServerApi() {
  const session = await auth();
  const token = session?.accessToken;

  return axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

/**
 * Server Action to create a new shipment
 */
export async function createShipmentAction(data: {
  driverId?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  originWarehouseId?: string;
  destinationWarehouseId?: string;
  originAddress: string;
  destinationAddress: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  estimatedArrival?: string;
  items: { productId: string; quantity: number; weight?: number; notes?: string }[];
  checkpoints?: { name: string; address: string; latitude?: number; longitude?: number; sequence: number; estimatedAt?: string }[];
  notes?: string;
}) {
  try {
    const api = await getServerApi();
    const res = await api.post("/shipments", data);
    
    // Revalidate shipments path to update the dashboard list immediately
    revalidatePath("/dashboard/shipments");
    
    return { success: true, data: res.data.data };
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: { message?: string } } };
    const errMsg = axiosErr?.response?.data?.message || (error as Error)?.message;
    console.error("====== ERROR IN SERVER ACTION (createShipmentAction) ======");
    console.error(axiosErr?.response?.data || (error as Error)?.message || error);
    console.error("==========================================================");
    
    return {
      success: false,
      message: errMsg || "Lỗi không xác định khi tạo vận đơn",
    };
  }
}
