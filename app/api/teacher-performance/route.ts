import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isValidPerformanceCategory } from "@/lib/teacher-performance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Full admin only -- this tool must never be reachable by a teacher account (even one carrying a
 *  restricted_category), since its whole point is tracking things the teacher shouldn't see. */
async function requireFullAdmin() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role === "teacher" || session.user.restrictedCategory) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: NextRequest) {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date (expected YYYY-MM-DD)" }, { status: 400 });
  }

  const [{ data: teachers, error: teachersError }, { data: records, error: recordsError }] = await Promise.all([
    supabaseAdmin.from("users").select("id, name").eq("role", "teacher").is("deleted_at", null).order("name"),
    supabaseAdmin
      .from("teacher_performance_records")
      .select("teacher_id, category, status")
      .eq("record_date", date),
  ]);

  if (teachersError) return NextResponse.json({ error: teachersError.message }, { status: 500 });
  if (recordsError) return NextResponse.json({ error: recordsError.message }, { status: 500 });

  return NextResponse.json({
    teachers: teachers ?? [],
    records: (records ?? []).map((r) => ({ teacherId: r.teacher_id, category: r.category, status: r.status })),
  });
}

/** Sets a teacher's status for one (category, date) slot. */
export async function PUT(req: NextRequest) {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const { teacherId, category, date, status } = await req.json();
  if (!teacherId || !category || !date || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!isValidPerformanceCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (status !== "present" && status !== "absent") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error: upsertError } = await supabaseAdmin
    .from("teacher_performance_records")
    .upsert(
      { teacher_id: teacherId, category, record_date: date, status, updated_at: new Date().toISOString() },
      { onConflict: "teacher_id,category,record_date" }
    );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** Clears a teacher's mark for one (category, date) slot, reverting it to that category's default (assumed-present or blank). */
export async function DELETE(req: NextRequest) {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const { teacherId, category, date } = await req.json();
  if (!teacherId || !category || !date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("teacher_performance_records")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("category", category)
    .eq("record_date", date);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
