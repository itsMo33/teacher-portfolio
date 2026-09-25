import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

async function requireAccess() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const isFullAdmin = session.user.role !== "teacher" && !session.user.restrictedCategory;
  const isGrantedTeacher = session.user.role === "teacher" && session.user.canBuildSchedule;
  if (!isFullAdmin && !isGrantedTeacher) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const { error } = await requireAccess();
  if (error) return error;

  const { data, error: fetchError } = await supabaseAdmin
    .from("class_sections")
    .select("id, name_ar, sort_order")
    .order("sort_order", { ascending: true });
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({
    sections: (data ?? []).map((s) => ({ id: s.id, nameAr: s.name_ar, sortOrder: s.sort_order })),
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const { nameAr } = await req.json();
  if (!nameAr || typeof nameAr !== "string" || !nameAr.trim()) {
    return NextResponse.json({ error: "Missing nameAr" }, { status: 400 });
  }

  const { data: maxRow } = await supabaseAdmin
    .from("class_sections")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error: insertError } = await supabaseAdmin
    .from("class_sections")
    .insert({ name_ar: nameAr.trim(), sort_order: nextSortOrder })
    .select("id, name_ar, sort_order")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "هذه الشعبة موجودة مسبقًا" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ section: { id: data.id, nameAr: data.name_ar, sortOrder: data.sort_order } });
}
