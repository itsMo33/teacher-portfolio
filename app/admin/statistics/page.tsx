import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";
import { SectionBreakdownList, type SectionBreakdownItem } from "@/components/admin/SectionBreakdownList";
import { BarList, DataTable, StatCard, StatGrid, StatSection } from "@/components/admin/StatBlocks";
import {
  RANGE_LABELS,
  getInquiryStats,
  getPerformanceStats,
  getReferralStats,
  getReviewStats,
  getWaitingStats,
  parseRange,
  type StatRange,
} from "@/lib/statistics";
import {
  getAccountStats,
  getActivityStats,
  getExcuseStats,
  getImpactStats,
  getScheduleStats,
  getSchoolFilesStats,
  getWeeklyPlanStats,
} from "@/lib/statistics-more";

type Tab = "files" | "inquiries" | "referrals" | "performance" | "waiting" | "review" | "schedule" | "plan" | "school" | "impact" | "excuse" | "activity" | "accounts";

/** Tabs that are a snapshot of now, so a period makes no sense for them. */
const NO_RANGE: Tab[] = ["files", "schedule", "plan", "accounts"];

const TABS: { key: Tab; label: string }[] = [
  { key: "files", label: "ملفات المعلمين" },
  { key: "inquiries", label: "المسائلات" },
  { key: "referrals", label: "تحويلات الطلاب" },
  { key: "performance", label: "متابعة الأداء" },
  { key: "waiting", label: "جدول الانتظار" },
  { key: "review", label: "مراجعة الملفات" },
  { key: "schedule", label: "الجدول المدرسي" },
  { key: "plan", label: "الخطة الأسبوعية" },
  { key: "school", label: "إدارة المدرسة" },
  { key: "impact", label: "قياس الأثر" },
  { key: "excuse", label: "الاستئذان" },
  { key: "activity", label: "سجل النشاط" },
  { key: "accounts", label: "الحسابات" },
];

const KIND_LABELS: Record<string, string> = { delay: "تأخير (حضوري)", absence: "غياب", other: "أخرى" };

/** One statistics page for the whole program: a tab per part (files, inquiries, referrals, performance, waiting table,
 *  file review), each with its own numbers, and -- except for the files tab -- a period to look at. */
export default async function AdminStatisticsPage({ searchParams }: { searchParams: Promise<{ tab?: string; range?: string }> }) {
  const session = await auth();
  if (!session || session.user.role === "teacher" || session.user.role === "staff" || session.user.restrictedCategory) redirect("/admin");

  const { tab: tabParam, range: rangeParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "files";
  const range = parseRange(rangeParam);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">الإحصائيات</h2>

      <div className="flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/statistics?tab=${t.key}${range !== "all" ? `&range=${range}` : ""}`}
            className={`rounded-lg border px-3 py-1.5 transition-colors ${
              t.key === tab
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!NO_RANGE.includes(tab) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">الفترة:</span>
          {(Object.keys(RANGE_LABELS) as StatRange[]).map((r) => (
            <Link
              key={r}
              href={`/admin/statistics?tab=${tab}${r !== "all" ? `&range=${r}` : ""}`}
              className={`rounded-full border px-3 py-1 ${
                r === range ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {RANGE_LABELS[r]}
            </Link>
          ))}
        </div>
      )}

      {tab === "files" && <FilesStats />}
      {tab === "inquiries" && <InquiriesStats range={range} />}
      {tab === "referrals" && <ReferralsStats range={range} />}
      {tab === "performance" && <PerformanceStatsView range={range} />}
      {tab === "waiting" && <WaitingStatsView range={range} />}
      {tab === "review" && <ReviewStatsView range={range} />}
      {tab === "schedule" && <ScheduleStatsView />}
      {tab === "plan" && <WeeklyPlanStatsView />}
      {tab === "school" && <SchoolFilesStatsView range={range} />}
      {tab === "impact" && <ImpactStatsView range={range} />}
      {tab === "excuse" && <ExcuseStatsView range={range} />}
      {tab === "activity" && <ActivityStatsView range={range} />}
      {tab === "accounts" && <AccountStatsView />}
    </div>
  );
}

