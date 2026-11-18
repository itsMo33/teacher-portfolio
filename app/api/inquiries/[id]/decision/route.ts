import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canDecideInquiry, getInquiry, getInquiryRole } from "@/lib/inquiries";
import { logActivity } from "@/lib/audit";
import { sendPush } from "@/lib/push";
import { ABSENCE_OPTIONS, INQUIRY_KIND_LABEL } from "@/lib/inquiry-logic";

/** محمد (the uploading account), رائد or the manager decides an inquiry: accept or reject. Only then does the teacher see the result. For a
 *  delay inquiry he usually just confirms the system's suggestion; he can also change it. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDecideInquiry(getInquiryRole(session.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { note } = body;
  const inquiry = await getInquiry(id);
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // an absence inquiry is decided with one of the form's three outcomes; the others are just accepted or rejected
  const option = inquiry.kind === "absence" ? ABSENCE_OPTIONS.find((o) => o.key === body.option) : undefined;
  if (inquiry.kind === "absence" && !option) return NextResponse.json({ error: "اختر أحد القرارات الثلاثة" }, { status: 400 });
  const decision = option ? option.decision : body.decision;
  if (decision !== "accepted" && decision !== "rejected") return NextResponse.json({ error: "Invalid decision" }, { status: 400 });

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

  if (option) {
    const saved = await supabaseAdmin.from("inquiries").update({ decision_option: option.key }).eq("id", id);
    if (saved.error) {
      // the column is not there yet: undo the decision rather than leave it half saved
      await supabaseAdmin.from("inquiries").update({ decision: null, decision_note: null, decided_by: null, decided_at: null }).eq("id", id);
      return NextResponse.json({ error: "شغّل أمر الـSQL الخاص بقرارات الغياب في Supabase أولاً" }, { status: 500 });
    }
  }

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "decide_inquiry",
    targetTeacherId: inquiry.teacherId,
    targetTeacherName: inquiry.teacherName,
    details: `${INQUIRY_KIND_LABEL[inquiry.kind]}: ${option ? option.short : decision === "accepted" ? "مقبولة" : "غير مقبولة"}`,
  });
  await sendPush([inquiry.teacherId], { title: "صدرت نتيجة مسائلتك", body: "تم البت في مسائلتك. اضغط لمعرفة النتيجة.", url: "/teacher/portfolio/accountability", tag: "inquiry-result" });
  return NextResponse.json({ success: true });
}

/** Takes a decision back (reopens the inquiry) -- the teacher stops seeing the result. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDecideInquiry(getInquiryRole(session.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("inquiries")
    .update({ decision: null, decision_note: null, decided_by: null, decided_at: null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from("inquiries").update({ decision_option: null }).eq("id", id);
  return NextResponse.json({ success: true });
}
