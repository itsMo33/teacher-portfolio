import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LATE_REPLY_DAYS } from "@/lib/inquiry-logic";

export interface AdminAlerts {
  inquiriesAwaiting: number;
  inquiriesLate: number;
  inquiriesUnopened: number;
  referralsUnopened: number;
}

const base = () => supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true });

/** What waits on the administration right now, as plain counts (a few cheap head queries, no rows are read). */
export async function getAdminAlerts(options: { inquiries: boolean; referrals: boolean }): Promise<AdminAlerts> {
  const cutoff = new Date(Date.now() - LATE_REPLY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [awaiting, late, unopened, agentUnopened, counselorUnopened] = await Promise.all([
    options.inquiries ? base().is("decision", null) : null,
    options.inquiries ? base().is("decision", null).is("justified_at", null).lt("created_at", cutoff) : null,
    options.inquiries ? base().is("decision", null).is("teacher_opened_at", null) : null,
    options.referrals ? supabaseAdmin.from("student_referrals").select("id", { count: "exact", head: true }).eq("status", "with_agent").is("agent_opened_at", null) : null,
    options.referrals ? supabaseAdmin.from("student_referrals").select("id", { count: "exact", head: true }).eq("status", "with_counselor").is("counselor_opened_at", null) : null,
  ]);
  return {
    inquiriesAwaiting: awaiting?.count ?? 0,
    inquiriesLate: late?.count ?? 0,
    inquiriesUnopened: unopened?.count ?? 0,
    referralsUnopened: (agentUnopened?.count ?? 0) + (counselorUnopened?.count ?? 0),
  };
}
