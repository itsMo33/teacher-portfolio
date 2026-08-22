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

  // If a soft-deleted account already used this national ID, revive it instead
  // of inserting a new row (national_id is unique, so a plain insert would fail).
  const { data: existingDeleted } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("national_id", nationalId)
    .not("deleted_at", "is", null)
    .maybeSingle();

  if (existingDeleted) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ name, role, subject: subject ?? null, password_hash, deleted_at: null })
      .eq("id", existingDeleted.id)
      .select("id, national_id, name, role, subject")
      .single();

    if (error) throw error;
    return data;
  }

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
