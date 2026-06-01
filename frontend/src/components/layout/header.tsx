"use client";

import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/context/theme-context";
import { useAuth } from "@/context/auth-context";
import { Menu, Bell, Sun, Moon, Search } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const unreadAlertCount = useAppStore((s) => s.unreadAlertCount);
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  // Tài xế không cần header
  if (user?.role === 'DRIVER') return null;

  return (
    <header
      className="fixed top-0 right-0 z-10 h-16 flex items-center px-4 gap-4 border-b transition-all duration-300"
      style={{
        left: sidebarOpen ? "256px" : "64px",
        background: "var(--bg-card)",
        borderColor: "var(--border-color)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Mobile hamburger */}
      <button
        id="sidebar-toggle"
        onClick={toggleSidebar}
        className="btn-icon lg:hidden"
      >
        <Menu size={20} />
      </button>

      {title && (
        <h1
          className="text-lg font-bold hidden sm:block"
          style={{ color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {title}
        </h1>
      )}

      {/* Search */}
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="search"
            placeholder="Tìm kiếm vận đơn, sản phẩm, kho..."
            className="input-base pl-9 py-2 text-sm"
            style={{ height: "38px" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Theme toggle */}
        <button
          id="theme-toggle"
          onClick={toggleTheme}
          className="btn-icon"
          title={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Alerts */}
        <Link href="/dashboard/alerts" className="btn-icon relative" id="header-alerts">
          <Bell size={18} />
          {unreadAlertCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ background: "#ef4444", color: "white", fontSize: "10px" }}
            >
              {unreadAlertCount > 9 ? "9+" : unreadAlertCount}
            </span>
          )}
        </Link>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ml-1 cursor-pointer"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
          title={user?.name}
        >
          {user?.name?.charAt(0) || "U"}
        </div>
      </div>
    </header>
  );
}
