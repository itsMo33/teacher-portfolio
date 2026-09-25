import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

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

const SELECT = "id, section_id, subject_id, teacher_id, periods_per_week, subjects(name_ar), users(name)";

function toRequirement(row: {
  id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  periods_per_week: number;
  subjects: { name_ar: string } | { name_ar: string }[] | null;
  users: { name: string } | { name: string }[] | null;
}) {
  const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
  const teacher = Array.isArray(row.users) ? row.users[0] : row.users;
  return {
    id: row.id,
    sectionId: row.section_id,
    subjectId: row.subject_id,
    subjectName: subject?.name_ar ?? "",
    teacherId: row.teacher_id,
    teacherName: teacher?.name ?? "",
    periodsPerWeek: row.periods_per_week,
  };
}

/** The curriculum -- every (section, subject) -> (teacher, periods/week) row, for every section. */
export async function GET() {
  const { error } = await requireAccess();
  if (error) return error;

  const { data, error: fetchError } = await supabaseAdmin.from("schedule_requirements").select(SELECT);
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({ requirements: (data ?? []).map(toRequirement) });
}

/** Upserts one (section, subject) requirement -- a section takes one subject from one teacher. */
export async function PUT(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const { sectionId, subjectId, teacherId, periodsPerWeek } = await req.json();
  if (!sectionId || !subjectId || !teacherId || !periodsPerWeek) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (typeof periodsPerWeek !== "number" || periodsPerWeek < 1 || periodsPerWeek > 35) {
    return NextResponse.json({ error: "عدد الحصص يجب أن يكون بين 1 و 35" }, { status: 400 });
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
    .from("schedule_requirements")
    .upsert(
      { section_id: sectionId, subject_id: subjectId, teacher_id: teacherId, periods_per_week: periodsPerWeek },
      { onConflict: "section_id,subject_id" }
    )
    .select(SELECT)
    .single();
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  return NextResponse.json({ requirement: toRequirement(data) });
}