async function FilesStats() {
  const teachers = await getTeachersWithCompletion();
  const total = teachers.length;
  const sections = PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule" && !s.staffOnly);

  const sectionStats: SectionBreakdownItem[] = sections.map((section) => {
    const teacherStatuses = teachers.map((t) => {
      const totalCount = section.hasSubsections ? section.subsections!.length : (section.requiredCount ?? 1);
      const doneCount = section.hasSubsections
        ? section.subsections!.filter((sub) => (t.slotCounts[`${section.key}:${sub.key}`] ?? 0) >= (sub.requiredCount ?? 1)).length
        : Math.min(t.slotCounts[`${section.key}:`] ?? 0, totalCount);
      return { id: t.id, name: t.name, doneCount, totalCount };
    });
    teacherStatuses.sort((a, b) => b.doneCount / b.totalCount - a.doneCount / a.totalCount);
    // Any upload counts here, even partial -- a teacher who uploaded 1 of 17 weekly plans still
    // shows up in this count instead of only teachers who fully completed the section.
    const count = teacherStatuses.filter((t) => t.doneCount > 0).length;
    return { key: section.key, label: section.labelAr, count, teachers: teacherStatuses };
  });

  const scheduleCount = teachers.filter((t) => t.hasSchedule).length;
  const fullyCompleteCount = teachers.filter((t) => t.completionPercent === 100).length;
  const average = total ? Math.round(teachers.reduce((s, t) => s + t.completionPercent, 0) / total) : 0;

  return (
    <>
      <StatGrid>
        <StatCard label="عدد المعلمين" value={total} />
        <StatCard label="أكملوا الملف بالكامل" value={fullyCompleteCount} tone="green" />
        <StatCard label="رفعوا الجدول" value={scheduleCount} />
        <StatCard label="متوسط نسبة الإنجاز" value={`${average}%`} tone="amber" />
      </StatGrid>
      <StatSection title="عدد المعلمين اللي رفعوا ملف لكل قسم" note="اضغط على أي قسم لعرض المعلمين اللي رفعوا (أخضر) والي ما رفعوا (أحمر)">
        <SectionBreakdownList sections={sectionStats} total={total} />
      </StatSection>
    </>
  );
}

async function InquiriesStats({ range }: { range: StatRange }) {
  const s = await getInquiryStats(range);
  const pct = (n: number) => (s.total ? `${Math.round((n / s.total) * 100)}%` : "0%");
  return (
    <>
      <StatGrid>
        <StatCard label="كل المسائلات" value={s.total} />
        <StatCard label="مقبولة" value={s.accepted} tone="green" />
        <StatCard label="مرفوضة" value={s.rejected} tone="red" />
        <StatCard label="بانتظار القرار" value={s.pending} tone="amber" />
        <StatCard label="تجاوزت مهلة الأسبوع بدون رد" value={s.overdue} tone="red" />
        <StatCard label="عليها مرفقات" value={s.withFiles} tone="slate" />
        <StatCard label="متوسط أيام الرد" value={s.avgDaysToAnswer ?? "—"} tone="slate" />
        <StatCard label="متوسط أيام القرار" value={s.avgDaysToDecision ?? "—"} tone="slate" />
      </StatGrid>
      <p className="text-xs text-slate-400">
        نسبة القبول {pct(s.accepted)} · نسبة الرفض {pct(s.rejected)} · بدون قرار {pct(s.pending)}
      </p>
      <StatSection title="حسب النوع">
        <DataTable
          columns={["النوع", "الكل", "مقبولة", "مرفوضة", "بانتظار القرار"]}
          rows={s.byKind.map((k) => [KIND_LABELS[k.kind] ?? k.kind, k.total, k.accepted, k.rejected, k.pending])}
        />
      </StatSection>
      <StatSection title="حسب المعلم" note="الأكثر مسائلات أولاً، ومجموع دقائق التأخر لكل واحد">
        <DataTable
          columns={["المعلم", "الكل", "مقبولة", "مرفوضة", "بانتظار", "دقائق التأخر"]}
          rows={s.byTeacher.slice(0, 40).map((t) => [t.name, t.total, t.accepted, t.rejected, t.pending, t.minutes])}
        />
      </StatSection>
      <StatSection title="عدد المسائلات المرسلة بكل يوم">
        <BarList items={s.byDay.slice(-14)} />
      </StatSection>
    </>
  );
}

