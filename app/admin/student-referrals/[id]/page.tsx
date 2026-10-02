import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { AGENT_PROCEDURES, COUNSELOR_PROCEDURES } from "@/lib/student-referral-constants";
import { canEditStage, canView, getReferral, getReferralActor, getReferralFiles } from "@/lib/student-referrals";
import { ReferralStatusBadge } from "@/components/referrals/ReferralStatusBadge";
import { ReferralStageForm } from "@/components/referrals/ReferralStageForm";
import { DeleteReferralButton } from "@/components/referrals/DeleteReferralButton";

export default async function StudentReferralDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const actor = getReferralActor(session!.user);

  if (actor === "teacher") redirect("/teacher/student-referrals");
  if (!actor) redirect("/admin");

  const referral = await getReferral(id);
  if (!referral || !canView(actor, session!.user.id, referral)) notFound();

  const files = await getReferralFiles(id);
  const agentFiles = files.filter((f) => f.stage === "agent");
  const counselorFiles = files.filter((f) => f.stage === "counselor");

  const detail = (label: string, value: string) => (
    <p>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-800 dark:text-slate-100">{value}</span>
    </p>
  );

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/admin/student-referrals" className="text-sm text-[var(--brand-primary)] hover:underline">
            ← تحويلات الطلاب
          </Link>
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">
            {referral.studentName}
            <ReferralStatusBadge status={referral.status} />
          </h2>
        </div>
        <a
          href={`/student-referrals/${referral.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] text-sm px-4 py-2 hover:bg-[var(--brand-primary)]/10 transition-colors"
        >
          طباعة التقرير
        </a>
      </div>

      <section className="flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">نموذج تحويل الطالب</h3>
        {detail("اسم الطالب", referral.studentName)}
        {detail("الصف", referral.className)}
        {detail("المادة", referral.subject)}
        {detail("سبب التحويل", referral.reasons.join("، ") || "--")}
        {detail("إيضاح المشكلة", referral.problemDescription || "--")}
        {detail("اسم المعلم", referral.teacherName)}
      </section>

      <ReferralStageForm
        kind="agent"
        referralId={referral.id}
        title="إجراءات وكيل شؤون الطلاب"
        notesLabel="ملاحظات وكيل الطلاب"
        procedures={AGENT_PROCEDURES}
        initialSelected={referral.agentProcedures}
        initialNotes={referral.agentNotes ?? ""}
        editable={canEditStage(actor, referral, "agent")}
        files={agentFiles}
      />

      {referral.status === "with_counselor" && (
        <ReferralStageForm
          kind="counselor"
          referralId={referral.id}
          title="إجراءات الموجه الطلابي"
          notesLabel="ملاحظات الموجه الطلابي"
          procedures={COUNSELOR_PROCEDURES}
          initialSelected={referral.counselorProcedures}
          initialNotes={referral.counselorNotes ?? ""}
          initialExtraServices={referral.counselorExtraServices ?? ""}
          editable={canEditStage(actor, referral, "counselor")}
          files={counselorFiles}
        />
      )}

      {!session!.user.demoViewOnly && <DeleteReferralButton referralId={referral.id} studentName={referral.studentName} />}
    </div>
  );
}
