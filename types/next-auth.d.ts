import type { Role } from "@/lib/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      nationalId: string;
      /** When set, this admin/agent account is scoped to a single إدارة المدرسة category and sees nothing else. */
      restrictedCategory: string | null;
      /** When true, this account can browse both /teacher and /admin regardless of its role, but
       *  every mutating request (any non-GET to a protected route) is blocked -- for demos/presentations. */
      demoViewOnly: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    nationalId: string;
    subject?: string | null;
    restrictedCategory?: string | null;
    demoViewOnly?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    nationalId: string;
    restrictedCategory: string | null;
    demoViewOnly: boolean;
  }
}
