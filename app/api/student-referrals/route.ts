import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { REFERRAL_REASONS } from "@/lib/student-referral-constants";
import { getReferralActor, listReferralsFor } from "@/lib/student-referrals";

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
  if (getReferralActor(session.user) !== "teacher") {
    return NextResponse.json({ error: "Only teachers can create referrals" }, { status: 403 });
  }

  const { studentName, className, subject, reasons, problemDescription } = await req.json();
  if (!studentName?.trim() || !className?.trim() || !subject?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const reasonList: string[] = Array.isArray(reasons) ? reasons : [];
  if (reasonList.some((r) => !(REFERRAL_REASONS as readonly string[]).includes(r))) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
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
