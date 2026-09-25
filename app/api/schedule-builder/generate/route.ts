import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ScheduleDay, SchedulePeriod } from "@/lib/schedule-builder";
import { GeneratorTask, runGenerator, slotKey } from "@/lib/schedule-generator";

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

export async function POST(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const clearFirst = body?.clearFirst === true;

  const [{ data: sections }, { data: requirements }, { data: unavailabilityRows }] = await Promise.all([
    supabaseAdmin.from("class_sections").select("id, name_ar"),
    supabaseAdmin
      .from("schedule_requirements")
      .select("id, section_id, subject_id, teacher_id, periods_per_week, subjects(name_ar), users(name)"),
    supabaseAdmin.from("teacher_unavailability").select("teacher_id, day, period"),
  ]);

  if (!requirements || requirements.length === 0) {
    return NextResponse.json({ error: "ما فيه أي متطلبات (مواد لشعب) بعد -- أضفها من تبويب المتطلبات أولاً" }, { status: 400 });
  }

  const sectionNameById = new Map((sections ?? []).map((s) => [s.id, s.name_ar]));

  if (clearFirst) {
    const { error: clearError } = await supabaseAdmin.from("schedule_slots").delete().not("id", "is", null);
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const { data: existingSlots, error: slotsError } = await supabaseAdmin
    .from("schedule_slots")
    .select("section_id, subject_id, teacher_id, day, period");
  if (slotsError) return NextResponse.json({ error: slotsError.message }, { status: 500 });

  const sectionBusy = new Map<string, Set<string>>();
  const teacherBusy = new Map<string, Set<string>>();
  const subjectDayCount = new Map<string, number>();
  const alreadyPlacedByRequirement = new Map<string, number>();

  for (const slot of existingSlots ?? []) {
    const key = slotKey(slot.day, slot.period);
    if (!sectionBusy.has(slot.section_id)) sectionBusy.set(slot.section_id, new Set());
    if (!teacherBusy.has(slot.teacher_id)) teacherBusy.set(slot.teacher_id, new Set());
    sectionBusy.get(slot.section_id)!.add(key);
    teacherBusy.get(slot.teacher_id)!.add(key);
    const dayCountKey = `${slot.section_id}::${slot.subject_id}::${slot.day}`;
    subjectDayCount.set(dayCountKey, (subjectDayCount.get(dayCountKey) ?? 0) + 1);
    const reqKey = `${slot.section_id}::${slot.subject_id}::${slot.teacher_id}`;
    alreadyPlacedByRequirement.set(reqKey, (alreadyPlacedByRequirement.get(reqKey) ?? 0) + 1);
  }

  const unavailability = new Map<string, { days: Set<string>; periods: Set<string>; exact: Set<string> }>();
  for (const row of unavailabilityRows ?? []) {
    if (!unavailability.has(row.teacher_id)) {
      unavailability.set(row.teacher_id, { days: new Set(), periods: new Set(), exact: new Set() });
    }
    const entry = unavailability.get(row.teacher_id)!;
    if (row.day && row.period) entry.exact.add(slotKey(row.day, row.period));
    else if (row.day) entry.days.add(row.day);
    else if (row.period) entry.periods.add(row.period);
  }
  const isUnavailable = (teacherId: string, day: ScheduleDay, period: SchedulePeriod) => {
    const entry = unavailability.get(teacherId);
    if (!entry) return false;
    return entry.days.has(day) || entry.periods.has(period) || entry.exact.has(slotKey(day, period));
  };

  const tasks: GeneratorTask[] = [];
  for (const req of requirements) {
    const subject = Array.isArray(req.subjects) ? req.subjects[0] : req.subjects;
    const teacher = Array.isArray(req.users) ? req.users[0] : req.users;
    const reqKey = `${req.section_id}::${req.subject_id}::${req.teacher_id}`;
    const alreadyPlaced = alreadyPlacedByRequirement.get(reqKey) ?? 0;
    const remainingNeeded = Math.max(0, req.periods_per_week - alreadyPlaced);
    for (let i = 0; i < remainingNeeded; i++) {
      tasks.push({
        requirementId: req.id,
        sectionId: req.section_id,
        sectionName: sectionNameById.get(req.section_id) ?? "",
        subjectId: req.subject_id,
        subjectName: subject?.name_ar ?? "",
        teacherId: req.teacher_id,
        teacherName: teacher?.name ?? "",
      });
    }
  }

  if (tasks.length === 0) {
    return NextResponse.json({
      placedCount: 0,
      unmetCount: 0,
      unmet: [],
      totalTasks: 0,
      message: "الجدول مكتمل مسبقًا حسب المتطلبات الحالية",
    });
  }

  const { placements, unmet } = runGenerator(tasks, sectionBusy, teacherBusy, subjectDayCount, isUnavailable);

  if (placements.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("schedule_slots").insert(
      placements.map((p) => ({
        section_id: p.sectionId,
        subject_id: p.subjectId,
        teacher_id: p.teacherId,
        day: p.day,
        period: p.period,
      }))
    );
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const unmetSummary = Object.values(
    unmet.reduce(
      (acc: Record<string, { sectionName: string; subjectName: string; teacherName: string; missing: number }>, t) => {
        const k = `${t.sectionId}::${t.subjectId}::${t.teacherId}`;
        if (!acc[k]) acc[k] = { sectionName: t.sectionName, subjectName: t.subjectName, teacherName: t.teacherName, missing: 0 };
        acc[k].missing++;
        return acc;
      },
      {}
    )
  );

  return NextResponse.json({
    placedCount: placements.length,
    unmetCount: unmet.length,
    unmet: unmetSummary,
    totalTasks: tasks.length,
  });
}
