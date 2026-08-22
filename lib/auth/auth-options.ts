import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPassword } from "./password";
import type { Role } from "@/lib/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        nationalId: { label: "رقم الهوية", type: "text" },
        password: { label: "كلمة المرور", type: "password" },
      },
      authorize: async (credentials) => {
        const nationalId = credentials?.nationalId as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!nationalId || !password) return null;

        const { data: user, error } = await supabaseAdmin
          .from("users")
          .select("id, national_id, password_hash, role, name, subject")
          .eq("national_id", nationalId)
          .is("deleted_at", null)
          .maybeSingle();

        if (error || !user) return null;

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          role: user.role as Role,
          nationalId: user.national_id,
          subject: user.subject,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: Role }).role;
        token.nationalId = (user as { nationalId: string }).nationalId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.nationalId = token.nationalId as string;
      }
      return session;
    },
  },
});
