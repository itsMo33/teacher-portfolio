import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

/** A lightweight teacher list scoped to the schedule builder -- separate from /api/teachers (which
 *  blocks any teacher-role account outright) since مؤيد accesses this as a teacher-role account
 *  granted canBuildSchedule. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isFullAdmin = session.user.role !== "teacher" && !session.user.restrictedCategory;
  const isGrantedTeacher = session.user.role === "teacher" && session.user.canBuildSchedule;
  if (!isFullAdmin && !isGrantedTeacher) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("role", "teacher")
    .is("deleted_at", null)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ teachers: data ?? [] });
}
