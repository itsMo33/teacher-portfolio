import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { weekStartOf } from "@/lib/teacher-performance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Same rule as the rest of متابعة أداء المعلمين: full admin only, never a teacher account. */
async function requireFullAdmin() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role === "teacher" || session.user.restrictedCategory) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Yellow/red marks for the week containing `date`, as { teacherId, status }. */
export async function GET(req: NextRequest) {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) return NextResponse.json({ error: "Missing or invalid date" }, { status: 400 });

  const { data, error: queryError } = await supabaseAdmin
    .from("madrasati_prep_weeks")
    .select("teacher_id, status")
    .eq("week_start", weekStartOf(date));
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });

  return NextResponse.json({
    weekStart: weekStartOf(date),
    marks: (data ?? []).map((r) => ({ teacherId: r.teacher_id, status: r.status })),
  });
}

/** Sets a teacher's mark for the week containing `date`; "green" clears it back to the default. */
export async function PUT(req: NextRequest) {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const { teacherId, date, status } = await req.json();
  if (typeof teacherId !== "string" || typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }
  if (status !== "green" && status !== "yellow" && status !== "red") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const weekStart = weekStartOf(date);

  const result =
    status === "green"
      ? await supabaseAdmin.from("madrasati_prep_weeks").delete().eq("teacher_id", teacherId).eq("week_start", weekStart)
      : await supabaseAdmin
          .from("madrasati_prep_weeks")
          .upsert(
            { teacher_id: teacherId, week_start: weekStart, status, updated_at: new Date().toISOString() },
            { onConflict: "teacher_id,week_start" }
          );

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
