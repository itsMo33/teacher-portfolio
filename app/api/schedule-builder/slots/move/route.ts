import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SCHEDULE_DAYS, SCHEDULE_PERIODS, SLOT_SELECT, toSlot } from "@/lib/schedule-builder";

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

async function findConflict(
  kind: "teacher" | "section",
  existing: { teacher_id: string; section_id: string },
  day: string,
  period: string
) {
  if (kind === "teacher") {
    const { data } = await supabaseAdmin
      .from("schedule_slots")
      .select("id, section_id, teacher_id, class_sections(name_ar)")
      .eq("teacher_id", existing.teacher_id)
      .eq("day", day)
      .eq("period", period)
      .maybeSingle();
    if (!data) return null;
    const section = Array.isArray(data.class_sections) ? data.class_sections[0] : data.class_sections;
    return {
      conflictSlotId: data.id,
      conflictTeacherId: data.teacher_id,
      conflictSectionId: data.section_id,
      message: section?.name_ar
        ? `المعلم مشغول في هذا الوقت -- يدرّس شعبة ${section.name_ar}`
        : "المعلم مشغول في هذا الوقت بشعبة أخرى",
    };
  }
  const { data } = await supabaseAdmin
    .from("schedule_slots")
    .select("id, section_id, teacher_id, users(name), subjects(name_ar)")
    .eq("section_id", existing.section_id)
    .eq("day", day)
    .eq("period", period)
    .maybeSingle();
  if (!data) return null;
  const teacher = Array.isArray(data.users) ? data.users[0] : data.users;
  const subject = Array.isArray(data.subjects) ? data.subjects[0] : data.subjects;
  return {
    conflictSlotId: data.id,
    conflictTeacherId: data.teacher_id,
    conflictSectionId: data.section_id,
    message:
      teacher && subject
        ? `هذه الخانة مشغولة بمادة ${subject.name_ar} مع ${teacher.name}`
        : "هذه الخانة مشغولة بحصة أخرى",
  };
}

/** Drag-and-drop support: moves one existing slot to a new (day, period), keeping its teacher,
 *  subject and section unchanged. This is a plain UPDATE by row id -- if the destination is
 *  already taken by the teacher or the section, the unique constraint rejects it and the original
 *  row is left untouched. With `force: true`, a real conflict is resolved aSc-style: the
 *  conflicting slot is deleted first and the move retried, instead of just refusing. */
export async function POST(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const { slotId, day, period, force } = await req.json();
  if (!slotId || !day || !period) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!SCHEDULE_DAYS.includes(day) || !SCHEDULE_PERIODS.includes(period)) {
    return NextResponse.json({ error: "Invalid day or period" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("schedule_slots")
    .select("id, section_id, teacher_id")
    .eq("id", slotId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "الحصة غير موجودة" }, { status: 404 });
  }

  async function attemptUpdate() {
    return supabaseAdmin
      .from("schedule_slots")
      .update({ day, period, updated_at: new Date().toISOString() })
      .eq("id", slotId)
      .select(SLOT_SELECT)
      .single();
  }

  const { data, error: updateError } = await attemptUpdate();

  if (!updateError) {
    return NextResponse.json({ slot: toSlot(data) });
  }
  if (updateError.code !== "23505") {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const kind = updateError.message.includes("teacher_id_day_period") ? "teacher" : "section";
  const conflict = await findConflict(kind, existing, day, period);
  if (!conflict) {
    return NextResponse.json({ error: "تعارض بالجدول -- الخانة مشغولة" }, { status: 409 });
  }

  if (!force) {
    return NextResponse.json({ error: conflict.message, conflict }, { status: 409 });
  }

  const { error: deleteError } = await supabaseAdmin.from("schedule_slots").delete().eq("id", conflict.conflictSlotId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const { data: retryData, error: retryError } = await attemptUpdate();
  if (retryError) {
    return NextResponse.json({ error: retryError.message }, { status: 500 });
  }

  return NextResponse.json({ slot: toSlot(retryData), removedConflict: conflict });
}
