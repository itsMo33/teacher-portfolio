import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { REFERRAL_REASONS, VIOLATIONS } from "@/lib/student-referral-constants";
import { getReferralActor, getRoutedClasses, listReferralsFor } from "@/lib/student-referrals";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = getReferralActor(session.user);
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const referrals = await listReferralsFor(actor, session.user.id);
  return NextResponse.json({ referrals });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = getReferralActor(session.user);
  if (actor !== "teacher" && actor !== "agent") {
    return NextResponse.json({ error: "Only teachers and agents can create referrals" }, { status: 403 });
  }

  // The وكيل files a violation straight away: it is already with him, ready to forward to a counselor.
  if (actor === "agent") {
    const { studentName, className, violations, problemDescription } = await req.json();
    const list: string[] = Array.isArray(violations) ? violations : [];
    if (!studentName?.trim() || !className?.trim() || list.length === 0) {
      return NextResponse.json({ error: "عبّي اسم الطالب واختر الصف والمخالفة" }, { status: 400 });
    }
    if (list.some((v) => !(VIOLATIONS as readonly string[]).includes(v))) {
      return NextResponse.json({ error: "Invalid violation" }, { status: 400 });
    }
    if (!(await getRoutedClasses()).includes(className.trim())) {
      return NextResponse.json({ error: "اختر الصف من القائمة" }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("student_referrals")
      .insert({
        teacher_id: session.user.id,
        assigned_agent_id: session.user.id,
        student_name: studentName.trim(),
        class_name: className.trim(),
        subject: "--",
        reasons: list,
        problem_description: problemDescription?.trim() || null,
        status: "with_agent",
        sent_to_agent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
  }

  const { studentName, className, subject, reasons, problemDescription } = await req.json();
  if (!studentName?.trim() || !className?.trim() || !subject?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const reasonList: string[] = Array.isArray(reasons) ? reasons : [];
  if (reasonList.some((r) => !(REFERRAL_REASONS as readonly string[]).includes(r))) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  // The class decides which وكيل شؤون الطلاب receives the referral, so it must be one we route.
  if (!(await getRoutedClasses()).includes(className.trim())) {
    return NextResponse.json({ error: "اختر الصف من القائمة" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("student_referrals")
    .insert({
      teacher_id: session.user.id,
      student_name: studentName.trim(),
      class_name: className.trim(),
      subject: subject.trim(),
      reasons: reasonList,
      problem_description: problemDescription?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
