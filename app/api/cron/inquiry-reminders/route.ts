import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { inquiryStage } from "@/lib/inquiry-clock";
import { getExemptDates } from "@/lib/inquiry-exempt";
import { getInquiryDeciderIds, sendPush } from "@/lib/push";

export const maxDuration = 60;

/** Every school morning: tells each teacher how many inquiries wait for their answer (and how many are late), and tells
 *  the deciders how many wait for a decision. Called by the schedule in vercel.json with the cron secret. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows, error } = await supabaseAdmin
    .from("inquiries")
    .select("id, teacher_id, created_at, teacher_opened_at, justified_at, decided_at, extracted_text")
    .is("decided_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // the inquiries kept only as an old uploaded file are not part of the clocks
  const open = (rows ?? []).filter((r) => !String(r.extracted_text ?? "").startsWith("مسائلة مرفوعة كملف"));

  const teacherIds = [...new Set(open.map((r) => r.teacher_id as string))];
  const { data: users } = teacherIds.length ? await supabaseAdmin.from("users").select("id, name").in("id", teacherIds) : { data: [] };
  const exempt = await getExemptDates((users ?? []).map((u) => ({ id: u.id as string, name: u.name as string })));

  const perTeacher = new Map<string, { waiting: number; late: number }>();
  let adminWaiting = 0;
  let adminLate = 0;
  for (const r of open) {
    const stage = inquiryStage(
      { createdAt: r.created_at as string, teacherOpenedAt: r.teacher_opened_at as string | null, justifiedAt: r.justified_at as string | null, decidedAt: null },
      exempt.get(r.teacher_id as string) ?? [],
    );
    if (stage === "teacher_unopened" || stage === "teacher_opened" || stage === "teacher_late") {
      const e = perTeacher.get(r.teacher_id as string) ?? { waiting: 0, late: 0 };
      e.waiting++;
      if (stage === "teacher_late") e.late++;
      perTeacher.set(r.teacher_id as string, e);
    }
    if (stage === "admin" || stage === "admin_late") adminWaiting++;
    if (stage === "admin_late") adminLate++;
  }

  let teachersNotified = 0;
  for (const [id, e] of perTeacher) {
    const sent = await sendPush([id], {
      title: e.late > 0 ? "مسائلة متأخرة عن الرد" : "مسائلة بانتظار ردك",
      body: e.late > 0 ? `عندك ${e.waiting} مسائلة بانتظار ردك، منها ${e.late} انتهت مهلتها.` : `عندك ${e.waiting} مسائلة بانتظار ردك. مهلتك يومان دراسيان.`,
      url: "/teacher/portfolio/accountability",
      tag: "inquiry-reminder",
    });
    if (sent > 0) teachersNotified++;
  }

  let deciders = 0;
  if (adminWaiting > 0) {
    deciders = await sendPush(await getInquiryDeciderIds(), {
      title: "مسائلات تنتظر قرارك",
      body: adminLate > 0 ? `${adminWaiting} مسائلة ردّ عليها المعلمون، منها ${adminLate} متأخرة عن القرار.` : `${adminWaiting} مسائلة ردّ عليها المعلمون وتنتظر قرارك.`,
      url: "/admin/inquiries?filter=admin",
      tag: "inquiry-decisions",
    });
  }
  return NextResponse.json({ teachersWithOpen: perTeacher.size, teachersNotified, adminWaiting, deciders });
}
