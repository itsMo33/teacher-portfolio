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

/** ?sectionId= / ?teacherId= filter to one; ?all=true (used by the master-grid view) returns
 *  every slot across every section and teacher. */
export async function GET(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const sectionId = req.nextUrl.searchParams.get("sectionId");
  const teacherId = req.nextUrl.searchParams.get("teacherId");
  const all = req.nextUrl.searchParams.get("all") === "true";
  if (!sectionId && !teacherId && !all) {
    return NextResponse.json({ error: "Provide sectionId, teacherId, or all=true" }, { status: 400 });
  }

  let query = supabaseAdmin.from("schedule_slots").select(SLOT_SELECT);
  if (sectionId) query = query.eq("section_id", sectionId);
  else if (teacherId) query = query.eq("teacher_id", teacherId);

  const { data, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({ slots: (data ?? []).map(toSlot) });
}

/** Assigns one (section, day, period) slot to a teacher+subject. Refuses if the teacher isn't
 *  assigned that subject, or if they're already teaching a different section at that exact time. */
export async function PUT(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const { sectionId, day, period, teacherId, subjectId } = await req.json();
  if (!sectionId || !day || !period || !teacherId || !subjectId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!SCHEDULE_DAYS.includes(day) || !SCHEDULE_PERIODS.includes(period)) {
    return NextResponse.json({ error: "Invalid day or period" }, { status: 400 });
  }

  const { data: assignment } = await supabaseAdmin
    .from("teacher_subjects")
    .select("teacher_id")
    .eq("teacher_id", teacherId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (!assignment) {
    return NextResponse.json({ error: "هذا المعلم غير مسجّل لهذه المادة -- أضفها له أولاً من صفحة المواد" }, { status: 400 });
  }

  const { data, error: upsertError } = await supabaseAdmin
    .from("schedule_slots")
    .upsert(
      { section_id: sectionId, day, period, teacher_id: teacherId, subject_id: subjectId, updated_at: new Date().toISOString() },
      { onConflict: "section_id,day,period" }
    )
    .select(SLOT_SELECT)
    .single();

  if (upsertError) {
    if (upsertError.code === "23505" && upsertError.message.includes("teacher_id_day_period")) {
      const { data: conflict } = await supabaseAdmin
        .from("schedule_slots")
        .select("section_id, class_sections(name_ar)")
        .eq("teacher_id", teacherId)
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
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ slot: toSlot(data) });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const { sectionId, day, period } = await req.json();
  if (!sectionId || !day || !period) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("schedule_slots")
    .delete()
    .eq("section_id", sectionId)
    .eq("day", day)
    .eq("period", period);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
