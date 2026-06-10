"use client";

import { WifiOff, Truck, RefreshCw, Package } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-page)" }}>
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6"
          style={{ background: "rgba(239,68,68,0.1)" }}
        >
          <WifiOff size={40} style={{ color: "#ef4444" }} />
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Mất kết nối mạng
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Vui lòng kiểm tra lại kết nối Internet của bạn.
          <br />
          Dữ liệu vận đơn đã được lưu trên thiết bị vẫn có thể xem được.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
            style={{ justifyContent: "center" }}
          >
            <RefreshCw size={16} />
            Thử lại
          </button>

          <Link
            href="/dashboard"
            className="btn btn-secondary"
            style={{ justifyContent: "center" }}
          >
            <Truck size={16} />
            Về bảng điều khiển
          </Link>
        </div>

        {/* Features */}
        <div className="mt-8 space-y-3 text-left">
          <div className="p-3 rounded-xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>                <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
              <Package size={15} /> Xem vận đơn khi offline
            </h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Các vận đơn đã tải trước đó vẫn hiển thị đầy đủ thông tin
            </p>
          </div>
          <div className="p-3 rounded-xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>                <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
              <RefreshCw size={15} /> Tự động đồng bộ khi có mạng
            </h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Các cập nhật checkpoint sẽ được gửi lên máy chủ ngay khi có kết nối trở lại
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
