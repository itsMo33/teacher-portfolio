import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

const IMPROVEMENT_LEVELS = ["كبير", "متوسط", "بسيط", "لم يتحسن"];
const RECOMMENDATIONS = ["تحقق الهدف", "يحتاج إلى متابعة", "يحتاج إلى خطة علاجية إضافية"];

async function requireOwner(id: string) {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "teacher") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (session.user.demoViewOnly) {
    return { error: NextResponse.json({ error: "هذا حساب عرض فقط -- لا يمكن التعديل" }, { status: 403 }) };
  }
  const { data: entry } = await supabaseAdmin.from("impact_measurements").select("teacher_id").eq("id", id).maybeSingle();
  if (!entry) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (entry.teacher_id !== session.user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await requireOwner(id);
  if (error) return error;

  const body = await req.json();
  const { subject, studentName, className, maxScore, scoreBefore, scoreAfter, improvementLevel, teacherNotes, recommendations } = body;

  if (!subject || !studentName || !className || !improvementLevel) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!IMPROVEMENT_LEVELS.includes(improvementLevel)) {
    return NextResponse.json({ error: "Invalid improvementLevel" }, { status: 400 });
  }
  const recs: string[] = Array.isArray(recommendations) ? recommendations : [];
  if (recs.some((r) => !RECOMMENDATIONS.includes(r))) {
    return NextResponse.json({ error: "Invalid recommendation" }, { status: 400 });
  }
  const max = Number(maxScore) || 10;
  const before = Number(scoreBefore);
  const after = Number(scoreAfter);
  if (!Number.isFinite(before) || !Number.isFinite(after) || before < 0 || after < 0) {
    return NextResponse.json({ error: "Invalid scores" }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("impact_measurements")
    .update({
      subject,
      student_name: studentName,
      class_name: className,
      max_score: max,
      score_before: before,
      score_after: after,
      improvement_level: improvementLevel,
      teacher_notes: teacherNotes || null,
      recommendations: recs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await requireOwner(id);
  if (error) return error;

  const { error: deleteError } = await supabaseAdmin.from("impact_measurements").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
