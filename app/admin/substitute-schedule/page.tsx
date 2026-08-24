"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DAYS,
  DayKey,
  OFFICIAL_LOAD,
  PERIODS,
  PERIOD_TIMES,
  PeriodKey,
  TEACHER_BY_NAME,
  TEACHER_NAMES_SORTED,
  CAPPED_TEACHERS,
} from "@/lib/substitute-data";
import {
  AbsenceGroup,
  Candidate,
  RANK_LABELS,
  RESERVE_RANK,
  SubstituteAssignment,
  buildAbsenceGroups,
  getCandidates,
  getReserveCandidates,
} from "@/lib/substitute-logic";
import { SCHOOL_NAME } from "@/lib/school";

const STORAGE_KEY = "makkah-substitute-log-v1";

function loadAssignments(): SubstituteAssignment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAssignments(assignments: SubstituteAssignment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    // localStorage unavailable (private mode, disabled, etc.) — silently skip persistence.
  }
}

function candidateInfoLabel(c: Candidate): string {
  if (CAPPED_TEACHERS.has(c.name)) {
    return `انتظار ${c.subCount}/5 هذا الأسبوع`;
  }
  return `نصاب ${c.official} + انتظار ${c.subCount} = ${c.total}/24`;
}

function buildSlipHtml(group: AbsenceGroup, dateStr: string): string {
  const rows = group.rows
    .map(
      (r) =>
        `<tr><td>${r.period}</td><td>${r.section ?? "/"}</td><td></td><td>${r.assignment?.substitute ?? "/"}</td><td></td><td></td></tr>`
    )
    .join("");

  return `
  <div class="slip">
    <div class="slip-header">
      <div>
        <p>زملائي المعلمين / نظراً لغياب الزميل: <strong>${group.absentTeacher}</strong></p>
        <p>آمل تسديد مكانه حسب الجدول الموضح والتوقيع بالعلم، ولكم جزيل الشكر</p>
      </div>
      <div class="slip-header-side">
        <p>لهذا اليوم: <strong>${group.day}</strong></p>
        <p>الموافق: ${dateStr}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>الحصة</th><th>الفصل</th><th>المادة</th><th>المعلم المنتظر</th><th>التوقيع</th><th>ملاحظات</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function buildPrintHtml(assignments: SubstituteAssignment[]): string {
  const groups = buildAbsenceGroups(assignments);
  const dateStr = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  const slips = groups.map((g) => buildSlipHtml(g, dateStr)).join("");

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>سجل إسناد الانتظار</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #000; }
  h1 { font-size: 20px; margin-bottom: 16px; }
  .slip { margin-bottom: 28px; page-break-inside: avoid; }
  .slip-header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 8px; font-size: 13px; }
  .slip-header p { margin: 2px 0; }
  .slip-header-side { text-align: left; white-space: nowrap; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #000; padding: 6px 8px; text-align: right; font-size: 12px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
  <h1>${SCHOOL_NAME} — سجل إسناد الانتظار</h1>
  ${slips}
  <script>
    window.onload = function () {
      try { window.print(); } catch (e) {}
    };
    window.onafterprint = function () {
      try { window.close(); } catch (e) {}
    };
  </script>
</body>
</html>`;
}

