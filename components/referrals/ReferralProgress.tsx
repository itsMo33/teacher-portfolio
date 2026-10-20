import type { StudentReferral } from "@/lib/student-referrals";

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
}

/** Where a referral stands: whether the person it is with has opened it yet, and whether the
 *  procedures are finished. Shown to the staff who follow referrals (not to the teacher). */
export function referralProgressLines(r: StudentReferral): { text: string; tone: "wait" | "ok" | "done" }[] {
  const lines: { text: string; tone: "wait" | "ok" | "done" }[] = [];
  if (r.status === "draft") return lines;

  const agent = r.assignedAgentName ?? "وكيل شؤون الطلاب";
  if (r.agentOpenedAt) lines.push({ text: `${agent}: تم الفتح ${day(r.agentOpenedAt)}`, tone: "ok" });
  else if (r.status === "with_agent") lines.push({ text: `${agent}: لم يُفتح بعد`, tone: "wait" });

  if (r.status === "agent_done") {
    lines.push({ text: `تم الانتهاء من الإجراءات${r.agentDoneAt ? ` ${day(r.agentDoneAt)}` : ""} (الوكيل)`, tone: "done" });
  }

  if (r.status === "with_counselor" || r.status === "completed") {
    const counselor = r.assignedCounselorName ?? "الموجه الطلابي";
    if (r.counselorOpenedAt) lines.push({ text: `${counselor}: تم الفتح ${day(r.counselorOpenedAt)}`, tone: "ok" });
    else if (r.status === "with_counselor") lines.push({ text: `${counselor}: لم يُفتح بعد`, tone: "wait" });
  }
  if (r.status === "completed") {
    lines.push({ text: `تم الانتهاء من الإجراءات${r.completedAt ? ` ${day(r.completedAt)}` : ""} (الموجه)`, tone: "done" });
  }
  return lines;
}

const TONE = {
  wait: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ok: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
} as const;

export function ReferralProgress({ referral }: { referral: StudentReferral }) {
  const lines = referralProgressLines(referral);
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {lines.map((l) => (
        <span key={l.text} className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${TONE[l.tone]}`}>
          {l.text}
        </span>
      ))}
    </div>
  );
}
