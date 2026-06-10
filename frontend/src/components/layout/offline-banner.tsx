"use client";

import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff, X } from "lucide-react";
import { useOfflineSync } from "@/lib/use-offline-sync";

export function OfflineBanner() {
  const { isOnline, queueCount, syncing, lastSyncAt, isInstalled, flushMutations } = useOfflineSync();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevOnline = useRef(isOnline);

  // Prevent hydration mismatch: useOfflineSync uses browser APIs not available in SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-dismiss when coming back online
  useEffect(() => {
    if (isOnline && !prevOnline.current) {
      // Coming back online — show briefly then dismiss
      setDismissed(false);
      const timer = setTimeout(() => setDismissed(true), 4000);
      prevOnline.current = true;
      return () => clearTimeout(timer);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  if (!mounted) return null;
  if (dismissed && isOnline && queueCount === 0) return null;

  const timeSinceSync = lastSyncAt
    ? Math.round((Date.now() - lastSyncAt) / 1000)
    : null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 ${
        isOnline && queueCount === 0 && !isInstalled
          ? "translate-y-full opacity-0"
          : "translate-y-0 opacity-100"
      }`}
    >
      <div
        className="mx-auto max-w-3xl px-4 pb-3"
      >
        <div
          className={`rounded-2xl shadow-2xl border px-4 py-3 flex items-center gap-3 backdrop-blur-md ${
            !isOnline
              ? "bg-rose-950/90 dark:bg-rose-950/90 border-rose-800/50 text-rose-200"
              : queueCount > 0
              ? "bg-amber-950/90 dark:bg-amber-950/90 border-amber-800/50 text-amber-200"
              : "bg-emerald-950/90 dark:bg-emerald-950/90 border-emerald-800/50 text-emerald-200"
          }`}
        >
          {/* Icon */}
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              !isOnline
                ? "bg-rose-500/20"
                : queueCount > 0
                ? "bg-amber-500/20"
                : "bg-emerald-500/20"
            }`}
          >
            {!isOnline ? (
              <WifiOff size={16} className="text-rose-400" />
            ) : syncing ? (
              <RefreshCw size={16} className="text-amber-400 animate-spin" />
            ) : queueCount > 0 ? (
              <CloudOff size={16} className="text-amber-400" />
            ) : (
              <Cloud size={16} className="text-emerald-400" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {!isOnline ? (
              <>
                <p className="text-xs font-bold">Mất kết nối mạng</p>
                <p className="text-[10px] opacity-70 mt-0.5">
                  Bạn vẫn có thể xem vận đơn đã cache. Thao tác sẽ được đồng bộ khi có mạng trở lại.
                </p>
              </>
            ) : syncing ? (
              <>
                <p className="text-xs font-bold">Đang đồng bộ...</p>
                <p className="text-[10px] opacity-70 mt-0.5">
                  Đang gửi {queueCount} thao tác đang chờ lên máy chủ
                </p>
              </>
            ) : queueCount > 0 ? (
              <>
                <p className="text-xs font-bold">{queueCount} thao tác đang chờ đồng bộ</p>
                <p className="text-[10px] opacity-70 mt-0.5">
                  {timeSinceSync !== null && timeSinceSync < 60
                    ? `Vừa mới trực tuyến trở lại`
                    : `Chưa đồng bộ từ ${timeSinceSync !== null ? `${Math.round(timeSinceSync / 60)} phút trước` : "lâu"}`}
                </p>
              </>
            ) : isInstalled ? (
              <>
                <p className="text-xs font-bold">Đã kết nối — Chế độ ngoại tuyến sẵn sàng</p>
                <p className="text-[10px] opacity-70 mt-0.5">
                  Dữ liệu vận đơn được cache tự động để dùng khi mất mạng
                </p>
              </>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {queueCount > 0 && !syncing && (
              <button
                onClick={flushMutations}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={11} />
                Đồng bộ
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small indicator shown in header when offline */
export function OfflineDot() {
  const { isOnline, queueCount } = useOfflineSync();

  if (isOnline && queueCount === 0) return null;

  return (
    <div
      className="w-2 h-2 rounded-full animate-pulse"
      style={{
        background: !isOnline ? "#ef4444" : "#f59e0b",
        boxShadow: `0 0 6px ${!isOnline ? "rgba(239,68,68,0.6)" : "rgba(245,158,11,0.6)"}`,
      }}
      title={
        !isOnline
          ? "Đang ngoại tuyến"
          : `${queueCount} thao tác chờ đồng bộ`
      }
    />
  );
}
