import type { Role } from "@/lib/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      nationalId: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    nationalId: string;
    subject?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    nationalId: string;
  }
}
