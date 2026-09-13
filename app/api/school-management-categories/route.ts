import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logActivity } from "@/lib/audit";

/** Only a full, unrestricted admin manages the إدارة المدرسة category structure -- a scoped
 *  account (e.g. الأمن والسلامة) only ever touches files inside its own single category. */
async function requireFullAdmin() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role === "teacher" || session.user.restrictedCategory) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const { data, error: fetchError } = await supabaseAdmin
    .from("school_management_categories")
    .select("key, label_ar, accent_color, subsections")
    .order("sort_order", { ascending: true });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({
    categories: (data ?? []).map((c) => ({ ...c, subsections: c.subsections ?? [] })),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireFullAdmin();
  if (error) return error;

  const { labelAr, accentColor } = await req.json();
  if (!labelAr || typeof labelAr !== "string" || !labelAr.trim()) {
    return NextResponse.json({ error: "Missing labelAr" }, { status: 400 });
  }

  const { data: maxRow } = await supabaseAdmin
    .from("school_management_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const key = `cat_${crypto.randomUUID().slice(0, 8)}`;

  const { data, error: insertError } = await supabaseAdmin
    .from("school_management_categories")
    .insert({
      key,
      label_ar: labelAr.trim(),
      accent_color: typeof accentColor === "string" && accentColor ? accentColor : "#2563eb",
      subsections: [],
      sort_order: nextSortOrder,
    })
    .select("key, label_ar, accent_color, subsections")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await logActivity({
    actorId: session!.user.id,
    actorName: session!.user.name ?? "",
    action: "create_school_category",
    details: labelAr.trim(),
  });

  return NextResponse.json({ category: data });
}
