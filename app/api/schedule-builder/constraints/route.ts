import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SCHEDULE_DAYS, SCHEDULE_PERIODS } from "@/lib/schedule-builder";

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

/** Every teacher-unavailability row, for every teacher -- small dataset, fetched once. */
export async function GET() {
  const { error } = await requireAccess();
  if (error) return error;

  const { data, error: fetchError } = await supabaseAdmin
    .from("teacher_unavailability")
    .select("id, teacher_id, day, period");
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({
    constraints: (data ?? []).map((r) => ({ id: r.id, teacherId: r.teacher_id, day: r.day, period: r.period })),
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const { teacherId, day, period } = await req.json();
  if (!teacherId) return NextResponse.json({ error: "Missing teacherId" }, { status: 400 });
  if (!day && !period) {
    return NextResponse.json({ error: "حدد يوم أو حصة على الأقل" }, { status: 400 });
  }
  if (day && !SCHEDULE_DAYS.includes(day)) {
    return NextResponse.json({ error: "يوم غير صالح" }, { status: 400 });
  }
  if (period && !SCHEDULE_PERIODS.includes(period)) {
    return NextResponse.json({ error: "حصة غير صالحة" }, { status: 400 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("teacher_unavailability")
    .insert({ teacher_id: teacherId, day: day || null, period: period || null })
    .select("id, teacher_id, day, period")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({
    constraint: { id: data.id, teacherId: data.teacher_id, day: data.day, period: data.period },
  });
}
