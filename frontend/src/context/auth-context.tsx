"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { authApi } from "@/lib/api";

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
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const sessionUser = session.user as any;
      const initialUser: User = {
        id: sessionUser.id || "",
        name: sessionUser.name || "",
        email: sessionUser.email || "",
        role: sessionUser.role || "STAFF",
        phone: sessionUser.phone,
        avatar: sessionUser.image || undefined,
        managedWarehouses: sessionUser.managedWarehouses || [],
      };
      setUser(initialUser);

      // Refresh user data from backend to pick up latest managedWarehouses
      // (in case the session was created before warehouse assignment was fixed)
      (async () => {
        try {
          const res = await authApi.me();
          const freshData = res.data?.data;
          if (freshData) {
            setUser({
              id: freshData.id || initialUser.id,
              name: freshData.name || initialUser.name,
              email: freshData.email || initialUser.email,
              role: freshData.role || initialUser.role,
              phone: freshData.phone || initialUser.phone,
              avatar: freshData.avatar || initialUser.avatar,
              managedWarehouses: freshData.managedWarehouses || [],
            });
          }
        } catch {
          // Backend unavailable — keep session data (works with mock login)
        }
      })();
    } else if (status === "unauthenticated") {
      setUser(null);
    }
  }, [session, status]);

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/auth/login" });
  }, []);

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
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
