import Link from "next/link";
import { auth } from "@/lib/auth/auth-options";
import { getReferralActor, listReferralsFor } from "@/lib/student-referrals";
import { TeacherReferralSection } from "@/components/referrals/TeacherReferralSection";

export default async function TeacherStudentReferralsPage() {
  const session = await auth();
  const actor = getReferralActor(session!.user);

  // A demo (view-only) account isn't a teacher, so it just sees what has been sent on.
  const referrals = actor ? await listReferralsFor(actor, session!.user.id) : [];

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div>
        <Link href="/teacher" className="text-sm text-[var(--brand-primary)] hover:underline">
          ← لوحة التحكم
        </Link>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">
          <span className="inline-block h-3 w-3 shrink-0 rounded-full bg-amber-600" />
          تحويل الطالب لوكيل شؤون الطلاب
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          عبّي النموذج واحفظه، ثم اطبعه أو أرسله لوكيل شؤون الطلاب. بعد الإرسال ما يمكن تعديل النموذج.
        </p>
      </div>
      <TeacherReferralSection
        referrals={referrals}
        teacherName={session!.user.name ?? ""}
        readOnly={actor !== "teacher" || !!session!.user.demoViewOnly}
      />
    </div>
  );
}
