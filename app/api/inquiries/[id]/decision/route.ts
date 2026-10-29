import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getInquiry, getInquiryRole } from "@/lib/inquiries";
import { logActivity } from "@/lib/audit";

/** رائد (or the manager) decides an inquiry: accept or reject. Only then does the teacher see the result. For a
 *  delay inquiry he usually just confirms the system's suggestion; he can also change it. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getInquiryRole(session.user) !== "reviewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { decision, note } = await req.json();
  if (decision !== "accepted" && decision !== "rejected") return NextResponse.json({ error: "Invalid decision" }, { status: 400 });

  const inquiry = await getInquiry(id);
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("inquiries")
    .update({
      decision,
      decision_note: typeof note === "string" && note.trim() ? note.trim().slice(0, 1000) : null,
      decided_by: session.user.id,
      decided_at: now,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "decide_inquiry",
    targetTeacherId: inquiry.teacherId,
    targetTeacherName: inquiry.teacherName,
    details: `${inquiry.kind === "delay" ? "مسائلة تأخير" : "مسائلة"}: ${decision === "accepted" ? "مقبولة" : "مرفوضة"}`,
  });
  return NextResponse.json({ success: true });
}

/** Takes a decision back (reopens the inquiry) -- the teacher stops seeing the result. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getInquiryRole(session.user) !== "reviewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("inquiries")
    .update({ decision: null, decision_note: null, decided_by: null, decided_at: null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
