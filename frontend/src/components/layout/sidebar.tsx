"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Warehouse, Truck, QrCode,
  Bell, Settings, LogOut, ChevronLeft, Users, BarChart3,
} from "lucide-react";

const navItems = [
  {
    group: "Tổng quan",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/dashboard/analytics", icon: BarChart3, label: "Phân tích" },
    ],
  },
  {
    group: "Kho hàng",
    items: [
      { href: "/dashboard/warehouse", icon: Warehouse, label: "Quản lý kho" },
      { href: "/dashboard/inventory", icon: Package, label: "Tồn kho" },
      { href: "/dashboard/qr-scan", icon: QrCode, label: "Kiểm kho QR" },
      { href: "/dashboard/alerts", icon: Bell, label: "Cảnh báo", badge: "alerts" },
    ],
  },
  {
    group: "Vận chuyển",
    items: [
      { href: "/dashboard/shipments", icon: Truck, label: "Vận đơn" },
    ],
  },
];

const adminItems = [
  {
    group: "Quản trị",
    items: [
      { href: "/admin/users", icon: Users, label: "Người dùng" },
      { href: "/admin/settings", icon: Settings, label: "Cài đặt" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const unreadAlertCount = useAppStore((s) => s.unreadAlertCount);
  const { user, logout, isAdmin } = useAuth();

  const allItems = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-30 flex flex-col transition-all duration-300 ease-in-out",
          "border-r",
          sidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:translate-x-0 lg:w-16"
        )}
        style={{
          background: "var(--bg-sidebar)",
          borderColor: "var(--border-color)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-between h-16 px-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
            >
              <Truck size={16} color="white" />
            </div>
            {sidebarOpen && (
              <span
                className="font-bold text-lg truncate"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}
              >
                LogistiQ
              </span>
            )}
          </Link>
          {/* Collapse btn (desktop) */}
          <button
            onClick={toggleSidebar}
            className="btn-icon hidden lg:flex"
          >
            <ChevronLeft
              size={16}
              style={{
                transform: sidebarOpen ? "rotate(0)" : "rotate(180deg)",
                transition: "transform 0.3s",
                color: "var(--text-secondary)",
              }}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {allItems.map((group) => (
            <div key={group.group}>
              {sidebarOpen && (
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-2 px-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {group.group}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn("nav-item", isActive && "active", !sidebarOpen && "justify-center")}
                    >
                      <item.icon size={18} className="flex-shrink-0" />
                      {sidebarOpen && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {sidebarOpen && (item as any).badge === "alerts" && unreadAlertCount > 0 && (
                        <span
                          className="min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                          style={{ background: "#ef4444", color: "white" }}
                        >
                          {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User profile */}
        <div
          className="border-t p-3 flex-shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
              >
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {user?.name}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {user?.role === "ADMIN" ? "Quản trị viên" : user?.role === "DRIVER" ? "Tài xế" : "Nhân viên"}
                </p>
              </div>
              <button onClick={logout} className="btn-icon flex-shrink-0" title="Đăng xuất">
                <LogOut size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
          ) : (
            <button onClick={logout} className="btn-icon w-full justify-center" title="Đăng xuất">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
