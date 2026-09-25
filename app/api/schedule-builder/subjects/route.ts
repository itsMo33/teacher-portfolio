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
    .from("subjects")
    .select("id, name_ar")
    .order("name_ar", { ascending: true });
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({ subjects: (data ?? []).map((s) => ({ id: s.id, nameAr: s.name_ar })) });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const { nameAr } = await req.json();
  if (!nameAr || typeof nameAr !== "string" || !nameAr.trim()) {
    return NextResponse.json({ error: "Missing nameAr" }, { status: 400 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("subjects")
    .insert({ name_ar: nameAr.trim() })
    .select("id, name_ar")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "هذه المادة موجودة مسبقًا" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ subject: { id: data.id, nameAr: data.name_ar } });
}
