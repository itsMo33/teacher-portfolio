import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { getReferralActor, getRoutedClasses } from "@/lib/student-referrals";
import { ViolationReferralForm } from "@/components/referrals/ViolationReferralForm";

export default async function NewViolationPage() {
  const session = await auth();
  if (getReferralActor(session!.user) !== "agent" || session!.user.demoViewOnly) redirect("/admin/student-referrals");

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <Link href="/admin/student-referrals" className="text-sm text-[var(--brand-primary)] hover:underline">
          ← تحويلات الطلاب
        </Link>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">مخالفة طالب جديدة</h2>
        <p className="text-sm text-slate-500 mt-1">عبّي النموذج ثم عبّي إجراءاتك وحوّله للموجه الطلابي مباشرة.</p>
      </div>
      <ViolationReferralForm
        initial={{ studentName: "", className: "", violations: [], problemDescription: "" }}
        classOptions={await getRoutedClasses()}
      />
    </div>
  );
}
