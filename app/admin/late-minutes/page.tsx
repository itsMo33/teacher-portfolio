import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canReview } from "@/lib/weekly-review";
import { riyadhToday } from "@/lib/class-time-flags";
import { addDays } from "@/lib/teacher-performance";
import { PrintButton } from "@/components/admin/PrintButton";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Totals {
  minutes: number;
  times: number;
}

const empty = (): Totals => ({ minutes: 0, times: 0 });

function label(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

/** Rows come back at most 1000 at a time; read every page of a range. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

/** For رائد: how many minutes each teacher has been late in total, from the two places it is recorded -- late
 *  class periods (الالتزام بزمن الحصة) and the late-arrival inquiries (مسائلات تأخير حضوري) -- over a chosen range. */
export default async function LateMinutesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; skipAccepted?: string }>;
}) {
  const session = await auth();
  if (!session || !canReview(session.user)) redirect("/admin");

  const params = await searchParams;
  const today = riyadhToday();
  const to = params.to && DATE_RE.test(params.to) ? params.to : today;
  const from = params.from && DATE_RE.test(params.from) ? params.from : `${today.slice(0, 8)}01`;
  const skipAccepted = params.skipAccepted === "1";

  const [{ data: teachers }, periodRows, inquiryRows] = await Promise.all([
    supabaseAdmin.from("users").select("id, name").eq("role", "teacher").is("deleted_at", null).order("name"),
    readAll<{ teacher_id: string; late_minutes: number | null }>((a, b) =>
      supabaseAdmin
        .from("teacher_performance_records")
        .select("teacher_id, late_minutes")
        .eq("category", "class_time_commitment")
        .eq("status", "late")
        .gte("record_date", from)
        .lte("record_date", to)
        .order("id")
        .range(a, b)
    ),
    readAll<{ teacher_id: string; delay_minutes: number | null; decision: string | null }>((a, b) =>
      supabaseAdmin
        .from("inquiries")
        .select("teacher_id, delay_minutes, decision")
        .eq("kind", "delay")
        .not("delay_minutes", "is", null)
        // the inquiry's date is when it was sent; Riyadh is three hours ahead of UTC
        .gte("created_at", `${from}T00:00:00+03:00`)
        .lt("created_at", `${addDays(to, 1)}T00:00:00+03:00`)
        .order("id")
        .range(a, b)
    ),
  ]);

  const periods = new Map<string, Totals>();
  const periodsNoMinutes = new Map<string, number>();
  for (const r of periodRows) {
    const t = periods.get(r.teacher_id) ?? empty();
    t.times++;
    t.minutes += r.late_minutes ?? 0;
    periods.set(r.teacher_id, t);
    if (r.late_minutes === null) periodsNoMinutes.set(r.teacher_id, (periodsNoMinutes.get(r.teacher_id) ?? 0) + 1);
  }
  const arrivals = new Map<string, Totals>();
  for (const r of inquiryRows) {
    if (skipAccepted && r.decision === "accepted") continue;
    const t = arrivals.get(r.teacher_id) ?? empty();
    t.times++;
    t.minutes += r.delay_minutes ?? 0;
    arrivals.set(r.teacher_id, t);
  }

  const rows = (teachers ?? [])
    .map((t) => {
      const p = periods.get(t.id) ?? empty();
      const a = arrivals.get(t.id) ?? empty();
      return { id: t.id as string, name: t.name as string, p, a, total: p.minutes + a.minutes, times: p.times + a.times, noMinutes: periodsNoMinutes.get(t.id) ?? 0 };
    })
    .filter((r) => r.times > 0)
    .sort((x, y) => y.total - x.total || x.name.localeCompare(y.name, "ar"));

  const grand = rows.reduce((sum, r) => sum + r.total, 0);
  const query = (extra: Record<string, string>) => new URLSearchParams({ from, to, ...(skipAccepted ? { skipAccepted: "1" } : {}), ...extra }).toString();

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">دقائق تأخر المعلمين</h2>
          <p className="mt-1 text-sm text-slate-500">
            مجموع دقائق التأخر لكل معلم، من تأخر الحصص (الالتزام بزمن الحصة) ومن مسائلات التأخير الحضوري.
          </p>
        </div>
        <PrintButton />
      </div>

      <form method="get" action="/admin/late-minutes" className="no-print flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          من
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          إلى
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" name="skipAccepted" value="1" defaultChecked={skipAccepted} />
          استبعاد المسائلات المقبولة
        </label>
        <button type="submit" className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] px-4 py-2 text-sm text-white transition-colors">
          عرض
        </button>
        <div className="flex gap-2 pb-1 text-xs">
          <Link href={`/admin/late-minutes?${query({ from: `${today.slice(0, 8)}01`, to: today })}`} className="text-[var(--brand-primary)] hover:underline">
            هذا الشهر
          </Link>
          <Link href={`/admin/late-minutes?${query({ from: addDays(today, -29), to: today })}`} className="text-[var(--brand-primary)] hover:underline">
            آخر 30 يوم
          </Link>
          <Link href={`/admin/late-minutes?${query({ from: "2020-01-01", to: today })}`} className="text-[var(--brand-primary)] hover:underline">
            كل الفترة
          </Link>
        </div>
      </form>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        من {label(from)} إلى {label(to)} -- {rows.length} معلم، مجموع الدقائق: <strong>{grand}</strong>
        {skipAccepted && " (بدون المسائلات المقبولة)"}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <th className="p-2 text-right">م</th>
              <th className="p-2 text-right">المعلم</th>
              <th className="p-2 text-right">تأخر الحصص (دقائق)</th>
              <th className="p-2 text-right">مسائلات الحضور (دقائق)</th>
              <th className="p-2 text-right">الإجمالي (دقائق)</th>
              <th className="p-2 text-right">عدد المرات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/60">
                <td className="p-2 tabular-nums text-slate-400">{i + 1}</td>
                <td className="p-2 font-medium text-slate-900 dark:text-slate-50">{r.name}</td>
                <td className="p-2 tabular-nums">
                  {r.p.minutes}
                  <span className="text-xs text-slate-400"> ({r.p.times} مرة{r.noMinutes > 0 ? `، ${r.noMinutes} بدون دقائق` : ""})</span>
                </td>
                <td className="p-2 tabular-nums">
                  {r.a.minutes}
                  <span className="text-xs text-slate-400"> ({r.a.times} مرة)</span>
                </td>
                <td className="p-2 tabular-nums font-bold text-slate-900 dark:text-slate-50">{r.total}</td>
                <td className="p-2 tabular-nums">{r.times}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-center text-sm text-slate-400">ما فيه تأخر مسجّل في هذه الفترة.</p>}
      </div>

      <p className="text-xs text-slate-400">
        تأخر الحصص يُحسب بتاريخ الحصة. مسائلات الحضور تُحسب بتاريخ إرسال المسائلة، ودقائقها من ملف المسائلة. حصة بدون دقائق مسجّلة تظهر كمرة بدون دقائق.
      </p>
    </div>
  );
}
