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
 * Server Action to resolve an inventory stock alert.
 * Calls the backend PUT /api/inventory/alerts/:id/resolve endpoint
 * and revalidates both alerts and inventory paths.
 */
export async function resolveAlertAction(id: string) {
  try {
    const api = await getServerApi();
    const res = await api.put(`/inventory/alerts/${id}/resolve`, {});

    // Revalidate paths to refresh data
    revalidatePath("/dashboard/alerts");
    revalidatePath("/dashboard/inventory");

    return {
      success: true,
      data: res.data.data,
      message: res.data.message || "Đã xử lý cảnh báo thành công",
    };
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: { message?: string } } };
    console.error("====== ERROR IN SERVER ACTION (resolveAlertAction) ======");
    console.error(axiosErr?.response?.data || (error as Error)?.message || error);
    console.error("=========================================================");

    return {
      success: false,
      message:
        axiosErr?.response?.data?.message ||
        (error as Error)?.message ||
        "Lỗi không xác định khi xử lý cảnh báo",
    };
  }
}

/**
 * Server Action to fetch alerts server-side.
 * Returns the full alert list for initial page load or filter changes.
 */
export async function fetchAlertsAction(params?: { isResolved?: string }) {
  try {
    const api = await getServerApi();
    const queryParams: Record<string, string> = {};
    if (params?.isResolved) {
      queryParams.isResolved = params.isResolved;
    }
    const res = await api.get("/inventory/alerts", { params: queryParams });

    return {
      success: true,
      data: res.data.data || [],
      message: res.data.message || "Lấy cảnh báo thành công",
    };
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: { message?: string } } };
    console.error("====== ERROR IN SERVER ACTION (fetchAlertsAction) ======");
    console.error(axiosErr?.response?.data || (error as Error)?.message || error);
    console.error("========================================================");

    // Return empty array on error so the UI can gracefully handle it
    return {
      success: false,
      data: [],
      message:
        axiosErr?.response?.data?.message ||
        (error as Error)?.message ||
        "Lỗi không xác định khi lấy cảnh báo",
    };
  }
}
