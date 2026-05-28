import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-base)" }}>
      <div className="text-center max-w-md animate-fade-in">
        {/* 404 illustration */}
        <div className="relative mb-8">
          <div
            className="text-[8rem] font-extrabold leading-none select-none"
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              background: "linear-gradient(135deg, var(--border-color), var(--text-muted))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </div>
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full"
            style={{ background: "linear-gradient(90deg, transparent, #f97316, transparent)" }}
          />
        </div>

        <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
          Trang không tìm thấy
        </h1>

        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
          Vui lòng kiểm tra lại đường dẫn hoặc quay về trang chủ.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/auth/login" className="btn btn-secondary">
            <ArrowLeft size={16} />
            Quay lại
          </Link>
          <Link href="/dashboard" className="btn btn-primary">
            <Home size={16} />
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
