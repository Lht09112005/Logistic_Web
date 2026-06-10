import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import api from "@/lib/api";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  isRead: boolean;
  link?: string;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  
  // Actions
  fetchNotifications: () => Promise<void>;
  addNotification: (notification: AppNotification) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()(
  immer((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,

    fetchNotifications: async () => {
      set((state) => { state.loading = true; });
      try {
        const res = await api.get("/notifications?limit=50");
        const data = res.data.data || [];
        const unreadCount = res.data.meta?.unreadCount || 0;
        set((state) => {
          state.notifications = data;
          state.unreadCount = unreadCount;
          state.loading = false;
        });
      } catch {
        set((state) => { state.loading = false; });
      }
    },

    addNotification: (notification) => {
      set((state) => {
        state.notifications.unshift(notification);
        state.unreadCount += 1;
      });
    },

    markAsRead: async (id) => {
      const { notifications } = get();
      const notif = notifications.find((n) => n.id === id);
      if (!notif || notif.isRead) return;

      // Optimistic update
      set((state) => {
        const n = state.notifications.find((x) => x.id === id);
        if (n) n.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      });

      try {
        await api.put(`/notifications/${id}/read`);
      } catch {
        // Revert on failure
        set((state) => {
          const n = state.notifications.find((x) => x.id === id);
          if (n) n.isRead = false;
          state.unreadCount += 1;
        });
      }
    },

    markAllAsRead: async () => {
      // Optimistic update
      set((state) => {
        state.notifications.forEach((n) => { n.isRead = true; });
        state.unreadCount = 0;
      });

      try {
        await api.put("/notifications/read-all");
      } catch {
        get().fetchNotifications(); // refetch to sync on error
      }
    },
  }))
);
