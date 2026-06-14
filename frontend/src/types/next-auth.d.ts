import "next-auth";
import "next-auth/jwt";

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
    accessToken?: string;
    refreshToken?: string;
    user: {
      id: string;
      accessToken?: string;
      refreshToken?: string;
      role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
      phone?: string;
      managedWarehouses?: ManagedWarehouse[];
      staffedWarehouses?: ManagedWarehouse[];
    } & DefaultSession["user"];
  }

  interface User {
    accessToken?: string;
    refreshToken?: string;
    role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
    phone?: string;
    managedWarehouses?: ManagedWarehouse[];
    staffedWarehouses?: ManagedWarehouse[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
    phone?: string;
    managedWarehouses?: ManagedWarehouse[];
    staffedWarehouses?: ManagedWarehouse[];
  }
}
