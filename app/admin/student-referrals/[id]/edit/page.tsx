import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { canEditStage, getReferral, getReferralActor, getRoutedClasses, isAgentFiled } from "@/lib/student-referrals";
import { ViolationReferralForm } from "@/components/referrals/ViolationReferralForm";

export default async function EditViolationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const actor = getReferralActor(session!.user);
  if (actor !== "agent") redirect("/admin/student-referrals");

  const referral = await getReferral(id);
  if (!referral || !isAgentFiled(referral) || !canEditStage(actor, session!.user.id, referral, "agent")) notFound();

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <Link href={`/admin/student-referrals/${id}`} className="text-sm text-[var(--brand-primary)] hover:underline">
          ← رجوع
        </Link>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">تعديل المخالفة</h2>
      </div>
      <ViolationReferralForm
        referralId={id}
        initial={{
          studentName: referral.studentName,
          className: referral.className,
          violations: referral.reasons,
          problemDescription: referral.problemDescription ?? "",
        }}
        classOptions={await getRoutedClasses()}
      />
    </div>
  );
}