async function ReferralsStats({ range }: { range: StatRange }) {
  const s = await getReferralStats(range);
  return (
    <>
      <StatGrid>
        <StatCard label="التحويلات المرسلة" value={s.total} />
        <StatCard label="متوسط أيام الإنجاز" value={s.avgDaysToComplete ?? "—"} tone="amber" />
      </StatGrid>
      <StatSection title="حسب الحالة">
        <BarList items={s.byStatus} />
      </StatSection>
      <StatSection title="وكلاء شؤون الطلاب">
        <DataTable columns={["الوكيل", "المستلم", "أنهى"]} rows={s.byAgent.map((a) => [a.name, a.total, a.done])} />
      </StatSection>
      <StatSection title="الموجهون الطلابيون">
        <DataTable columns={["الموجه", "المستلم", "أنهى"]} rows={s.byCounselor.map((a) => [a.name, a.total, a.done])} />
      </StatSection>
      <StatSection title="أكثر الفصول تحويلاً">
        <BarList items={s.byClass} />
      </StatSection>
      <StatSection title="أكثر الأسباب">
        <BarList items={s.byReason} />
      </StatSection>
      <StatSection title="أكثر المعلمين تحويلاً">
        <BarList items={s.byTeacher} />
      </StatSection>
    </>
  );
}

async function PerformanceStatsView({ range }: { range: StatRange }) {
  const s = await getPerformanceStats(range);
  return (
    <>
      <StatGrid>
        <StatCard label="مجموع دقائق التأخر" value={s.totalLateMinutes} tone="red" />
        <StatCard label="غياب مسجّل" value={s.categories.reduce((n, c) => n + c.absent, 0)} tone="red" />
        <StatCard label="تأخر مسجّل" value={s.categories.reduce((n, c) => n + c.late, 0)} tone="amber" />
      </StatGrid>
      <StatSection title="حسب القسم">
        <DataTable columns={["القسم", "غياب", "تأخر", "دقائق التأخر"]} rows={s.categories.map((c) => [c.label, c.absent, c.late, c.lateMinutes])} />
      </StatSection>
      <StatSection title="أكثر المعلمين غياباً وتأخراً">
        <DataTable columns={["المعلم", "غياب", "تأخر", "دقائق التأخر"]} rows={s.topTeachers.map((t) => [t.name, t.absent, t.late, t.lateMinutes])} />
      </StatSection>
    </>
  );
}

async function WaitingStatsView({ range }: { range: StatRange }) {
  const s = await getWaitingStats(range);
  return (
    <>
      <StatGrid>
        <StatCard label="حصص الانتظار المسندة" value={s.total} />
      </StatGrid>
      <StatSection title="أكثر من غطّى حصصاً">
        <BarList items={s.bySubstitute} />
      </StatSection>
      <StatSection title="أكثر المعلمين غياباً (حصصهم اللي انغطت)">
        <BarList items={s.byAbsent} />
      </StatSection>
      <StatSection title="حسب اليوم">
        <BarList items={s.byDay} />
      </StatSection>
      <StatSection title="حسب الحصة">
        <BarList items={s.byPeriod} />
      </StatSection>
    </>
  );
}

async function ReviewStatsView({ range }: { range: StatRange }) {
  const s = await getReviewStats(range);
  return (
    <>
      <StatGrid>
        <StatCard label="ملفات المعلمين" value={s.files} />
        <StatCard label="مقبولة" value={s.accepted} tone="green" />
        <StatCard label="مرجّعة للتعديل" value={s.needsRevision} tone="red" />
        <StatCard label="لم تُراجع" value={s.notReviewed} tone="amber" />
      </StatGrid>
      <StatSection title="أكثر المعلمين عندهم ملفات مرجّعة">
        <BarList items={s.revisionByTeacher} />
      </StatSection>
    </>
  );
}

