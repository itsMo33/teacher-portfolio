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

/** Drag-and-drop support: moves one existing slot to a new (day, period), keeping its teacher,
 *  subject and section unchanged. Unlike the section-grid's PUT /slots (which upserts and treats
 *  a section-slot collision as an intentional replace), this is a plain UPDATE by row id -- if the
 *  destination is already taken by the teacher or the section, the unique constraint rejects it
 *  and the original row is left untouched, so the caller can surface exactly what's in the way. */
export async function POST(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const { slotId, day, period } = await req.json();
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

  const { data, error: updateError } = await supabaseAdmin
    .from("schedule_slots")
    .update({ day, period, updated_at: new Date().toISOString() })
    .eq("id", slotId)
    .select(SLOT_SELECT)
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      if (updateError.message.includes("teacher_id_day_period")) {
        const { data: conflict } = await supabaseAdmin
          .from("schedule_slots")
          .select("class_sections(name_ar)")
          .eq("teacher_id", existing.teacher_id)
          .eq("day", day)
          .eq("period", period)
          .maybeSingle();
        const conflictSection = conflict
          ? (Array.isArray(conflict.class_sections) ? conflict.class_sections[0] : conflict.class_sections)?.name_ar
          : null;
        return NextResponse.json(
          {
            error: conflictSection
              ? `المعلم مشغول في هذا الوقت -- يدرّس شعبة ${conflictSection}`
              : "المعلم مشغول في هذا الوقت بشعبة أخرى",
          },
          { status: 409 }
        );
      }
      if (updateError.message.includes("section_id_day_period")) {
        const { data: conflict } = await supabaseAdmin
          .from("schedule_slots")
          .select("users(name), subjects(name_ar)")
          .eq("section_id", existing.section_id)
          .eq("day", day)
          .eq("period", period)
          .maybeSingle();
        const conflictTeacher = conflict ? (Array.isArray(conflict.users) ? conflict.users[0] : conflict.users) : null;
        const conflictSubject = conflict
          ? (Array.isArray(conflict.subjects) ? conflict.subjects[0] : conflict.subjects)
          : null;
        return NextResponse.json(
          {
            error:
              conflictTeacher && conflictSubject
                ? `هذه الخانة مشغولة بمادة ${conflictSubject.name_ar} مع ${conflictTeacher.name}`
                : "هذه الخانة مشغولة بحصة أخرى",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "تعارض بالجدول -- الخانة مشغولة" }, { status: 409 });
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ slot: toSlot(data) });
}
