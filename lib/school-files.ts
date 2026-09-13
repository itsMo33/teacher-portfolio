import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";

export interface SchoolManagementSubsection {
  key: string;
  labelAr: string;
}

export interface SchoolManagementCategory {
  key: string;
  labelAr: string;
  accentColor: string;
  subsections?: SchoolManagementSubsection[];
}

/** إدارة المدرسة categories, stored in the school_management_categories table so admins can add,
 *  rename, and delete them from the UI instead of needing a code change every time. */
export async function getSchoolManagementCategories(): Promise<SchoolManagementCategory[]> {
  const { data } = await supabaseAdmin
    .from("school_management_categories")
    .select("key, label_ar, accent_color, subsections")
    .order("sort_order", { ascending: true });

  return (data ?? []).map((row) => ({
    key: row.key,
    labelAr: row.label_ar,
    accentColor: row.accent_color,
    subsections: (row.subsections as SchoolManagementSubsection[] | null)?.length
      ? (row.subsections as SchoolManagementSubsection[])
      : undefined,
  }));
}

export async function getSchoolManagementCategory(key: string): Promise<SchoolManagementCategory | undefined> {
  const categories = await getSchoolManagementCategories();
  return categories.find((c) => c.key === key);
}

export async function isValidSchoolManagementCategory(category: string): Promise<boolean> {
  return (await getSchoolManagementCategory(category)) !== undefined;
}

export async function isValidSchoolManagementSlot(category: string, subcategory: string | null): Promise<boolean> {
  const cat = await getSchoolManagementCategory(category);
  if (!cat) return false;
  if (!cat.subsections) return !subcategory;
  // A category with subsections still accepts an uncategorized ("عام") upload for files that
  // don't fit any one subsection -- shown separately as a general/catch-all bucket.
  if (!subcategory) return true;
  return cat.subsections.some((s) => s.key === subcategory);
}

export async function getSchoolFiles(category: string, subcategory: string | null = null) {
  let query = supabaseAdmin
    .from("school_files")
    .select("id, file_name, file_path, mime_type, uploaded_at")
    .eq("category", category)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  query = subcategory ? query.eq("subcategory", subcategory) : query.is("subcategory", null);

  const { data } = await query;

  return Promise.all(
    (data ?? []).map(async (f) => ({
      ...f,
      signedUrl: await getSignedUrl(PORTFOLIO_BUCKET, f.file_path),
    }))
  );
}

/** Category keys that have at least one account scoped exclusively to them -- for those, only
 *  that account can upload/delete; everyone else (full admins) gets a read-only view. */
export async function getOwnedCategoryKeys(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("restricted_category")
    .not("restricted_category", "is", null)
    .is("deleted_at", null);

  return new Set((data ?? []).map((row) => row.restricted_category as string));
}
