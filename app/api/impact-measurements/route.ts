import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getImpactMeasurements } from "@/lib/portfolio-data";

const IMPROVEMENT_LEVELS = ["كبير", "متوسط", "بسيط", "لم يتحسن"];
const RECOMMENDATIONS = ["تحقق الهدف", "يحتاج إلى متابعة", "يحتاج إلى خطة علاجية إضافية"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const queryTeacherId = req.nextUrl.searchParams.get("teacherId");
  const teacherId = session.user.role === "teacher" ? session.user.id : queryTeacherId;
  if (!teacherId) return NextResponse.json({ error: "Missing teacherId" }, { status: 400 });
  if (session.user.role === "teacher" && teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await getImpactMeasurements(teacherId);
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can add these" }, { status: 403 });
  }
  if (session.user.demoViewOnly) {
    return NextResponse.json({ error: "هذا حساب عرض فقط -- لا يمكن التعديل" }, { status: 403 });
  }

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

  const { data, error } = await supabaseAdmin
    .from("impact_measurements")
    .insert({
      teacher_id: session.user.id,
      subject,
      student_name: studentName,
      class_name: className,
      max_score: max,
      score_before: before,
      score_after: after,
      improvement_level: improvementLevel,
      teacher_notes: teacherNotes || null,
      recommendations: recs,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}
