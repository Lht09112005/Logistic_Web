import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-in">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "rgba(99,102,241,0.12)" }}
      >
        <Search size={40} style={{ color: "#6366f1" }} />
      </div>

      <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
        Không tìm thấy dữ liệu
      </h1>

      <p className="text-sm max-w-md mb-8" style={{ color: "var(--text-secondary)" }}>
        Khoản mục hoặc trang bạn đang tìm không tồn tại trong hệ thống.
        Nó có thể đã bị xóa hoặc đường dẫn không chính xác.
      </p>

      <Link href="/dashboard" className="btn btn-primary">
        <Home size={16} />
        Quay về Dashboard
      </Link>
    </div>
  );
}
