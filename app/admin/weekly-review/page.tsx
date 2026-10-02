import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { canReview, getWeeklyReview, type MissingTeacher } from "@/lib/weekly-review";
import { ReviewTeacherCard } from "@/components/weekly-review/ReviewTeacherCard";

const DAY_OPTIONS = [7, 14, 30];

function MissingList({ title, teachers, empty }: { title: string; teachers: MissingTeacher[]; empty: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h4 className="font-bold text-slate-800 dark:text-slate-100">
        {title} <span className="text-sm font-normal text-slate-500">({teachers.length})</span>
      </h4>
      {teachers.length === 0 ? (
        <p className="text-sm text-green-600 dark:text-green-400">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {teachers.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/teachers/${t.id}`} className="text-slate-700 dark:text-slate-200 hover:text-[var(--brand-primary)] hover:underline">
                {t.name}
              </Link>
              {t.subject && <span className="text-xs text-slate-400"> -- {t.subject}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function WeeklyReviewPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await auth();
  if (!session || !canReview(session.user)) redirect("/admin");

  const { days: daysParam } = await searchParams;
  const days = DAY_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 7;

  const review = await getWeeklyReview(session.user.id, days);
  const newFileCount = review.groups.reduce((sum, g) => sum + g.files.length, 0);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50">
          <span className="inline-block h-3 w-3 shrink-0 rounded-full bg-emerald-600" />
          مراجعة الأسبوع
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          يعرض لك ما رفعه المعلمون منذ آخر مراجعة لك فقط. اضغط «تمت المراجعة» على كل معلم بعد ما تخلص منه، وتختفي ملفاته إلى أن يرفع جديد.
          أول مرة يبدأ من آخر 7 أيام.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-3 py-1">
          {newFileCount} ملف جديد من {review.groups.length} معلم
        </span>
        <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1">
          {review.missingPlan.length} لم يرفعوا الخطة الأسبوعية
        </span>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">الجديد</h3>
        {review.groups.map((g) => (
          <ReviewTeacherCard
            key={g.teacherId}
            teacherId={g.teacherId}
            name={g.name}
            subject={g.subject}
            files={g.files}
          />
        ))}
        {review.groups.length === 0 && <p className="text-sm text-slate-400">ما فيه ملفات جديدة بانتظار مراجعتك.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">الناقص</h3>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">خلال آخر</span>
            {DAY_OPTIONS.map((d) => (
              <Link
                key={d}
                href={`/admin/weekly-review?days=${d}`}
                className={`rounded-full border px-2.5 py-1 transition-colors ${
                  d === days
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                    : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {d} يوم
              </Link>
            ))}
          </div>
        </div>
        <MissingList title={`لم يرفعوا الخطة الأسبوعية خلال ${days} يوم`} teachers={review.missingPlan} empty="الكل رفع الخطة الأسبوعية." />
        <MissingList title={`لم يرفعوا أي ملف خلال ${days} يوم`} teachers={review.missingAny} empty="الكل رفع شي خلال هذي الفترة." />
      </section>
    </div>
  );
}
