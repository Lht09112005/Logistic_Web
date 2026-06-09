import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Dùng NEXT_PUBLIC_ hoặc server-side env, fallback localhost
const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:5000/api";

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
          // Dùng fetch thay vì axios để tương thích server-side NextAuth
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const { user, accessToken, refreshToken } = json.data;
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
              managedWarehouses: [],
              staffedWarehouses: [{
                id: "mock-wh-hcm-id",
                name: "Kho Trung Tâm HCM",
                code: "WH-HCM-01",
                address: "123 Đường Nguyễn Văn Linh, Quận 7",
                city: "Hồ Chí Minh",
                province: "TP. Hồ Chí Minh",
              }],
            };
          }
          if (email === "manager.hcm@logistiq.vn" && password === "staff123") {
            return {
              id: "mock-manager-hcm-id",
              name: "Lê Văn Sài Gòn (Offline)",
              email: "manager.hcm@logistiq.vn",
              role: "MANAGER",
              phone: "0945678901",
              accessToken: "mock-access-token",
              refreshToken: "mock-refresh-token",
              managedWarehouses: [{
                id: "mock-wh-hcm-id",
                name: "Kho Trung Tâm HCM",
                code: "WH-HCM-01",
                address: "123 Đường Nguyễn Văn Linh, Quận 7",
                city: "Hồ Chí Minh",
                province: "TP. Hồ Chí Minh",
              }],
            };
          }
          if (email === "manager.hn@logistiq.vn" && password === "staff123") {
            return {
              id: "mock-manager-hn-id",
              name: "Nguyễn Thị Hà Nội (Offline)",
              email: "manager.hn@logistiq.vn",
              role: "MANAGER",
              phone: "0956789012",
              accessToken: "mock-access-token",
              refreshToken: "mock-refresh-token",
              managedWarehouses: [{
                id: "mock-wh-hn-id",
                name: "Kho Hà Nội",
                code: "WH-HN-01",
                address: "45 Đường Phạm Hùng, Nam Từ Liêm",
                city: "Hà Nội",
                province: "Hà Nội",
              }],
            };
          }
          if (email === "manager.dn@logistiq.vn" && password === "staff123") {
            return {
              id: "mock-manager-dn-id",
              name: "Trần Văn Đà Nẵng (Offline)",
              email: "manager.dn@logistiq.vn",
              role: "MANAGER",
              phone: "0967890123",
              accessToken: "mock-access-token",
              refreshToken: "mock-refresh-token",
              managedWarehouses: [{
                id: "mock-wh-dn-id",
                name: "Kho Đà Nẵng",
                code: "WH-DN-01",
                address: "78 Đường Trần Phú, Hải Châu",
                city: "Đà Nẵng",
                province: "Đà Nẵng",
              }],
            };
          }
          if (email === "driver1@logistiq.vn" && password === "staff123") {
            return {
              id: "mock-driver-id",
              name: "Lê Minh Đức (Offline)",
              email: "driver1@logistiq.vn",
              role: "DRIVER",
              phone: "0923456789",
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
        token.managedWarehouses = (user as any).managedWarehouses;
        token.staffedWarehouses = (user as any).staffedWarehouses;
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
        (session.user as any).managedWarehouses = token.managedWarehouses;
        (session.user as any).staffedWarehouses = token.staffedWarehouses;
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
