import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";

export async function getFilledSlots(teacherId: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("attachments")
    .select("category, subcategory")
    .eq("teacher_id", teacherId);

  const slots = new Set<string>();
  for (const row of data ?? []) {
    slots.add(`${row.category}:${row.subcategory ?? ""}`);
  }
  return slots;
}

export async function getSectionAttachments(
  teacherId: string,
  category: string,
  subcategory: string | null
) {
  let query = supabaseAdmin
    .from("attachments")
    .select("id, file_name, file_path, mime_type, uploaded_at")
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
