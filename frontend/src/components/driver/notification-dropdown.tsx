"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Bell, X, CheckCheck, Truck, CheckCircle,
  XCircle, Package, Navigation, RefreshCw,
} from "lucide-react";
import { useDriverNotificationStore, buildNotification } from "@/store/driver-notification-store";
import type { DriverNotification, DriverNotifType } from "@/store/driver-notification-store";
import { useAuth } from "@/context/auth-context";
import { shipmentsApi } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

// ─── Icon per notification type ──────────────────────────────────────────────

const NOTIF_META: Record<DriverNotifType, { icon: typeof Truck; color: string; bg: string }> = {
  ASSIGNED:   { icon: Truck,        color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  CONFIRMED:  { icon: CheckCircle,  color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  LOADING:    { icon: Package,      color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  IN_TRANSIT: { icon: Navigation,   color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
  CANCELLED:  { icon: XCircle,      color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  UPDATED:    { icon: RefreshCw,    color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
};

// ─── Single notification item ─────────────────────────────────────────────────

function NotifItem({ notif, onRead }: { notif: DriverNotification; onRead: (id: string) => void }) {
  const meta = NOTIF_META[notif.type] ?? NOTIF_META.UPDATED;
  const Icon = meta.icon;

  return (
    <Link
      href={`/dashboard/shipments/${notif.shipmentId}`}
      onClick={() => onRead(notif.id)}
      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-input)] relative"
      style={{ borderBottom: "1px solid var(--border-light)" }}
    >
      {/* Unread dot */}
      {!notif.isRead && (
        <span
          className="absolute top-3.5 right-4 w-2 h-2 rounded-full"
          style={{ background: "#10b981" }}
        />
      )}

      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: meta.bg }}
      >
        <Icon size={16} style={{ color: meta.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-3">
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: notif.isRead ? "var(--text-secondary)" : "var(--text-primary)" }}
        >
          {notif.title}
        </p>
        <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>
          {notif.body}
        </p>
        <p className="text-[10px] mt-1 font-medium" style={{ color: "var(--text-muted)" }}>
          {formatRelative(notif.createdAt.toISOString())}
        </p>
      </div>
    </Link>
  );
}

// ─── Main Dropdown Component ──────────────────────────────────────────────────

export function DriverNotificationDropdown() {
  const { user } = useAuth();
  const { notifications, unreadCount, addNotification, markRead, markAllRead } =
    useDriverNotificationStore();

  const [open, setOpen] = useState(false);
  const [prevShipmentStatuses, setPrevShipmentStatuses] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<import("socket.io-client").Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Poll shipments để detect thay đổi status ──────────────────────────────
  const pollShipments = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await shipmentsApi.getAll({ driverId: user.id, limit: "20" });
      const shipments: Array<{ id: string; shipmentCode: string; status: string; rejectionReason?: string }> =
        res.data?.data ?? [];

      setPrevShipmentStatuses((prev) => {
        const next = { ...prev };
        shipments.forEach((s) => {
          const oldStatus = prev[s.id];
          // First load — seed without notifying
          if (oldStatus === undefined) {
            next[s.id] = s.status;
            return;
          }
          // Status changed → add notification
          if (oldStatus !== s.status) {
            addNotification(
              buildNotification(
                s.id,
                s.shipmentCode,
                s.status,
                s.status === "CANCELLED" ? s.rejectionReason : undefined
              )
            );
            next[s.id] = s.status;
          }
        });
        return next;
      });
    } catch { /* ignore */ }
  }, [user?.id, addNotification]);

  // ── Socket.io realtime ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
      socketRef.current = socket;

      socket.on("shipment:updated", (data: { shipmentId: string; shipmentCode: string; status: string; driverId?: string; rejectionReason?: string }) => {
        if (data.driverId && data.driverId !== user.id) return;
        addNotification(
          buildNotification(data.shipmentId, data.shipmentCode, data.status, data.rejectionReason)
        );
        setPrevShipmentStatuses((prev) => ({ ...prev, [data.shipmentId]: data.status }));
      });

      socket.on("shipment:assigned", (data: { shipmentId: string; shipmentCode: string; driverId: string }) => {
        if (data.driverId !== user.id) return;
        addNotification(buildNotification(data.shipmentId, data.shipmentCode, "PENDING"));
        setPrevShipmentStatuses((prev) => ({ ...prev, [data.shipmentId]: "PENDING" }));
      });
    };

    initSocket();

    // Polling fallback — every 30s
    pollShipments();
    pollRef.current = setInterval(pollShipments, 30_000);

    return () => {
      socketRef.current?.disconnect();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user?.id, addNotification, pollShipments]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => !v);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="btn-icon relative"
        id="driver-bell"
        title="Thông báo"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-xs font-bold flex items-center justify-center animate-badge-pop"
            style={{ background: "#ef4444", color: "white", fontSize: "10px" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-xl border overflow-hidden animate-scale-in z-50"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-color)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
              >
                <Bell size={14} color="white" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  Thông báo
                </p>
                {unreadCount > 0 && (
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {unreadCount} chưa đọc
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="btn-icon"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck size={15} style={{ color: "#10b981" }} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="btn-icon">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
            {notifications.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 gap-3"
                style={{ color: "var(--text-muted)" }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--bg-input)" }}
                >
                  <Bell size={22} style={{ opacity: 0.3 }} />
                </div>
                <p className="text-sm font-medium">Chưa có thông báo nào</p>
                <p className="text-xs text-center px-8" style={{ color: "var(--text-muted)" }}>
                  Bạn sẽ nhận được thông báo khi có chuyến mới hoặc cập nhật từ quản lý
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotifItem key={n.id} notif={n} onRead={(id) => { markRead(id); setOpen(false); }} />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              className="px-4 py-2.5 border-t flex items-center justify-between"
              style={{ borderColor: "var(--border-color)", background: "var(--bg-input)" }}
            >
              <Link
                href="/dashboard/shipments"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold"
                style={{ color: "#10b981" }}
              >
                Xem tất cả chuyến đi →
              </Link>
              <button
                onClick={markAllRead}
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Đánh dấu đã đọc
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
