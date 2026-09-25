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

/** Every (teacher, subject) pair currently assigned, for every teacher -- small dataset, fetched
 *  once and combined client-side with /api/teachers and /api/schedule-builder/subjects. */
export async function GET() {
  const { error } = await requireAccess();
  if (error) return error;

  const { data, error: fetchError } = await supabaseAdmin.from("teacher_subjects").select("teacher_id, subject_id");
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({
    assignments: (data ?? []).map((r) => ({ teacherId: r.teacher_id, subjectId: r.subject_id })),
  });
}

/** Replaces one teacher's full subject list in one call -- simplest semantics for a checkbox UI. */
export async function PUT(req: NextRequest) {
  const { error } = await requireAccess();
  if (error) return error;

  const { teacherId, subjectIds } = await req.json();
  if (!teacherId || !Array.isArray(subjectIds)) {
    return NextResponse.json({ error: "Missing teacherId or subjectIds" }, { status: 400 });
  }

  const { error: deleteError } = await supabaseAdmin.from("teacher_subjects").delete().eq("teacher_id", teacherId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (subjectIds.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("teacher_subjects")
      .insert(subjectIds.map((subjectId: string) => ({ teacher_id: teacherId, subject_id: subjectId })));
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
