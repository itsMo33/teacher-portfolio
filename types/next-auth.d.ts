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
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    nationalId: string;
    subject?: string | null;
    restrictedCategory?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    nationalId: string;
    restrictedCategory: string | null;
  }
}
