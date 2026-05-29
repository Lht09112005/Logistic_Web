"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-in">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "rgba(239,68,68,0.12)" }}
      >
        <AlertTriangle size={40} style={{ color: "#ef4444" }} />
      </div>

      <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
        Có lỗi xảy ra
      </h1>

      <p className="text-sm max-w-md mb-2" style={{ color: "var(--text-secondary)" }}>
        Hệ thống gặp sự cố khi tải dữ liệu. Vui lòng thử lại hoặc quay về trang chủ.
      </p>

      {error.digest && (
        <code
          className="text-xs px-3 py-1.5 rounded-lg mb-6"
          style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
        >
          Error ID: {error.digest}
        </code>
      )}

      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="btn btn-primary"
        >
          <RefreshCw size={16} />
          Thử lại
        </button>
        <Link
          href="/dashboard"
          className="btn btn-secondary"
        >
          <Home size={16} />
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
