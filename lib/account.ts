import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@/lib/types";

export interface CreateUserInput {
  nationalId: string;
  name: string;
  role: Role;
  subject?: string | null;
  /** Defaults to the national ID itself when omitted. */
  password?: string;
}

export async function createUser({ nationalId, name, role, subject, password }: CreateUserInput) {
  const password_hash = await hashPassword(password || nationalId);

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      national_id: nationalId,
      name,
      role,
      subject: subject ?? null,
      password_hash,
    })
    .select("id, national_id, name, role, subject")
    .single();

  if (error) throw error;
  return data;
}
