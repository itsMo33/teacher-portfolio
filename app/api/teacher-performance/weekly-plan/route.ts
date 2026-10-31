import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { weekStartOf } from "@/lib/teacher-performance";
import { getWeeklyPlanStatuses } from "@/lib/weekly-plan";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Full admin only, like the rest of متابعة أداء المعلمين. */
async function requireFullAdmin() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role === "teacher" || session.user.restrictedCategory) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Who handed in the weekly plan for the week containing ?date. */
export async function GET(req: NextRequest) {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) return NextResponse.json({ error: "Missing or invalid date" }, { status: 400 });

  const weekStart = weekStartOf(date);
  return NextResponse.json({ weekStart, rows: await getWeeklyPlanStatuses(weekStart) });
}

/** Sets one teacher's status for the week by hand. Setting it back to what the uploads say clears the override. */
export async function PUT(req: NextRequest) {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const { teacherId, date, status } = await req.json();
  if (typeof teacherId !== "string" || typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (status !== "uploaded" && status !== "missing") return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const weekStart = weekStartOf(date);
  const row = (await getWeeklyPlanStatuses(weekStart)).find((r) => r.id === teacherId);
  if (!row || row.status === "na") return NextResponse.json({ error: "هذا الاسم ما عليه خطة أسبوعية" }, { status: 400 });

  const query =
    status === row.auto
      ? supabaseAdmin.from("weekly_plan_marks").delete().eq("teacher_id", teacherId).eq("week_start", weekStart)
      : supabaseAdmin
          .from("weekly_plan_marks")
          .upsert({ teacher_id: teacherId, week_start: weekStart, status, updated_at: new Date().toISOString() }, { onConflict: "teacher_id,week_start" });
  const { error: writeError } = await query;
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
