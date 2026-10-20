import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getReferral, getReferralActor } from "@/lib/student-referrals";

/** Records that the وكيل / الموجه it is currently with has opened it (first time only), so رائد and
 *  the manager can see whether it has been looked at. Anyone else opening it changes nothing. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = getReferralActor(session.user);
  const referral = await getReferral(id);
  if (!referral) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  if (actor === "agent" && referral.assignedAgentId === session.user.id && referral.status !== "draft") {
    await supabaseAdmin.from("student_referrals").update({ agent_opened_at: now }).eq("id", id).is("agent_opened_at", null);
  } else if (actor === "counselor" && referral.assignedCounselorId === session.user.id) {
    await supabaseAdmin.from("student_referrals").update({ counselor_opened_at: now }).eq("id", id).is("counselor_opened_at", null);
  }
  return NextResponse.json({ success: true });
}
