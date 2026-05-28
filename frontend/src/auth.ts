import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authApi } from "@/lib/api";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await authApi.login(
            credentials.email as string,
            credentials.password as string
          );
          const { user, accessToken, refreshToken } = res.data.data;
          return { ...user, accessToken, refreshToken };
        } catch (error: any) {
          console.error("====== MOCK LOGIN FALLBACK ERROR ======");
          console.error(error?.response?.data || error?.message || error);
          console.error("=======================================");
          // Mock login fallback if backend/DB is offline to let user explore the UI
          const email = credentials.email as string;
          const password = credentials.password as string;
          if (email === "admin@logistiq.vn" && password === "admin123") {
            return {
              id: "mock-admin-id",
              name: "Nguyễn Văn Admin (Offline)",
              email: "admin@logistiq.vn",
              role: "ADMIN",
              phone: "0901234567",
              accessToken: "mock-access-token",
              refreshToken: "mock-refresh-token",
            };
          }
          if (email === "nam@logistiq.vn" && password === "staff123") {
            return {
              id: "mock-staff-id",
              name: "Trần Văn Nam (Offline)",
              email: "nam@logistiq.vn",
              role: "STAFF",
              phone: "0912345678",
              accessToken: "mock-access-token",
              refreshToken: "mock-refresh-token",
            };
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as any).role;
        token.phone = (user as any).phone;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).phone = token.phone;
        (session as any).accessToken = token.accessToken;
        (session as any).refreshToken = token.refreshToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
});
