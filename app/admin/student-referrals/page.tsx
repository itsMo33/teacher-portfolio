import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { getReferralActor, isAgentFiled, listReferralsFor, type StudentReferral } from "@/lib/student-referrals";
import { ReferralStatusBadge } from "@/components/referrals/ReferralStatusBadge";

function ReferralRow({ r }: { r: StudentReferral }) {
  return (
    <Link
      href={`/admin/student-referrals/${r.id}`}
      className="flex flex-col gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {r.studentName} -- {r.className}
          {isAgentFiled(r) ? " -- مخالفة" : ` -- ${r.subject}`}
        </span>
        <ReferralStatusBadge status={r.status} />
      </div>
      <p className="text-xs text-slate-500">
        {isAgentFiled(r) ? "" : `المعلم: ${r.teacherName} -- `}
        {r.reasons.join("، ")} --{" "}
        {new Date(r.sentToAgentAt ?? r.createdAt).toLocaleDateString("ar-SA")}
      </p>
    </Link>
  );
}

export default async function StudentReferralsPage() {
  const session = await auth();
  const actor = getReferralActor(session!.user);

  if (actor === "teacher") redirect("/teacher/student-referrals");
  if (!actor) redirect("/admin");

  const referrals = await listReferralsFor(actor, session!.user.id);

  // What's waiting on this account right now vs. what has already moved on.
  const waitingStatus = actor === "agent" ? "with_agent" : actor === "counselor" ? "with_counselor" : null;
  const waiting = waitingStatus ? referrals.filter((r) => r.status === waitingStatus) : [];
  const others = waitingStatus ? referrals.filter((r) => r.status !== waitingStatus) : referrals;

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50">
          <span className="inline-block h-3 w-3 shrink-0 rounded-full bg-amber-600" />
          تحويلات الطلاب
        </h2>
        {actor === "agent" && !session!.user.demoViewOnly && (
          <Link
            href="/admin/student-referrals/new"
            className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors"
          >
            + مخالفة طالب جديدة
          </Link>
        )}
      </div>

      {waitingStatus && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">بانتظار إجراءك ({waiting.length})</h3>
          {waiting.map((r) => (
            <ReferralRow key={r.id} r={r} />
          ))}
          {waiting.length === 0 && <p className="text-sm text-slate-400">ما فيه تحويلات بانتظارك.</p>}
        </section>
      )}

      <section className="flex flex-col gap-2">
        {waitingStatus && <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">تم التعامل معها ({others.length})</h3>}
        {others.map((r) => (
          <ReferralRow key={r.id} r={r} />
        ))}
        {others.length === 0 && <p className="text-sm text-slate-400">لا توجد تحويلات.</p>}
      </section>
    </div>
  );
}
