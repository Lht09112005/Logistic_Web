import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface StockAlert {
  id: string;
  productId: string;
  alertType: string;
  severity: string;
  message: string;
  currentQty: number;
  isResolved: boolean;
  createdAt: string;
  product?: { name: string; sku: string; imageUrl?: string };
}

interface ShipmentPosition {
  shipmentId: string;
  latitude: number;
  longitude: number;
  speed?: number;
}

interface AppState {
  // Alerts
  alerts: StockAlert[];
  unreadAlertCount: number;
  setAlerts: (alerts: StockAlert[]) => void;
  addAlert: (alert: StockAlert) => void;
  resolveAlert: (id: string) => void;

  // Realtime positions
  shipmentPositions: Record<string, ShipmentPosition>;
  updatePosition: (data: ShipmentPosition) => void;

  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    alerts: [],
    unreadAlertCount: 0,
    setAlerts: (alerts) =>
      set((state) => {
        state.alerts = alerts;
        state.unreadAlertCount = alerts.filter((a) => !a.isResolved).length;
      }),
    addAlert: (alert) =>
      set((state) => {
        state.alerts.unshift(alert);
        state.unreadAlertCount += 1;
      }),
    resolveAlert: (id) =>
      set((state) => {
        const alert = state.alerts.find((a) => a.id === id);
        if (alert) {
          alert.isResolved = true;
          state.unreadAlertCount = Math.max(0, state.unreadAlertCount - 1);
        }
      }),

    shipmentPositions: {},
    updatePosition: (data) =>
      set((state) => {
        state.shipmentPositions[data.shipmentId] = data;
      }),

    sidebarOpen: true,
    toggleSidebar: () =>
      set((state) => {
        state.sidebarOpen = !state.sidebarOpen;
      }),
    setSidebarOpen: (open) =>
      set((state) => {
        state.sidebarOpen = open;
      }),
  }))
);
