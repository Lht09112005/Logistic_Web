"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
  phone?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isStaffOnly: boolean;
  isDriver: boolean;
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
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setUser({
        id: (session.user as User).id || "",
        name: session.user.name || "",
        email: session.user.email || "",
        role: (session.user as User).role || "STAFF",
        phone: (session.user as User).phone,
        avatar: session.user.image || undefined,
      });
    } else if (status === "unauthenticated") {
      setUser(null);
    }
  }, [session, status]);

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/auth/login" });
  }, []);

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
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
