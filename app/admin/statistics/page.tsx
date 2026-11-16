import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";
import { SectionBreakdownList, type SectionBreakdownItem } from "@/components/admin/SectionBreakdownList";
import { BarList, ChartRow, ColumnChart, DataTable, DonutChart, StatCard, StatGrid, StatSection, StackedColumns } from "@/components/admin/StatBlocks";
import { PrintButton } from "@/components/admin/PrintButton";
import { SCHOOL_NAME } from "@/lib/school";
import {
  RANGE_LABELS,
  excludedUsers,
  getInquiryStats,
  getPerformanceStats,
  getReviewStats,
  getWaitingStats,
  parseRange,
  type StatRange,
} from "@/lib/statistics";
import { getReferralStats } from "@/lib/statistics-referrals";
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

/** A per-person matrix as table rows: the name, a count for each column, then the total. */
const matrixRows = (m: { name: string; total: number; cells: number[] }[]): (string | number)[][] => m.map((r) => [r.name, ...r.cells, r.total]);

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
    <div className="flex flex-col gap-6 max-w-3xl print:max-w-none print-exact">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">الإحصائيات</h2>
        <PrintButton />
      </div>

      {/* what the printed page says at the top: which statistics, for which period, and when it was printed */}
      <div className="print-only text-sm">
        <p className="font-bold">
          {SCHOOL_NAME} -- إحصائيات {TABS.find((t) => t.key === tab)?.label}
          {!NO_RANGE.includes(tab) ? ` -- ${RANGE_LABELS[range]}` : ""}
        </p>
        <p className="text-xs">تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      <div className="no-print flex flex-wrap gap-2 text-sm">
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
        <div className="no-print flex flex-wrap items-center gap-2 text-xs">
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
  const [allTeachers, ex] = await Promise.all([getTeachersWithCompletion(), excludedUsers()]);
  const teachers = allTeachers.filter((t) => !ex.ids.has(t.id));
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
      <StatSection title="توزيع نسب الإنجاز">
        <DonutChart
          title="معلم"
          colors={["#c0392b", "#d35400", "#e0a100", "#8bb83a", "#1f7a4d"]}
          items={[
            ["أقل من 25%", teachers.filter((t) => t.completionPercent < 25).length],
            ["25% إلى 49%", teachers.filter((t) => t.completionPercent >= 25 && t.completionPercent < 50).length],
            ["50% إلى 74%", teachers.filter((t) => t.completionPercent >= 50 && t.completionPercent < 75).length],
            ["75% إلى 99%", teachers.filter((t) => t.completionPercent >= 75 && t.completionPercent < 100).length],
            ["100%", teachers.filter((t) => t.completionPercent === 100).length],
          ]}
        />
      </StatSection>
      <StatSection title="نسبة إنجاز كل معلم" note="الأقل إنجازاً أولاً، مع عدد الخانات اللي عبّاها">
        <DataTable
          columns={["المعلم", "نسبة الإنجاز", "خانات معبّأة"]}
          rows={[...teachers].sort((a, b) => a.completionPercent - b.completionPercent || a.name.localeCompare(b.name, "ar")).map((t) => [t.name, `${t.completionPercent}%`, t.filledSlots.size])}
        />
      </StatSection>
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
      <ChartRow>
      <StatSection title="حالة المسائلات">
        <DonutChart title="مسائلة" colors={["#1f7a4d", "#c0392b", "#e0a100"]} items={[["مقبولة", s.accepted], ["مرفوضة", s.rejected], ["بانتظار القرار", s.pending]]} />
      </StatSection>
      <StatSection title="المسائلات حسب النوع">
        <DonutChart title="مسائلة" items={s.byKind.map((k) => [KIND_LABELS[k.kind] ?? k.kind, k.total] as [string, number])} />
      </StatSection>
      </ChartRow>
      <StatSection title="المسائلات المرسلة في آخر الأيام">
        <ColumnChart items={s.byDay.slice(-14)} />
      </StatSection>
      <p className="text-xs text-slate-400">
        نسبة القبول {pct(s.accepted)} · نسبة الرفض {pct(s.rejected)} · بدون قرار {pct(s.pending)}
      </p>
      <StatSection title="حسب النوع">
        <DataTable
          columns={["النوع", "الكل", "مقبولة", "مرفوضة", "بانتظار القرار"]}
          rows={s.byKind.map((k) => [KIND_LABELS[k.kind] ?? k.kind, k.total, k.accepted, k.rejected, k.pending])}
        />
      </StatSection>
      <StatSection title="قرارات مسائلات الغياب" note="إجازة مرضية، تحتسب من رصيده، أو اعتماد الحسم">
        <DonutChart title="غياب" colors={["#2b6cb0", "#1f7a4d", "#c0392b"]} items={s.absenceOutcomes} />
      </StatSection>
      <StatSection title="حسب المعلم" note="الأكثر مسائلات أولاً، ومجموع دقائق التأخر لكل واحد">
        <DataTable
          columns={["المعلم", "الكل", "مقبولة", "مرفوضة", "بانتظار", "دقائق التأخر"]}
          rows={s.byTeacher.slice(0, 40).map((t) => [t.name, t.total, t.accepted, t.rejected, t.pending, t.minutes])}
        />
      </StatSection>
      <StatSection title="لكل معلم حسب نوع المسائلة">
        <DataTable columns={["المعلم", "تأخير (حضوري)", "غياب", "أخرى", "المجموع"]} rows={matrixRows(s.byTeacherKinds)} />
      </StatSection>
      <StatSection title="عدد المسائلات المرسلة بكل يوم">
        <BarList items={s.byDay.slice(-14)} />
      </StatSection>
    </>
  );
}

