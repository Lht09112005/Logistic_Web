"use client";

import { useEffect, useRef } from "react";
import { useSharedDataStore } from "@/store/shared-data-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useAppStore } from "@/store/app-store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);

  // Centralized polling for shared data (stats, alerts, warehouses)
  // This single polling loop replaces 5+ independent polling intervals in child components
  useEffect(() => {
    useSharedDataStore.getState().startPolling(15_000);
    return () => {
      useSharedDataStore.getState().stopPolling();
    };
  }, []);

  // Socket.io for realtime — lazy loaded so it doesn't block initial render
  const socketInitialized = useRef(false);
  useEffect(() => {
    if (socketInitialized.current) return;
    socketInitialized.current = true;

    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
      const socket = io(socketUrl, { transports: ["websocket"] });

      socket.on("alert:new", (alert) => {
        useAppStore.getState().addAlert(alert);
      });

      socket.on("shipment:position", (data) => {
        useAppStore.getState().updatePosition(data);
      });

      return socket;
    };

    const cleanup = initSocket();
    return () => { cleanup.then((s) => s?.disconnect()); };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />

      {/* Main content */}
      <div
        className="transition-all duration-300 min-h-screen flex flex-col"
        style={{ marginLeft: sidebarOpen ? "256px" : "64px" }}
      >
        <Header />

        <main
          className="flex-1 p-6 mt-16 animate-fade-in"
          style={{ maxWidth: "100%", overflowX: "hidden" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
