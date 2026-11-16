import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { count, excludedUsers, fetchAll, rangeStart, userNames, without, type StatRange } from "@/lib/statistics";
import { AGENT_PROCEDURES, COUNSELOR_PROCEDURES } from "@/lib/student-referral-constants";

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة (لم تُرسل)",
  with_agent: "عند الوكيل",
  with_counselor: "عند الموجه",
  agent_done: "انتهى الوكيل",
  completed: "تم الانتهاء",
};

interface Row {
  id: string;
  teacher_id: string;
  student_name: string;
  class_name: string;
  subject: string;
  reasons: string[] | null;
  status: string;
  created_at: string;
  sent_to_agent_at: string | null;
  agent_opened_at: string | null;
  agent_done_at: string | null;
  sent_to_counselor_at: string | null;
  counselor_opened_at: string | null;
  completed_at: string | null;
  assigned_agent_id: string | null;
  assigned_counselor_id: string | null;
  agent_procedures: number[] | null;
  counselor_procedures: number[] | null;
}

/** Average days between two timestamps over the rows that have both (null when none do). */
function avg(rows: Row[], from: (r: Row) => string | null, to: (r: Row) => string | null): number | null {
  const d = rows
    .map((r) => [from(r), to(r)] as const)
    .filter((p): p is readonly [string, string] => !!p[0] && !!p[1])
    .map(([a, b]) => (new Date(b).getTime() - new Date(a).getTime()) / DAY_MS)
    .filter((x) => x >= 0);
  return d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : null;
}

export interface PersonRow {
  name: string;
  received: number;
  opened: number;
  /** Agent: finished his part (or passed it on). Counselor: completed. */
  finished: number;
  pending: number;
  avgDaysToFinish: number | null;
  /** Agent only: how many went on to a counselor. */
  forwarded: number;
  /** Agent only: violations he filed himself. */
  filedSelf: number;
}

export interface ReferralStats {
  created: number;
  sent: number;
  drafts: number;
  teacherFiled: number;
  agentFiled: number;
  uniqueStudents: number;
  repeatStudents: number;
  completed: number;
  completedPct: number;
  notOpenedByAgent: number;
  notOpenedByCounselor: number;
  overdue: number;
  avgDaysToAgentOpen: number | null;
  avgDaysToAgentFinish: number | null;
  avgDaysToCounselorOpen: number | null;
  avgDaysToComplete: number | null;
  filesByAgent: number;
  filesByCounselor: number;
  byStatus: [string, number][];
  agents: PersonRow[];
  counselors: PersonRow[];
  topStudents: { name: string; className: string; count: number }[];
  byClass: { name: string; referrals: number; students: number }[];
  bySubject: [string, number][];
  reasons: [string, number][];
  violations: [string, number][];
  agentProcedures: [string, number][];
  counselorProcedures: [string, number][];
  byTeacher: { name: string; referrals: number; students: number }[];
  byDay: [string, number][];
  byMonth: [string, number][];
}