async function ReferralsStats({ range }: { range: StatRange }) {
  const s = await getReferralStats(range);
  const days = (v: number | null) => (v === null ? "—" : `${v} يوم`);
  return (
    <>
      <StatGrid>
        <StatCard label="تحويلات مرسلة" value={s.sent} />
        <StatCard label="طلاب تحوّلوا (بدون تكرار)" value={s.uniqueStudents} />
        <StatCard label="طلاب تحوّلوا أكثر من مرة" value={s.repeatStudents} tone="amber" />
        <StatCard label="تم الانتهاء منها" value={`${s.completed} (${s.completedPct}%)`} tone="green" />
        <StatCard label="من المعلمين" value={s.teacherFiled} tone="slate" />
        <StatCard label="مخالفات سجّلها الوكيل" value={s.agentFiled} tone="slate" />
        <StatCard label="مسودات لم تُرسل" value={s.drafts} tone="slate" />
        <StatCard label="متأخرة أكثر من أسبوع" value={s.overdue} tone="red" />
        <StatCard label="لم يفتحها الوكيل" value={s.notOpenedByAgent} tone="red" />
        <StatCard label="لم يفتحها الموجه" value={s.notOpenedByCounselor} tone="red" />
        <StatCard label="ملفات أضافها الوكلاء" value={s.filesByAgent} tone="slate" />
        <StatCard label="ملفات أضافها الموجهون" value={s.filesByCounselor} tone="slate" />
      </StatGrid>
      <ChartRow>
      <StatSection title="حالة التحويلات">
        <DonutChart title="تحويل" colors={["#6b7280", "#e0a100", "#2b6cb0", "#16a3a3", "#1f7a4d"]} items={s.byStatus} />
      </StatSection>
      <StatSection title="مصدر التحويلات">
        <DonutChart title="تحويل" colors={["#2b6cb0", "#8e44ad"]} items={[["من المعلمين", s.teacherFiled], ["مخالفات سجّلها الوكيل", s.agentFiled]]} />
      </StatSection>
      </ChartRow>
      <StatSection title="التحويلات حسب الشهر">
        <ColumnChart color="#2b6cb0" items={s.byMonth} />
      </StatSection>
      <StatSection title="التحويلات في آخر الأيام">
        <ColumnChart color="#2b6cb0" items={s.byDay} />
      </StatSection>
      <StatSection title="متوسط الأزمنة" note="من إرسال التحويل حتى كل خطوة">
        <DataTable
          columns={["الخطوة", "متوسط الزمن"]}
          rows={[
            ["فتح الوكيل للتحويل", days(s.avgDaysToAgentOpen)],
            ["إنهاء الوكيل لإجراءاته", days(s.avgDaysToAgentFinish)],
            ["فتح الموجه للتحويل (بعد التحويل له)", days(s.avgDaysToCounselorOpen)],
            ["الانتهاء الكامل", days(s.avgDaysToComplete)],
          ]}
        />
      </StatSection>
      <StatSection title="حسب الحالة">
        <BarList items={s.byStatus} />
      </StatSection>
      <StatSection title="وكلاء شؤون الطلاب" note="المستلم من المعلمين، كم فتح، كم أنهى، كم حوّل للموجه، وكم مخالفة سجّل بنفسه">
        <DataTable
          columns={["الوكيل", "المستلم", "فتح", "أنهى", "حوّل للموجه", "ما زال عنده", "سجّل بنفسه", "متوسط الإنهاء"]}
          rows={s.agents.map((a) => [a.name, a.received, a.opened, a.finished, a.forwarded, a.pending, a.filedSelf, days(a.avgDaysToFinish)])}
        />
      </StatSection>
      <StatSection title="الموجهون الطلابيون">
        <DataTable
          columns={["الموجه", "المستلم", "فتح", "عالج وأنهى", "ما زال عنده", "متوسط الإنهاء"]}
          rows={s.counselors.map((c) => [c.name, c.received, c.opened, c.finished, c.pending, days(c.avgDaysToFinish)])}
        />
      </StatSection>
      <StatSection title="أكثر الطلاب تحويلاً" note="الطالب وكم مرة تحوّل">
        <DataTable columns={["الطالب", "الفصل", "عدد التحويلات"]} rows={s.topStudents.map((t) => [t.name, t.className, t.count])} />
      </StatSection>
      <StatSection title="حسب الفصل">
        <DataTable columns={["الفصل", "تحويلات", "طلاب"]} rows={s.byClass.map((c) => [c.name, c.referrals, c.students])} />
      </StatSection>
      <StatSection title="أكثر أسباب تحويل المعلمين">
        <BarList items={s.reasons} />
      </StatSection>
      <StatSection title="أكثر المخالفات المسجّلة من الوكلاء">
        <BarList items={s.violations} empty="لا توجد مخالفات مسجّلة" />
      </StatSection>
      <StatSection title="أكثر المواد تحويلاً">
        <BarList items={s.bySubject} />
      </StatSection>
      <StatSection title="أكثر إجراءات الوكلاء استعمالاً">
        <BarList items={s.agentProcedures} empty="ما سُجّلت إجراءات" />
      </StatSection>
      <StatSection title="أكثر إجراءات الموجهين استعمالاً">
        <BarList items={s.counselorProcedures} empty="ما سُجّلت إجراءات" />
      </StatSection>
      <StatSection title="أكثر المعلمين تحويلاً">
        <DataTable columns={["المعلم", "تحويلات", "طلاب"]} rows={s.byTeacher.map((t) => [t.name, t.referrals, t.students])} />
      </StatSection>
      <StatSection title="التحويلات حسب الشهر">
        <BarList items={s.byMonth} />
      </StatSection>
      <StatSection title="التحويلات في آخر الأيام">
        <BarList items={s.byDay} />
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
      <StatSection title="غياب وتأخر">
        <DonutChart
          title="حالة"
          colors={["#c0392b", "#e0a100"]}
          items={[
            ["غياب", s.categories.reduce((n, c) => n + c.absent, 0)],
            ["تأخر", s.categories.reduce((n, c) => n + c.late, 0)],
          ]}
        />
      </StatSection>
      <StatSection title="المسجّل في كل قسم">
        <DonutChart title="حالة" items={s.categories.map((c) => [c.label, c.absent + c.late] as [string, number])} />
      </StatSection>
      <StatSection title="حسب القسم">
        <DataTable columns={["القسم", "غياب", "تأخر", "دقائق التأخر"]} rows={s.categories.map((c) => [c.label, c.absent, c.late, c.lateMinutes])} />
      </StatSection>
      <StatSection title="لكل معلم حسب القسم" note="عدد مرات الغياب في كل قسم، وفي الالتزام بزمن الحصة الغياب والتأخر">
        <DataTable
          columns={["المعلم", "الطابور (غياب)", "الإشراف (غياب)", "المناوبة (غياب)", "الانتظار (غياب)", "زمن الحصة (غياب)", "زمن الحصة (تأخر)", "المجموع"]}
          rows={matrixRows(s.byTeacherSections)}
        />
      </StatSection>
      <StatSection title="دقائق التأخر لكل معلم">
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
      <StatSection title="حصص الانتظار حسب اليوم">
        <ColumnChart color="#e0a100" items={s.byDay} />
      </StatSection>
      <StatSection title="حصص الانتظار حسب الحصة">
        <ColumnChart color="#e0a100" items={s.byPeriod} />
      </StatSection>
      <StatSection title="لكل معلم: حصص غطّاها وحصصه اللي انغطت" note="الأكثر نشاطاً أولاً">
        <DataTable columns={["المعلم", "حصص غطّاها", "حصصه اللي انغطت", "المجموع"]} rows={matrixRows(s.byPerson)} />
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
      <StatSection title="حالة مراجعة الملفات">
        <DonutChart title="ملف" colors={["#1f7a4d", "#c0392b", "#e0a100"]} items={[["مقبولة", s.accepted], ["مرجّعة للتعديل", s.needsRevision], ["لم تُراجع", s.notReviewed]]} />
      </StatSection>
      <StatSection title="لكل معلم حسب حالة ملفاته">
        <DataTable columns={["المعلم", "مقبولة", "مرجّعة للتعديل", "لم تُراجع", "المجموع"]} rows={matrixRows(s.byTeacher)} />
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
      <StatSection title="الحصص حسب اليوم والحصة">
        <ColumnChart color="#2b6cb0" items={s.byDay} />
        <ColumnChart color="#16a3a3" items={s.byPeriod} />
      </StatSection>
      <StatSection title="نصاب كل معلم موزّعاً على أيام الأسبوع">
        <DataTable columns={["المعلم", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "المجموع"]} rows={matrixRows(s.byTeacherDays)} />
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
      <StatSection title="تسليم الخطة الأسبوعية" note="أخضر: سلّموا، أحمر: ما سلّموا (الأسبوع يبدأ يوم الأحد)">
        <StackedColumns rows={[...s.weeks].reverse().map((w) => ({ label: w.week, a: w.uploaded, b: w.missing }))} aLabel="سلّموا" bLabel="ما سلّموا" />
      </StatSection>
      <StatSection title="الخطة الأسبوعية لآخر 6 أسابيع" note="الأسبوع يبدأ يوم الأحد؛ المعلمون اللي سلّموا الخطة واللي ما سلّموا">
        <DataTable columns={["الأسبوع (يبدأ)", "سلّموا", "ما سلّموا"]} rows={s.weeks.map((w) => [w.week, w.uploaded, w.missing])} />
      </StatSection>
      <StatSection title="لكل معلم: كم أسبوع سلّم وكم أسبوع ما سلّم (من آخر 6)" note="الأكثر تقصيراً أولاً">
        <DataTable columns={["المعلم", "أسابيع سلّم", "أسابيع ما سلّم", "المجموع"]} rows={matrixRows(s.byTeacher)} />
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
      <StatSection title="الملفات حسب القسم">
        <DonutChart title="ملف" items={s.byCategory.slice(0, 8)} />
      </StatSection>
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
      <StatSection title="مستوى التحسن">
        <DonutChart title="قياس" colors={["#1f7a4d", "#8bb83a", "#e0a100", "#c0392b"]} items={s.byLevel} />
      </StatSection>
      <StatSection title="حسب مستوى التحسن">
        <BarList items={s.byLevel} />
      </StatSection>
      <StatSection title="حسب المادة">
        <BarList items={s.bySubject} />
      </StatSection>
      <StatSection title="لكل معلم حسب مستوى التحسن">
        <DataTable columns={["المعلم", "كبير", "متوسط", "بسيط", "لم يتحسن", "المجموع"]} rows={matrixRows(s.byTeacherLevels)} />
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
      <StatSection title="أنواع الاستئذان">
        <DonutChart title="ملف" items={s.bySubsection} />
      </StatSection>
      <StatSection title="حسب النوع">
        <BarList items={s.bySubsection} />
      </StatSection>
      <StatSection title="لكل معلم حسب نوع الاستئذان" note="كل معلم رفع كم ملف من كل نوع (الأكثر أولاً)">
        <DataTable columns={["المعلم", "مواعيد المستشفى", "مواعيد المراكز الصحية", "أخرى", "غير محدد", "المجموع"]} rows={matrixRows(s.byTeacherKinds)} />
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
      <StatSection title="النشاط في آخر الأيام">
        <ColumnChart color="#6b7280" items={s.byDay} />
      </StatSection>
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
      <StatSection title="توزيع الحسابات">
        <DonutChart title="حساب" items={s.byRole} />
      </StatSection>
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
