import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { inquiryStage } from "@/lib/inquiry-clock";
import { getExemptDates } from "@/lib/inquiry-exempt";

export interface AdminAlerts {
  /** The teacher answered: it waits on the administration. */
  inquiriesAdmin: number;
  /** ...and two school days passed without a decision (the administration's delay). */
  inquiriesAdminLate: number;
  /** The teacher's two school days are over without an answer: ready to be decided without one. */
  inquiriesReady: number;
  /** Still inside the teacher's time (not opened, or opened and not answered yet). */
  inquiriesWithTeachers: number;
  /** Of those, how many the teacher has not even opened. */
  inquiriesUnopened: number;
  referralsUnopened: number;
}

/** What waits on the administration right now. Inquiries are sorted by whose turn it is, in school time. */
export async function getAdminAlerts(options: { inquiries: boolean; referrals: boolean }): Promise<AdminAlerts> {
  const result: AdminAlerts = { inquiriesAdmin: 0, inquiriesAdminLate: 0, inquiriesReady: 0, inquiriesWithTeachers: 0, inquiriesUnopened: 0, referralsUnopened: 0 };

  if (options.inquiries) {
    const { data } = await supabaseAdmin
      .from("inquiries")
      .select("teacher_id, created_at, teacher_opened_at, justified_at, teacher:users!inquiries_teacher_id_fkey(name)")
      .is("decision", null);
    const rows = (data ?? []) as unknown as {
      teacher_id: string;
      created_at: string;
      teacher_opened_at: string | null;
      justified_at: string | null;
      teacher: { name: string } | { name: string }[] | null;
    }[];
    const teachers = new Map<string, string>();
    for (const r of rows) teachers.set(r.teacher_id, (Array.isArray(r.teacher) ? r.teacher[0]?.name : r.teacher?.name) ?? "");
    const exempt = await getExemptDates([...teachers].map(([id, name]) => ({ id, name })));
    const now = Date.now();
    for (const r of rows) {
      const stage = inquiryStage({ createdAt: r.created_at, teacherOpenedAt: r.teacher_opened_at, justifiedAt: r.justified_at, decidedAt: null }, exempt.get(r.teacher_id) ?? [], now);
      if (stage === "admin") result.inquiriesAdmin++;
      else if (stage === "admin_late") {
        result.inquiriesAdmin++;
        result.inquiriesAdminLate++;
      } else if (stage === "teacher_late") result.inquiriesReady++;
      else {
        result.inquiriesWithTeachers++;
        if (stage === "teacher_unopened") result.inquiriesUnopened++;
      }
    }
  }

  if (options.referrals) {
    const [agent, counselor] = await Promise.all([
      supabaseAdmin.from("student_referrals").select("id", { count: "exact", head: true }).eq("status", "with_agent").is("agent_opened_at", null),
      supabaseAdmin.from("student_referrals").select("id", { count: "exact", head: true }).eq("status", "with_counselor").is("counselor_opened_at", null),
    ]);
    result.referralsUnopened = (agent.count ?? 0) + (counselor.count ?? 0);
  }
  return result;
}
