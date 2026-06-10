import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Xác thực | LogistiQ",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>
      {/* Left panel - Brand */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a1d29 0%, #0d1117 60%, #1c0a00 100%)" }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #f97316, transparent)" }}
          />
          <div
            className="absolute -bottom-48 -left-24 w-80 h-80 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #ea580c, transparent)" }}
          />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `linear-gradient(rgba(249,115,22,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.3) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <span className="text-white text-xl font-bold font-['Plus_Jakarta_Sans']">LogistiQ</span>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Quản lý logistics<br />
              <span style={{ color: "#f97316" }}>thông minh hơn</span>
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed">
              Theo dõi kho hàng, giám sát vận chuyển thời gian thực, và cảnh báo tồn kho tự động — tất cả trong một nền tảng.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-4">
            {[
              { icon: "warehouse", label: "Quản lý kho thông minh với QR Code" },
              { icon: "map", label: "Bản đồ theo dõi vận chuyển real-time" },
              { icon: "bell", label: "Cảnh báo tồn kho thấp tự động" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: "rgba(249,115,22,0.15)" }}
                >
                {item.icon === 'warehouse' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35" /><path d="M22 8.35 12 2 2 8.35" /><path d="M6 12h3v4H6z" /><path d="M10 12h3v4h-3z" /><path d="M14 12h4v4h-4z" />
                  </svg>
                ) : item.icon === 'map' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 6v12l4-3 4 3 4-3 4 3 4-3V6l-4 3-4-3-4 3-4-3Z" /><path d="M9.5 21V10" /><path d="M14.5 21V10" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                )}
              </div>
              <span className="text-gray-300 text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-gray-600 text-sm">
          © 2025 LogistiQ — INT1334 Web Programming Final Project
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
