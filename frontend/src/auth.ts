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
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          
          if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            throw new Error(errorData?.message || `HTTP ${res.status}`);
          }
          
          const json = await res.json();
          const { user, tokens } = json.data;
          const accessToken = tokens?.accessToken || json.data?.accessToken;
          const refreshToken = tokens?.refreshToken || json.data?.refreshToken;
          return { ...user, accessToken, refreshToken };
        } catch (error: unknown) {
          console.error("====== LOGIN ERROR ======");
          console.error((error as Error)?.message || error);
          console.error("=========================");
          return null; // Return null to reject login
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role!;
        token.phone = user.phone;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.managedWarehouses = user.managedWarehouses;
        token.staffedWarehouses = user.staffedWarehouses;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role!;
        session.user.phone = token.phone;
        // Gắn thẳng vào session và session.user để đảm bảo không bị NextAuth filter mất
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        session.user.accessToken = token.accessToken;
        session.user.refreshToken = token.refreshToken;
        session.user.managedWarehouses = token.managedWarehouses;
        session.user.staffedWarehouses = token.staffedWarehouses;
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
