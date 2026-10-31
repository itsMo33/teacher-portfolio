import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface TrackedPerson {
  id: string;
  name: string;
}

/** Everyone متابعة أداء المعلمين covers: the teachers, plus staff added just for this tracking -- people with no
 *  login of their own (role 'staff') and accounts that are tracked as well (e.g. a counselor who also covers
 *  waiting periods), flagged with track_performance. */
export async function getTrackedPeople(): Promise<{ data: TrackedPerson[] }> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .or("role.eq.teacher,track_performance.eq.true")
    .is("deleted_at", null)
    .order("name");
  return { data: (data ?? []) as TrackedPerson[] };
}
