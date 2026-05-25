"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/context/theme-context";
import { AuthProvider } from "@/context/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
