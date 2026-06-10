"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { setAccessToken } from "@/lib/api";

interface ManagedWarehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  province: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
  phone?: string;
  avatar?: string;
  managedWarehouses?: ManagedWarehouse[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isStaffOnly: boolean;
  isDriver: boolean;
  managedWarehouse: ManagedWarehouse | null;
  managedWarehouses: ManagedWarehouse[];
  staffedWarehouses: ManagedWarehouse[];
  assignedWarehouses: ManagedWarehouse[];
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAdmin: false,
  isManager: false,
  isStaff: false,
  isStaffOnly: false,
  isDriver: false,
  managedWarehouse: null,
  managedWarehouses: [],
  staffedWarehouses: [],
  assignedWarehouses: [],
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);

  // Sync user object khi session thay đổi
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const su = session.user as any;
      setUser({
        id: su.id || "",
        name: su.name || "",
        email: su.email || "",
        role: su.role || "STAFF",
        phone: su.phone,
        avatar: su.image || undefined,
        managedWarehouses: su.managedWarehouses || [],
      });
    } else if (status === "unauthenticated") {
      setUser(null);
    }
  }, [session, status]);

  // Sync access token riêng — bỏ qua mock token để tránh 401
  useEffect(() => {
    if (status === "authenticated" && session) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const token = (session as any).accessToken as string | undefined;
      setAccessToken(token?.startsWith("mock-") ? null : token ?? null);
    } else if (status === "unauthenticated") {
      setAccessToken(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/auth/login" });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const managedWarehouses = ((session?.user as any)?.managedWarehouses as ManagedWarehouse[]) || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffedWarehouses = ((session?.user as any)?.staffedWarehouses as ManagedWarehouse[]) || [];
  const assignedWarehouses = [...managedWarehouses, ...staffedWarehouses];

  const managedWarehouse = user?.managedWarehouses && user.managedWarehouses.length > 0
    ? user.managedWarehouses[0]
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: status === "loading",
        isAdmin: user?.role === "ADMIN",
        isManager: user?.role === "MANAGER" || user?.role === "ADMIN",
        isStaff: user?.role === "STAFF" || user?.role === "MANAGER" || user?.role === "ADMIN",
        isStaffOnly: user?.role === "STAFF",
        isDriver: user?.role === "DRIVER",
        managedWarehouse,
        managedWarehouses,
        staffedWarehouses,
        assignedWarehouses,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
