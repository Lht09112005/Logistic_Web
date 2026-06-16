"use server";

import axios from "axios";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:5000/api";

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
 * Server Action to create a new inventory item
 */
export async function createInventoryAction(data: {
  productId: string;
  warehouseId: string;
  zoneId?: string;
  rack?: string;
  shelf?: string;
  quantity?: number;
  notes?: string;
}) {
  try {
    const api = await getServerApi();
    const res = await api.post("/inventory", data);

    // Revalidate inventory + warehouse pages so new items appear
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/warehouse");

    return { success: true, data: res.data.data };
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: { message?: string } } };
    console.error("====== ERROR IN SERVER ACTION (createInventoryAction) ======");
    console.error(axiosErr?.response?.data || (error as Error)?.message || error);
    console.error("===========================================================");

    return {
      success: false,
      message: axiosErr?.response?.data?.message || (error as Error)?.message || "Lỗi không xác định khi thêm tồn kho",
    };
  }
}

/**
 * Server Action to update an existing inventory item
 */
export async function updateInventoryAction(
  id: string,
  data: {
    quantity?: number;
    rack?: string;
    shelf?: string;
    zoneId?: string;
    notes?: string;
  }
) {
  try {
    const api = await getServerApi();
    const res = await api.put(`/inventory/${id}`, data);

    // Revalidate both the list and the details page
    revalidatePath("/dashboard/inventory");
    revalidatePath(`/dashboard/inventory/${id}`);

    return { success: true, data: res.data.data };
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: { message?: string } } };
    console.error("====== ERROR IN SERVER ACTION (updateInventoryAction) ======");
    console.error(axiosErr?.response?.data || (error as Error)?.message || error);
    console.error("===========================================================");

    return {
      success: false,
      message: axiosErr?.response?.data?.message || (error as Error)?.message || "Lỗi không xác định khi cập nhật tồn kho",
    };
  }
}
