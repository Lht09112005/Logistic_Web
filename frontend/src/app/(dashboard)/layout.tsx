"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/app-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { inventoryApi } from "@/lib/api";
import { io } from "socket.io-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);

  // Load alerts on mount — get actions directly from store to avoid stale closures
  useEffect(() => {
    const { setAlerts } = useAppStore.getState();
    inventoryApi.getAlerts({ isResolved: "false" })
      .then((res) => setAlerts(res.data.data || []))
      .catch(() => {});
  }, []);

  // Socket.io for realtime — stable ref so effect doesn't re-run on every render
  const socketInitialized = useRef(false);
  useEffect(() => {
    if (socketInitialized.current) return;
    socketInitialized.current = true;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
    const socket = io(socketUrl, { transports: ["websocket"] });

    socket.on("alert:new", (alert) => {
      useAppStore.getState().addAlert(alert);
    });

    socket.on("shipment:position", (data) => {
      useAppStore.getState().updatePosition(data);
    });

    return () => { socket.disconnect(); };
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
