"use client";

import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldBan } from "lucide-react";

type AllowedRoles = ("ADMIN" | "MANAGER" | "STAFF" | "DRIVER")[];

interface RoleGuardProps {
  /** Roles that are allowed to view this content */
  allowedRoles: AllowedRoles;
  /** Optional fallback — if omitted, redirects to /dashboard */
  fallback?: "redirect" | "denied";
  children: React.ReactNode;
}

/** Restrict content to specific roles */
export function RoleGuard({ allowedRoles, fallback = "redirect", children }: RoleGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;
    if (fallback === "redirect" && !allowedRoles.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, allowedRoles, fallback, router]);

  if (isLoading) return null;
  if (!user) return null;

  if (!allowedRoles.includes(user.role)) {
    if (fallback === "denied") {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <ShieldBan size={64} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Truy cập bị từ chối</h2>
          <p className="text-sm max-w-md" style={{ color: "var(--text-secondary)" }}>
            Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.
          </p>
        </div>
      );
    }
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}

/** Restrict action buttons to specific roles — returns true if allowed */
export function useCanAccess(allowedRoles: AllowedRoles): boolean {
  const { user, isLoading } = useAuth();
  if (isLoading || !user) return false;
  return allowedRoles.includes(user.role);
}
