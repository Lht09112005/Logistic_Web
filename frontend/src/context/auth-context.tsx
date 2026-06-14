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
  staffedWarehouses?: ManagedWarehouse[];
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
      const { user: sessionUser } = session;
      setUser({
        id: sessionUser.id || "",
        name: sessionUser.name || "",
        email: sessionUser.email || "",
        role: sessionUser.role || "STAFF",
        phone: sessionUser.phone,
        avatar: sessionUser.image || undefined,
        managedWarehouses: (sessionUser.managedWarehouses as ManagedWarehouse[]) || [],
        staffedWarehouses: (sessionUser.staffedWarehouses as ManagedWarehouse[]) || [],
      });
    } else if (status === "unauthenticated") {
      setUser(null);
    }
  }, [session, status]);

  // Sync access token riêng — bỏ qua mock token để tránh 401
  useEffect(() => {
    if (status === "authenticated" && session) {
      const token = session.accessToken || (session.user as { accessToken?: string })?.accessToken;
      setAccessToken(token ?? null);
    } else if (status === "unauthenticated") {
      setAccessToken(null);
    }
  }, [session, status]);

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/auth/login" });
  }, []);

  // Lấy từ user state (đã được sync từ session) để đảm bảo nhất quán
  const managedWarehouses = user?.managedWarehouses || [];
  const staffedWarehouses = user?.staffedWarehouses || [];
  const assignedWarehouses = [...managedWarehouses, ...staffedWarehouses];

  const managedWarehouse = managedWarehouses.length > 0
    ? managedWarehouses[0]
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
