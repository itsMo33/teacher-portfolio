import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getReferral, getReferralActor } from "@/lib/student-referrals";
import { logActivity } from "@/lib/audit";

/** "تم الانتهاء": the وكيل finishes a referral without forwarding it (with_agent -> agent_done), or the
 *  الموجه finishes the one forwarded to him (with_counselor -> completed). Only the person it is with
 *  can do it, and the status check is part of the UPDATE so a double-click can't run it twice. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = getReferralActor(session.user);
  if (actor !== "agent" && actor !== "counselor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const referral = await getReferral(id);
  if (!referral) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  const isAgent = actor === "agent";
  const holderId = isAgent ? referral.assignedAgentId : referral.assignedCounselorId;
  if (holderId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const from = isAgent ? "with_agent" : "with_counselor";
  if (referral.status !== from) return NextResponse.json({ error: "تم إنهاء هذا النموذج أو تحويله مسبقًا" }, { status: 409 });

  const { data, error } = await supabaseAdmin
    .from("student_referrals")
    .update(
      isAgent
        ? { status: "agent_done", agent_done_at: now, updated_at: now }
        : { status: "completed", completed_at: now, updated_at: now }
    )
    .eq("id", id)
    .eq("status", from)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "تم إنهاء هذا النموذج أو تحويله مسبقًا" }, { status: 409 });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: isAgent ? "finish_referral_agent" : "finish_referral_counselor",
    targetTeacherId: referral.teacherId,
    targetTeacherName: referral.teacherName,
    details: `${referral.studentName} -- ${referral.className}`,
  });

  return NextResponse.json({ success: true });
}
