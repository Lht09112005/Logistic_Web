"use client";

import { useEffect, useRef } from "react";
import { useSharedDataStore } from "@/store/shared-data-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/context/auth-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const { user } = useAuth();
  const isDriver = user?.role === 'DRIVER';

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

      {/* Main content — mobile: sidebar là overlay nên không margin, desktop: margin theo sidebar */}
      <div
        className={`transition-all duration-300 h-screen flex flex-col ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}
      >
        <Header />

        <main
          className={`flex-1 px-4 md:px-6 pb-4 md:pb-6 animate-fade-in flex flex-col lg:pl-8 ${
            isDriver ? 'pt-12 lg:pt-6' : 'pt-20'
          }`}
          style={{ maxWidth: "100%", overflowX: "hidden" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
