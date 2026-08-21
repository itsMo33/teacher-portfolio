import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";

export async function getFilledSlots(teacherId: string): Promise<Set<string>> {
  const counts = await getSlotCounts(teacherId);
  return new Set(Object.keys(counts));
}

/** Maps "category:subcategory" (subcategory empty string when the section has none) to how many files were uploaded to that slot. */
export async function getSlotCounts(teacherId: string): Promise<Record<string, number>> {
  const { data } = await supabaseAdmin
    .from("attachments")
    .select("category, subcategory")
    .eq("teacher_id", teacherId);

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
    .eq("teacher_id", teacherId);
  return (count ?? 0) > 0;
}

export async function getSectionAttachments(
  teacherId: string,
  category: string,
  subcategory: string | null
) {
  let query = supabaseAdmin
    .from("attachments")
    .select("id, file_name, file_path, mime_type, uploaded_at, viewed_at")
    .eq("teacher_id", teacherId)
    .eq("category", category)
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
