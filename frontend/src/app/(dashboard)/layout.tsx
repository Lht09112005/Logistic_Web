"use client";

import { useEffect, useRef, useState } from "react";
import { useSharedDataStore } from "@/store/shared-data-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/context/auth-context";

import { useRouter, usePathname } from "next/navigation";
import { CheckCircle, X } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const { user, managedWarehouse, isManager, isStaffOnly, isAdmin } = useAuth();
  const isDriver = user?.role === 'DRIVER';
  const router = useRouter();
  const pathname = usePathname();

  // Route Guard for DRIVER
  useEffect(() => {
    if (isDriver && (pathname.startsWith('/dashboard/warehouse') || pathname.startsWith('/dashboard/inventory'))) {
      router.replace('/dashboard');
    }
  }, [isDriver, pathname, router]);

  // Centralized polling for shared data (stats, alerts, warehouses)
  // This single polling loop replaces 5+ independent polling intervals in child components
  useEffect(() => {
    useSharedDataStore.getState().startPolling(15_000);
    return () => {
      useSharedDataStore.getState().stopPolling();
    };
  }, []);

  const [toast, setToast] = useState<{ visible: boolean; message: string; link?: string } | null>(null);

  // Socket.io for realtime — lazy loaded so it doesn't block initial render
  const socketInitialized = useRef(false);
  
  // We need refs to access latest auth state inside socket callbacks
  const userRoleRef = useRef(user?.role);
  const managedWarehouseIdRef = useRef(managedWarehouse?.id);
  useEffect(() => {
    userRoleRef.current = user?.role;
    managedWarehouseIdRef.current = managedWarehouse?.id;
  }, [user?.role, managedWarehouse?.id]);

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

      socket.on("shipment:checkpoint_update", (data) => {
        const role = userRoleRef.current;
        const myWhId = managedWarehouseIdRef.current;
        
        // Notify if ADMIN, or if MANAGER/STAFF of the destination warehouse
        if (role === 'ADMIN' || ((role === 'MANAGER' || role === 'STAFF') && data.destinationWarehouseId === myWhId)) {
          setToast({
            visible: true,
            message: `Tài xế vừa đến ${data.checkpointName} (Vận đơn: ${data.shipmentCode})`,
            link: `/dashboard/shipments/${data.shipmentId}`
          });
          
          // Refresh shared data to update pending tasks count
          useSharedDataStore.getState().refresh();
        }
      });

      return socket;
    };

    const cleanup = initSocket();
    return () => { cleanup.then((s) => s?.disconnect()); };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {toast?.visible && (
        <div className="fixed top-4 right-4 z-[100] animate-toast-slide-in">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm"
            style={{
              background: "linear-gradient(135deg, var(--color-success), #047857)",
              color: "white",
              minWidth: 280,
              border: "1px solid var(--color-success-border)",
            }}
          >
            <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0">
              <CheckCircle size={16} className="text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">Cập nhật lộ trình!</div>
              <div className="text-[11px] text-emerald-100 mt-0.5 truncate">{toast.message}</div>
              {toast.link && (
                <Link href={toast.link} onClick={() => setToast(null)} className="text-[10px] font-medium text-emerald-200 hover:text-white underline mt-1 inline-block">
                  Xem chi tiết
                </Link>
              )}
            </div>
            <button onClick={() => setToast(null)} className="text-emerald-300 hover:text-white transition-colors p-1 shrink-0">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

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
