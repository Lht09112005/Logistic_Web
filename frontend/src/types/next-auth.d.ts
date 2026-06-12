import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

interface ManagedWarehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  province: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
      phone?: string;
      managedWarehouses?: ManagedWarehouse[];
      staffedWarehouses?: ManagedWarehouse[];
    } & DefaultSession["user"];
    accessToken?: string;
    refreshToken?: string;
  }

  interface User extends DefaultUser {
    role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
    phone?: string;
    accessToken?: string;
    refreshToken?: string;
    managedWarehouses?: ManagedWarehouse[];
    staffedWarehouses?: ManagedWarehouse[];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
    phone?: string;
    accessToken?: string;
    refreshToken?: string;
    managedWarehouses?: ManagedWarehouse[];
    staffedWarehouses?: ManagedWarehouse[];
  }
}
