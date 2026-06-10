"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/context/theme-context";
import { useAuth } from "@/context/auth-context";
import { Menu, Sun, Moon, Search } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const isDriver = user?.role === "DRIVER";

  // Hydration safety: theme-specific content only renders after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Detect desktop (>= lg breakpoint: 1024px) for header positioning
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Avatar gradient — Driver màu xanh, các role khác màu cam
  const avatarGradient = isDriver
    ? "linear-gradient(135deg, #10b981, #059669)"
    : "linear-gradient(135deg, #f97316, #ea580c)";

  return (
    <header
      className="fixed top-0 right-0 z-10 h-16 flex items-center px-4 gap-4 border-b transition-all duration-300"
      style={{
        left: isDesktop ? (sidebarOpen ? "256px" : "64px") : "0",
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

      {/* Search — ẩn với Driver vì không cần */}
      {!isDriver && (
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
      )}

      <div className="flex items-center gap-1 ml-auto">
        {/* Theme toggle — only render themed content after mount to avoid hydration mismatch */}
        <button
          id="theme-toggle"
          onClick={toggleTheme}
          className="btn-icon"
          title={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
        >
          {mounted ? (theme === "dark" ? <Sun size={18} /> : <Moon size={18} />) : <Sun size={18} />}
        </button>

        {/* Avatar → Settings */}
        <Link href="/admin/settings">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ml-1 cursor-pointer"
            style={{ background: avatarGradient }}
            title={user?.name}
          >
            {user?.name?.charAt(0) || "U"}
          </div>
        </Link>
      </div>
    </header>
  );
}
