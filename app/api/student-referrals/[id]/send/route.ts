import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgentForClass, getCounselors, getReferral, getReferralActor } from "@/lib/student-referrals";
import { logActivity } from "@/lib/audit";

/** Moves a referral one step along: teacher (draft) -> وكيل شؤون الطلاب, then وكيل -> الموجه الطلابي.
 *  The status check is part of the UPDATE itself so a double-click can't send it twice. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = getReferralActor(session.user);
  if (actor !== "teacher" && actor !== "agent") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const referral = await getReferral(id);
  if (!referral) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  let from: "draft" | "with_agent";
  let update: Record<string, unknown>;
  let action: string;

  if (actor === "teacher") {
    if (referral.teacherId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // The class picks the agent (a class missing from the routing table can't be sent anywhere).
    const agentId = await getAgentForClass(referral.className);
    if (!agentId) {
      return NextResponse.json({ error: "هذا الصف غير مرتبط بوكيل شؤون طلاب، عدّل الصف واختره من القائمة" }, { status: 409 });
    }
    from = "draft";
    update = { status: "with_agent", sent_to_agent_at: now, updated_at: now, assigned_agent_id: agentId };
    action = "send_referral_to_agent";
  } else {
    // Only the agent this referral was routed to can forward it, and must say to which counselor.
    if (referral.assignedAgentId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { counselorId } = await req.json().catch(() => ({ counselorId: null }));
    const counselors = await getCounselors();
    if (typeof counselorId !== "string" || !counselors.some((c) => c.id === counselorId)) {
      return NextResponse.json({ error: "اختر الموجه الطلابي المحوَّل له" }, { status: 400 });
    }
    from = "with_agent";
    update = { status: "with_counselor", sent_to_counselor_at: now, updated_at: now, assigned_counselor_id: counselorId };
    action = "forward_referral_to_counselor";
  }

  if (referral.status !== from) {
    return NextResponse.json({ error: "تم إرسال هذا النموذج مسبقًا" }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("student_referrals")
    .update(update)
    .eq("id", id)
    .eq("status", from)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "تم إرسال هذا النموذج مسبقًا" }, { status: 409 });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action,
    targetTeacherId: referral.teacherId,
    targetTeacherName: referral.teacherName,
    details:
      actor === "agent"
        ? `${referral.studentName} -- ${referral.className} -> ${(await getCounselors()).find((c) => c.id === (update as { assigned_counselor_id: string }).assigned_counselor_id)?.name ?? ""}`
        : `${referral.studentName} -- ${referral.className}`,
  });

  return NextResponse.json({ success: true });
}
