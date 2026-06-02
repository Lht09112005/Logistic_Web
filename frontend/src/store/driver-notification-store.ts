"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DriverNotifType =
  | "ASSIGNED"    // Chuyến mới được phân công
  | "CONFIRMED"   // Chuyến được xác nhận
  | "CANCELLED"   // Chuyến bị hủy
  | "UPDATED"     // Cập nhật trạng thái chuyến
  | "LOADING"     // Chuyến bắt đầu bốc hàng
  | "IN_TRANSIT"; // Chuyến đang vận chuyển

export interface DriverNotification {
  id: string;
  type: DriverNotifType;
  title: string;
  body: string;
  shipmentId: string;
  shipmentCode: string;
  isRead: boolean;
  createdAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildNotification(
  shipmentId: string,
  shipmentCode: string,
  status: string,
  extra?: string
): Omit<DriverNotification, "id" | "isRead" | "createdAt"> {
  const map: Record<string, { type: DriverNotifType; title: string; body: string }> = {
    PENDING: {
      type: "ASSIGNED",
      title: "🚚 Chuyến mới được phân công",
      body: `Bạn vừa được giao vận đơn ${shipmentCode}. Hãy chuẩn bị xuất phát!`,
    },
    CONFIRMED: {
      type: "CONFIRMED",
      title: "✅ Vận đơn đã được xác nhận",
      body: `Vận đơn ${shipmentCode} đã được xác nhận. Sẵn sàng bốc hàng!`,
    },
    LOADING: {
      type: "LOADING",
      title: "📦 Bắt đầu bốc hàng",
      body: `Vận đơn ${shipmentCode} đang trong quá trình bốc xếp hàng hóa.`,
    },
    IN_TRANSIT: {
      type: "IN_TRANSIT",
      title: "🛣️ Đang vận chuyển",
      body: `Vận đơn ${shipmentCode} đã xuất phát. Chúc bạn lái xe an toàn!`,
    },
    CANCELLED: {
      type: "CANCELLED",
      title: "❌ Vận đơn bị hủy",
      body: `Vận đơn ${shipmentCode} đã bị hủy.${extra ? ` Lý do: ${extra}` : ""}`,
    },
    UPDATED: {
      type: "UPDATED",
      title: "🔄 Cập nhật vận đơn",
      body: `Vận đơn ${shipmentCode} vừa được cập nhật thông tin.`,
    },
  };

  return {
    shipmentId,
    shipmentCode,
    ...(map[status] ?? map.UPDATED),
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

const MAX_NOTIFS = 50;

interface DriverNotificationState {
  notifications: DriverNotification[];
  unreadCount: number;

  addNotification: (notif: Omit<DriverNotification, "id" | "isRead" | "createdAt">) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clear: () => void;
}

export const useDriverNotificationStore = create<DriverNotificationState>()(
  immer((set) => ({
    notifications: [],
    unreadCount: 0,

    addNotification: (notif) =>
      set((state) => {
        const newNotif: DriverNotification = {
          ...notif,
          id: `dn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          isRead: false,
          createdAt: new Date(),
        };
        // Prepend + cap at MAX_NOTIFS
        state.notifications = [newNotif, ...state.notifications].slice(0, MAX_NOTIFS);
        state.unreadCount += 1;
      }),

    markRead: (id) =>
      set((state) => {
        const notif = state.notifications.find((n) => n.id === id);
        if (notif && !notif.isRead) {
          notif.isRead = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      }),

    markAllRead: () =>
      set((state) => {
        state.notifications.forEach((n) => { n.isRead = true; });
        state.unreadCount = 0;
      }),

    clear: () =>
      set((state) => {
        state.notifications = [];
        state.unreadCount = 0;
      }),
  }))
);