export async function getReferralStats(range: StatRange): Promise<ReferralStats> {
  const since = rangeStart(range);
  const [allRows, names, files, ex] = await Promise.all([
    fetchAll<Row>((from, to) => {
      let q = supabaseAdmin
        .from("student_referrals")
        .select(
          "id, teacher_id, student_name, class_name, subject, reasons, status, created_at, sent_to_agent_at, agent_opened_at, agent_done_at, sent_to_counselor_at, counselor_opened_at, completed_at, assigned_agent_id, assigned_counselor_id, agent_procedures, counselor_procedures"
        )
        .order("created_at");
      if (since) q = q.gte("created_at", since);
      return q.range(from, to);
    }),
    userNames(),
    fetchAll<{ referral_id: string; stage: string }>((from, to) => supabaseAdmin.from("student_referral_files").select("referral_id, stage").order("id").range(from, to)),
    excludedUsers(),
  ]);
  const rows = without(allRows, ex.ids, (r) => r.teacher_id);

  const inRange = new Set(rows.map((r) => r.id));
  const sentRows = rows.filter((r) => r.status !== "draft");
  const agentFiled = (r: Row) => r.assigned_agent_id !== null && r.teacher_id === r.assigned_agent_id;
  const studentKey = (r: Row) => `${r.student_name.trim()}|${r.class_name.trim()}`;

  // students and how many referrals each one has
  const perStudent = new Map<string, { name: string; className: string; count: number }>();
  for (const r of sentRows) {
    const e = perStudent.get(studentKey(r)) ?? { name: r.student_name.trim(), className: r.class_name.trim(), count: 0 };
    e.count++;
    perStudent.set(studentKey(r), e);
  }

  const groupStudents = (key: (r: Row) => string | undefined, labelOf: (k: string) => string) => {
    const m = new Map<string, { referrals: number; students: Set<string> }>();
    for (const r of sentRows) {
      const k = key(r);
      if (!k) continue;
      const e = m.get(k) ?? { referrals: 0, students: new Set<string>() };
      e.referrals++;
      e.students.add(studentKey(r));
      m.set(k, e);
    }
    return [...m.entries()].map(([k, v]) => ({ name: labelOf(k), referrals: v.referrals, students: v.students.size })).sort((a, b) => b.referrals - a.referrals);
  };

  const person = (idOf: (r: Row) => string | null, role: "agent" | "counselor"): PersonRow[] => {
    const ids = [...new Set(sentRows.map(idOf).filter((x): x is string => !!x))];
    return ids
      .map((id) => {
        // an agent's own count is what teachers sent him; the violations he filed himself are counted apart
        const mine = sentRows.filter((r) => idOf(r) === id && !(role === "agent" && agentFiled(r)));
        const filedSelf = role === "agent" ? sentRows.filter((r) => idOf(r) === id && agentFiled(r)).length : 0;
        const finished =
          role === "agent"
            ? mine.filter((r) => ["agent_done", "with_counselor", "completed"].includes(r.status) || r.agent_done_at)
            : mine.filter((r) => r.status === "completed");
        const opened = role === "agent" ? mine.filter((r) => r.agent_opened_at) : mine.filter((r) => r.counselor_opened_at);
        return {
          name: names.get(id) ?? "—",
          received: mine.length,
          opened: opened.length,
          finished: finished.length,
          pending: mine.length - finished.length,
          avgDaysToFinish:
            role === "agent" ? avg(mine, (r) => r.sent_to_agent_at, (r) => r.agent_done_at ?? r.sent_to_counselor_at) : avg(mine, (r) => r.sent_to_counselor_at, (r) => r.completed_at),
          forwarded: role === "agent" ? mine.filter((r) => r.sent_to_counselor_at).length : 0,
          filedSelf,
        };
      })
      .sort((a, b) => b.received - a.received);
  };

  const procedureCounts = (list: { n: number; text: string }[], pick: (r: Row) => number[] | null): [string, number][] => {
    const m = new Map<number, number>();
    for (const r of sentRows) for (const n of pick(r) ?? []) m.set(n, (m.get(n) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => [list.find((p) => p.n === n)?.text ?? `إجراء ${n}`, c] as [string, number]);
  };

  const now = Date.now();
  const repeat = [...perStudent.values()].filter((s) => s.count >= 2);
  const completed = sentRows.filter((r) => r.status === "completed");

  return {
    created: rows.length,
    sent: sentRows.length,
    drafts: rows.length - sentRows.length,
    teacherFiled: sentRows.filter((r) => !agentFiled(r)).length,
    agentFiled: sentRows.filter(agentFiled).length,
    uniqueStudents: perStudent.size,
    repeatStudents: repeat.length,
    completed: completed.length,
    completedPct: sentRows.length ? Math.round((completed.length / sentRows.length) * 100) : 0,
    notOpenedByAgent: sentRows.filter((r) => r.status === "with_agent" && !r.agent_opened_at).length,
    notOpenedByCounselor: sentRows.filter((r) => r.status === "with_counselor" && !r.counselor_opened_at).length,
    overdue: sentRows.filter((r) => r.status !== "completed" && r.sent_to_agent_at && now - new Date(r.sent_to_agent_at).getTime() > 7 * DAY_MS).length,
    avgDaysToAgentOpen: avg(sentRows, (r) => r.sent_to_agent_at, (r) => r.agent_opened_at),
    avgDaysToAgentFinish: avg(sentRows, (r) => r.sent_to_agent_at, (r) => r.agent_done_at ?? r.sent_to_counselor_at),
    avgDaysToCounselorOpen: avg(sentRows, (r) => r.sent_to_counselor_at, (r) => r.counselor_opened_at),
    avgDaysToComplete: avg(completed, (r) => r.sent_to_agent_at, (r) => r.completed_at),
    filesByAgent: files.filter((f) => f.stage === "agent" && inRange.has(f.referral_id)).length,
    filesByCounselor: files.filter((f) => f.stage === "counselor" && inRange.has(f.referral_id)).length,
    byStatus: count(rows, (r) => STATUS_LABELS[r.status] ?? r.status),
    agents: person((r) => r.assigned_agent_id, "agent"),
    counselors: person((r) => r.assigned_counselor_id, "counselor"),
    topStudents: [...perStudent.values()].sort((a, b) => b.count - a.count).slice(0, 15),
    byClass: groupStudents((r) => r.class_name.trim(), (k) => k).slice(0, 15),
    bySubject: count(sentRows.filter((r) => !agentFiled(r)), (r) => r.subject).slice(0, 12),
    reasons: count(sentRows.filter((r) => !agentFiled(r)).flatMap((r) => (r.reasons ?? []).map((reason) => ({ reason }))), (x) => x.reason).slice(0, 15),
    violations: count(sentRows.filter(agentFiled).flatMap((r) => (r.reasons ?? []).map((reason) => ({ reason }))), (x) => x.reason).slice(0, 15),
    agentProcedures: procedureCounts(AGENT_PROCEDURES, (r) => r.agent_procedures).slice(0, 12),
    counselorProcedures: procedureCounts(COUNSELOR_PROCEDURES, (r) => r.counselor_procedures).slice(0, 12),
    byTeacher: groupStudents((r) => (agentFiled(r) ? undefined : r.teacher_id), (k) => names.get(k) ?? "—").slice(0, 15),
    byDay: count(sentRows, (r) => r.created_at.slice(0, 10))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14),
    byMonth: count(sentRows, (r) => r.created_at.slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0])),
  };
}
