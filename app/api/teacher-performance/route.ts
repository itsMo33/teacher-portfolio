import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getWaitingAssignments } from "@/lib/waiting-activation";
import { getPerformanceCategory, isValidPerformanceCategory, PERFORMANCE_PERIODS } from "@/lib/teacher-performance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CLASS_TIME = "class_time_commitment";
const MAX_LATE_MINUTES = 300;

/** Full admin only -- this tool must never be reachable by a teacher account (even one carrying a
 *  restricted_category), since its whole point is tracking things the teacher shouldn't see. The one
 *  exception is an account granted the الالتزام بزمن الحصة tracker: it gets that single category only
 *  (`classTimeOnly`), which every handler below enforces. */
async function requireAccess() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const fullAdmin = session.user.role !== "teacher" && !session.user.restrictedCategory;
  if (!fullAdmin && !session.user.canTrackClassTime) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, classTimeOnly: !fullAdmin };
}

export async function GET(req: NextRequest) {
  const { error, classTimeOnly } = await requireAccess();
  if (error) return error;

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date (expected YYYY-MM-DD)" }, { status: 400 });
  }

  const [{ data: teachers, error: teachersError }, { data: records, error: recordsError }] = await Promise.all([
    supabaseAdmin.from("users").select("id, name").eq("role", "teacher").is("deleted_at", null).order("name"),
    supabaseAdmin
      .from("teacher_performance_records")
      .select("teacher_id, category, status, period, late_minutes, recorded_by")
      .eq("record_date", date),
  ]);

  if (teachersError) return NextResponse.json({ error: teachersError.message }, { status: 500 });
  if (recordsError) return NextResponse.json({ error: recordsError.message }, { status: 500 });

  const recorderIds = [...new Set((records ?? []).map((x) => x.recorded_by as string | null).filter(Boolean) as string[])];
  const { data: recorders } = recorderIds.length
    ? await supabaseAdmin.from("users").select("id, name").in("id", recorderIds)
    : { data: [] };
  const recorderName = new Map((recorders ?? []).map((u) => [u.id as string, u.name as string]));

  const waiting = (await getWaitingAssignments([date], teachers ?? [])).get(date)!;

  return NextResponse.json({
    teachers: teachers ?? [],
    waiting: [...waiting].map(([teacherId, periods]) => ({ teacherId, periods })),
    records: (records ?? [])
      .filter((r) => !classTimeOnly || r.category === CLASS_TIME)
      .map((r) => ({
        teacherId: r.teacher_id,
        category: r.category,
        status: r.status,
        period: r.period || null,
        minutes: r.late_minutes ?? null,
        recordedBy: r.recorded_by ? recorderName.get(r.recorded_by as string) ?? null : null,
      })),
  });
}

/** Sets a teacher's status for one (category, date[, period]) slot. */
export async function PUT(req: NextRequest) {
  const { error, classTimeOnly, session } = await requireAccess();
  if (error) return error;

  const { teacherId, category, date, status, period, minutes } = await req.json();
  if (!teacherId || !category || !date || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!isValidPerformanceCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  if (classTimeOnly && category !== CLASS_TIME) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getPerformanceCategory(category)!;
  let periodValue = "";
  if (config.mode === "period-exception") {
    if (!period || !PERFORMANCE_PERIODS.includes(period)) {
      return NextResponse.json({ error: "Missing or invalid period" }, { status: 400 });
    }
    if (status !== "late" && status !== "absent") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    periodValue = period;
  } else if (status !== "present" && status !== "absent") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Minutes only mean something on a "late" row: a whole number of minutes, or none yet.
  let lateMinutes: number | null = null;
  if (status === "late" && minutes !== undefined && minutes !== null && minutes !== "") {
    lateMinutes = Number(minutes);
    if (!Number.isInteger(lateMinutes) || lateMinutes < 1 || lateMinutes > MAX_LATE_MINUTES) {
      return NextResponse.json({ error: "عدد الدقائق غير صحيح" }, { status: 400 });
    }
  }

  const { error: upsertError } = await supabaseAdmin.from("teacher_performance_records").upsert(
    {
      teacher_id: teacherId,
      category,
      record_date: date,
      status,
      period: periodValue,
      late_minutes: lateMinutes,
      recorded_by: session.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "teacher_id,category,record_date,period" }
  );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** Clears a teacher's mark for one (category, date[, period]) slot, reverting it to that category's default. */
export async function DELETE(req: NextRequest) {
  const { error, classTimeOnly } = await requireAccess();
  if (error) return error;

  const { teacherId, category, date, period } = await req.json();
  if (!teacherId || !category || !date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (classTimeOnly && category !== CLASS_TIME) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("teacher_performance_records")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("category", category)
    .eq("record_date", date)
    .eq("period", period || "");

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
