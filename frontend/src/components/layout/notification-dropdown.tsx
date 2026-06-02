"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell, X, CheckCheck, Info, CheckCircle,
  AlertTriangle, XCircle,
} from "lucide-react";
import { useNotificationStore } from "@/store/notification-store";
import { useAuth } from "@/context/auth-context";
import { formatRelative } from "@/lib/utils";

const TYPE_META = {
  INFO:    { icon: Info,          color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
  SUCCESS: { icon: CheckCircle,   color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  WARNING: { icon: AlertTriangle, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  ERROR:   { icon: XCircle,       color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
};

function NotifItem({ notif, onRead }: { notif: any; onRead: (id: string) => void }) {
  const meta = TYPE_META[notif.type as keyof typeof TYPE_META] || TYPE_META.INFO;
  const Icon = meta.icon;

  const content = (
    <>
      {!notif.isRead && (
        <span
          className="absolute top-3.5 right-4 w-2 h-2 rounded-full"
          style={{ background: "#f97316" }}
        />
      )}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: meta.bg }}
      >
        <Icon size={16} style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0 pr-3">
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: notif.isRead ? "var(--text-secondary)" : "var(--text-primary)" }}
        >
          {notif.title}
        </p>
        <p className="text-xs mt-0.5 leading-snug line-clamp-2" style={{ color: "var(--text-muted)" }}>
          {notif.message}
        </p>
        <p className="text-[10px] mt-1 font-medium" style={{ color: "var(--text-muted)" }}>
          {formatRelative(notif.createdAt)}
        </p>
      </div>
    </>
  );

  if (notif.link) {
    return (
      <Link
        href={notif.link}
        onClick={() => onRead(notif.id)}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-input)] relative"
        style={{ borderBottom: "1px solid var(--border-light)" }}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      onClick={() => onRead(notif.id)}
      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-input)] relative cursor-pointer"
      style={{ borderBottom: "1px solid var(--border-light)" }}
    >
      {content}
    </div>
  );
}

export function GeneralNotificationDropdown() {
  const { user } = useAuth();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, addNotification } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (user?.id) fetchNotifications();
  }, [user?.id, fetchNotifications]);

  useEffect(() => {
    if (!user?.id) return;

    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
      socketRef.current = socket;

      socket.on(`notification:${user.id}`, (notif: any) => {
        addNotification(notif);
        // Maybe toast here if user is not looking? Handled elsewhere or leave it for now.
      });
    };

    initSocket();
    return () => {
      socketRef.current?.disconnect();
    };
  }, [user?.id, addNotification]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      <button onClick={() => setOpen(!open)} className="btn-icon relative" title="Thông báo hệ thống">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-xs font-bold flex items-center justify-center animate-badge-pop"
            style={{ background: "#f97316", color: "white", fontSize: "10px" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-xl border overflow-hidden animate-scale-in z-50"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
                <Bell size={14} color="white" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Thông báo</p>
                {unreadCount > 0 && (
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{unreadCount} chưa đọc</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="btn-icon" title="Đánh dấu tất cả đã đọc">
                  <CheckCheck size={15} style={{ color: "#f97316" }} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="btn-icon">
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: "var(--text-muted)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-input)" }}>
                  <Bell size={22} style={{ opacity: 0.3 }} />
                </div>
                <p className="text-sm font-medium">Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotifItem key={n.id} notif={n} onRead={(id) => { markAsRead(id); setOpen(false); }} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