async function ScheduleStatsView() {
  const s = await getScheduleStats();
  return (
    <>
      <StatGrid>
        <StatCard label="معلمون عندهم حصص" value={s.teachers} />
        <StatCard label="حصص في الأسبوع" value={s.slots} />
        <StatCard label="الشعب" value={s.sections} />
        <StatCard label="متوسط نصاب المعلم" value={s.avgLoad} tone="amber" />
      </StatGrid>
      <StatSection title="نصاب كل معلم (عدد الحصص في الأسبوع)">
        <DataTable columns={["المعلم", "الحصص"]} rows={s.byTeacher} />
      </StatSection>
      <StatSection title="الحصص حسب المادة">
        <BarList items={s.bySubject} />
      </StatSection>
      <StatSection title="الحصص حسب اليوم">
        <BarList items={s.byDay} />
      </StatSection>
      <StatSection title="الحصص حسب رقم الحصة">
        <BarList items={s.byPeriod} />
      </StatSection>
    </>
  );
}

async function WeeklyPlanStatsView() {
  const s = await getWeeklyPlanStats(6);
  return (
    <>
      <StatSection title="الخطة الأسبوعية لآخر 6 أسابيع" note="الأسبوع يبدأ يوم الأحد؛ المعلمون اللي سلّموا الخطة واللي ما سلّموا">
        <DataTable columns={["الأسبوع (يبدأ)", "سلّموا", "ما سلّموا"]} rows={s.weeks.map((w) => [w.week, w.uploaded, w.missing])} />
      </StatSection>
      <StatSection title="أكثر المعلمين تقصيراً (عدد الأسابيع اللي ما سلّموا فيها من آخر 6)">
        <BarList items={s.missedMost} empty="الكل سلّم" />
      </StatSection>
    </>
  );
}

async function SchoolFilesStatsView({ range }: { range: StatRange }) {
  const s = await getSchoolFilesStats(range);
  return (
    <>
      <StatGrid>
        <StatCard label="ملفات إدارة المدرسة" value={s.total} />
      </StatGrid>
      <StatSection title="حسب القسم">
        <BarList items={s.byCategory} />
      </StatSection>
      <StatSection title="أكثر من رفع">
        <BarList items={s.byUploader} />
      </StatSection>
    </>
  );
}

async function ImpactStatsView({ range }: { range: StatRange }) {
  const s = await getImpactStats(range);
  return (
    <>
      <StatGrid>
        <StatCard label="قياسات الأثر" value={s.total} />
        <StatCard label="متوسط التحسن (من الدرجة الكاملة)" value={s.avgImprovementPct === null ? "—" : `${s.avgImprovementPct}%`} tone="green" />
      </StatGrid>
      <StatSection title="حسب مستوى التحسن">
        <BarList items={s.byLevel} />
      </StatSection>
      <StatSection title="حسب المادة">
        <BarList items={s.bySubject} />
      </StatSection>
      <StatSection title="أكثر المعلمين قياساً">
        <BarList items={s.byTeacher} />
      </StatSection>
    </>
  );
}

async function ExcuseStatsView({ range }: { range: StatRange }) {
  const s = await getExcuseStats(range);
  return (
    <>
      <StatGrid>
        <StatCard label="ملفات الاستئذان" value={s.total} />
      </StatGrid>
      <StatSection title="حسب النوع">
        <BarList items={s.bySubsection} />
      </StatSection>
      <StatSection title="أكثر المعلمين استئذاناً">
        <BarList items={s.byTeacher} />
      </StatSection>
    </>
  );
}

async function ActivityStatsView({ range }: { range: StatRange }) {
  const s = await getActivityStats(range);
  return (
    <>
      <StatGrid>
        <StatCard label="عمليات مسجّلة" value={s.total} />
      </StatGrid>
      <StatSection title="حسب نوع العملية">
        <BarList items={s.byAction} />
      </StatSection>
      <StatSection title="أكثر الحسابات نشاطاً">
        <BarList items={s.byActor} />
      </StatSection>
      <StatSection title="النشاط في آخر الأيام">
        <BarList items={s.byDay} />
      </StatSection>
    </>
  );
}

async function AccountStatsView() {
  const s = await getAccountStats();
  return (
    <>
      <StatGrid>
        <StatCard label="كل الحسابات" value={s.total} />
      </StatGrid>
      <StatSection title="حسب النوع">
        <BarList items={s.byRole} />
      </StatSection>
      <StatSection title="الحسابات المقيّدة بقسم">
        <BarList items={s.byCategory} empty="لا توجد" />
      </StatSection>
      <StatSection title="الصلاحيات الإضافية">
        <BarList items={s.flags} />
      </StatSection>
    </>
  );
}
