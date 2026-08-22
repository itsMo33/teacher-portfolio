import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";

export async function getFilledSlots(teacherId: string): Promise<Set<string>> {
  const counts = await getSlotCounts(teacherId);
  return new Set(Object.keys(counts));
}

/** Maps "category:subcategory" (subcategory empty string when the section has none) to how many files were uploaded to that slot. */
export async function getSlotCounts(teacherId: string): Promise<Record<string, number>> {
  const { data } = await supabaseAdmin
    .from("attachments")
    .select("category, subcategory")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = `${row.category}:${row.subcategory ?? ""}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function getHasSchedule(teacherId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("schedules")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .is("deleted_at", null);
  return (count ?? 0) > 0;
}

/** Section keys (from the admin-managed sections, excluding schedule) that have at least one attachment the teacher hasn't opened yet. */
export async function getUnviewedAdminSectionKeys(teacherId: string): Promise<Set<string>> {
  const adminCategories = PORTFOLIO_SECTIONS.filter((s) => !s.teacherWritable && s.key !== "schedule").map(
    (s) => s.key
  );

  const { data } = await supabaseAdmin
    .from("attachments")
    .select("category")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .is("viewed_at", null)
    .in("category", adminCategories);

  return new Set((data ?? []).map((row) => row.category));
}

export async function getHasUnviewedSchedule(teacherId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("schedules")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .is("viewed_at", null);
  return (count ?? 0) > 0;
}

export async function getSectionAttachments(
  teacherId: string,
  category: string,
  subcategory: string | null
) {
  let query = supabaseAdmin
    .from("attachments")
    .select("id, file_name, file_path, mime_type, uploaded_at, viewed_at, admin_viewed_at")
    .eq("teacher_id", teacherId)
    .eq("category", category)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  query = subcategory ? query.eq("subcategory", subcategory) : query.is("subcategory", null);

  const { data } = await query;

  return Promise.all(
    (data ?? []).map(async (a) => ({
      ...a,
      signedUrl: await getSignedUrl(PORTFOLIO_BUCKET, a.file_path),
    }))
  );
}