export default function SubstituteSchedulePage() {
  const [absentTeacher, setAbsentTeacher] = useState("");
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);
  const [assignments, setAssignments] = useState<SubstituteAssignment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [showPrintToast, setShowPrintToast] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // One-time hydration from localStorage, which doesn't exist during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssignments(loadAssignments());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveAssignments(assignments);
  }, [assignments, loaded]);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const dayPeriods = useMemo(() => {
    if (!absentTeacher || !selectedDay) return [];
    const teacher = TEACHER_BY_NAME[absentTeacher];
    if (!teacher) return [];
    return PERIODS.filter((p) => teacher.schedule[selectedDay][p] !== null).map((p) => ({
      period: p,
      section: teacher.schedule[selectedDay][p] as string,
    }));
  }, [absentTeacher, selectedDay]);

  const assignmentFor = useCallback(
    (day: DayKey, period: PeriodKey, absent: string) =>
      assignments.find((a) => a.day === day && a.period === period && a.absentTeacher === absent),
    [assignments]
  );

  function handleAssign(day: DayKey, period: PeriodKey, absent: string, section: string, substituteName: string, rank: number) {
    setAssignments((prev) => {
      const filtered = prev.filter((a) => !(a.day === day && a.period === period && a.absentTeacher === absent));
      return [
        ...filtered,
        {
          day,
          period,
          absentTeacher: absent,
          section,
          substitute: substituteName,
          rank,
          timestamp: new Date().toISOString(),
        },
      ];
    });
  }

  function handleCancel(day: DayKey, period: PeriodKey, absent: string) {
    setAssignments((prev) => prev.filter((a) => !(a.day === day && a.period === period && a.absentTeacher === absent)));
  }

  function handleResetClick() {
    if (confirmingReset) {
      setAssignments([]);
      setConfirmingReset(false);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      return;
    }
    setConfirmingReset(true);
    resetTimeoutRef.current = setTimeout(() => setConfirmingReset(false), 4000);
  }

  function handlePrint() {
    try {
      window.print();
    } catch {
      // ignore
    }
    try {
      const html = buildPrintHtml(assignments);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      // ignore
    }
    setShowPrintToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setShowPrintToast(false), 12000);
  }

  const groups = useMemo(() => buildAbsenceGroups(assignments), [assignments]);
  const printDateStr = useMemo(
    () => new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }),
    []
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="print-only">
        <h1 className="text-lg font-bold">{SCHOOL_NAME} — سجل إسناد الانتظار</h1>
        <p>
          تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })} · عدد
          الإسنادات: {assignments.length}
        </p>
      </div>

      <div className="no-print flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">جدول الانتظار</h2>
          <p className="text-sm text-slate-500">اختر المعلم الغائب واليوم لعرض حصصه ومرشحي التغطية</p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex flex-col gap-1.5 max-w-sm">
            <label htmlFor="absentTeacher" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              المعلم الغائب
            </label>
            <select
              id="absentTeacher"
              value={absentTeacher}
              onChange={(e) => setAbsentTeacher(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            >
              <option value="">— اختر معلماً —</option>
              {TEACHER_NAMES_SORTED.map((name) => (
                <option key={name} value={name}>
                  {name} (نصاب {OFFICIAL_LOAD[name]})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">اليوم</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    selectedDay === day
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                      : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>

        {absentTeacher && selectedDay && (
          <div className="flex flex-col gap-4">
            {dayPeriods.length === 0 ? (
              <p className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500">
                لا توجد حصص لهذا المعلم يوم {selectedDay}.
              </p>
            ) : (
              dayPeriods.map(({ period, section }) => {
                const existing = assignmentFor(selectedDay, period, absentTeacher);
                const candidates = existing ? [] : getCandidates(assignments, selectedDay, period, absentTeacher);
                const reserveCandidates = existing ? [] : getReserveCandidates(assignments, selectedDay, period);

                return (
                  <div
                    key={period}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">
                        الحصة {period} <span className="text-slate-400 font-normal">({PERIOD_TIMES[period]})</span>
                      </h3>
                      <span className="rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-3 py-1 text-xs font-medium tabular-nums">
                        شعبة {section}
                      </span>
                    </div>

                    {existing ? (
                      <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
                        <p className="text-sm text-green-700 dark:text-green-300">
                          ✓ يغطيها: <strong>{existing.substitute}</strong> — {RANK_LABELS[existing.rank - 1]}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCancel(selectedDay, period, absentTeacher)}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          إلغاء الإسناد
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {candidates.length === 0 ? (
                          <p className="text-sm text-amber-600 dark:text-amber-400">لا يوجد معلم متاح لتغطية هذه الحصة حالياً.</p>
                        ) : (
                          <>
                            {candidates.length < 5 && (
                              <p className="text-xs text-slate-400">يوجد {candidates.length} مرشح متاح فقط لهذه الحصة</p>
                            )}
                            {candidates.map((c, i) => (
                              <div
                                key={c.name}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                    {RANK_LABELS[i]}: {c.name}
                                  </p>
                                  <p className="text-xs text-slate-400 tabular-nums">{candidateInfoLabel(c)}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAssign(selectedDay, period, absentTeacher, section, c.name, i + 1)}
                                  className="shrink-0 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-3 py-1.5 transition-colors"
                                >
                                  إسناد
                                </button>
                              </div>
                            ))}
                          </>
                        )}

                        {reserveCandidates.length > 0 && (
                          <div className="flex flex-col gap-2 pt-1">
                            {reserveCandidates.map((name) => (
                              <div
                                key={name}
                                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2"
                              >
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                  {RANK_LABELS[RESERVE_RANK - 1]}: {name}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleAssign(selectedDay, period, absentTeacher, section, name, RESERVE_RANK)}
                                  className="shrink-0 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] text-sm px-3 py-1.5 transition-colors hover:bg-[var(--brand-primary)]/10"
                                >
                                  إسناد
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="no-print flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">سجل إسناد الانتظار لهذا الأسبوع</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              طباعة السجل
            </button>
            <button
              type="button"
              onClick={handleResetClick}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                confirmingReset
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {confirmingReset ? "اضغط مرة أخرى للتأكيد" : "بدء أسبوع جديد"}
            </button>
          </div>
        </div>

        {showPrintToast && (
          <div className="no-print flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            <span>إذا لم تظهر نافذة الطباعة تلقائياً، اضغط Ctrl+P (أو ⌘+P على macOS) الآن لطباعة السجل أو حفظه PDF</span>
            <button type="button" onClick={() => setShowPrintToast(false)} className="shrink-0 text-lg leading-none px-2">
              ×
            </button>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
            لا توجد إسنادات مسجّلة بعد
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={`${group.day}-${group.absentTeacher}`}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3 text-sm">
                <div>
                  <p className="text-slate-700 dark:text-slate-200">
                    زملائي المعلمين / نظراً لغياب الزميل: <strong>{group.absentTeacher}</strong>
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    آمل تسديد مكانه حسب الجدول الموضح والتوقيع بالعلم، ولكم جزيل الشكر
                  </p>
                </div>
                <div className="text-left text-xs text-slate-500 whitespace-nowrap">
                  <p>
                    لهذا اليوم: <strong className="text-slate-700 dark:text-slate-200">{group.day}</strong>
                  </p>
                  <p>الموافق: {printDateStr}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm text-right border border-slate-200 dark:border-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 border border-slate-200 dark:border-slate-800">الحصة</th>
                      <th className="px-3 py-2 border border-slate-200 dark:border-slate-800">الفصل</th>
                      <th className="px-3 py-2 border border-slate-200 dark:border-slate-800">المادة</th>
                      <th className="px-3 py-2 border border-slate-200 dark:border-slate-800">المعلم المنتظر</th>
                      <th className="px-3 py-2 border border-slate-200 dark:border-slate-800">التوقيع</th>
                      <th className="px-3 py-2 border border-slate-200 dark:border-slate-800">ملاحظات</th>
                      <th className="px-3 py-2 no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.period} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 tabular-nums">{row.period}</td>
                        <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 tabular-nums">
                          {row.section ?? "/"}
                        </td>
                        <td className="px-3 py-2 border border-slate-200 dark:border-slate-800"></td>
                        <td className="px-3 py-2 border border-slate-200 dark:border-slate-800">
                          {row.assignment?.substitute ?? "/"}
                        </td>
                        <td className="px-3 py-2 border border-slate-200 dark:border-slate-800"></td>
                        <td className="px-3 py-2 border border-slate-200 dark:border-slate-800"></td>
                        <td className="px-3 py-2 no-print">
                          {row.assignment && (
                            <button
                              type="button"
                              onClick={() => handleCancel(group.day, row.period, group.absentTeacher)}
                              className="text-red-600 dark:text-red-400 hover:underline text-xs"
                            >
                              إلغاء
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
