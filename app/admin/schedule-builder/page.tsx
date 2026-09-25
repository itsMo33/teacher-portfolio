"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SCHEDULE_DAYS, SCHEDULE_PERIODS, ScheduleDay, SchedulePeriod, sectionColor } from "@/lib/schedule-builder";

interface Teacher {
  id: string;
  name: string;
}
interface Subject {
  id: string;
  nameAr: string;
}
interface Section {
  id: string;
  nameAr: string;
  sortOrder: number;
}
interface Assignment {
  teacherId: string;
  subjectId: string;
}
interface Slot {
  id: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  sectionId: string;
  day: string;
  period: string;
}
interface Requirement {
  id: string;
  sectionId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  periodsPerWeek: number;
}
interface Constraint {
  id: string;
  teacherId: string;
  day: string | null;
  period: string | null;
}

type Tab = "sections" | "subjects" | "requirements" | "constraints" | "grid" | "master";

function isTeacherUnavailable(constraints: Constraint[], teacherId: string, day: ScheduleDay, period: SchedulePeriod) {
  return constraints.some(
    (c) => c.teacherId === teacherId && (c.day === null || c.day === day) && (c.period === null || c.period === period)
  );
}

/** Every (day, period) where a lesson could legally move to -- the section it belongs to isn't
 *  already using that slot, the teacher isn't already teaching something else there (in any other
 *  section), and it isn't one of the teacher's declared unavailable times. Used to light up valid
 *  drop targets the moment a drag starts, and to answer "وين أقدر أنقلها؟" without any dragging. */
function findFreeSlots(
  sectionSlots: Slot[],
  teacherSlots: Slot[],
  constraints: Constraint[],
  teacherId: string,
  excludeSlotId: string
): Set<string> {
  const sectionBusy = new Set(sectionSlots.filter((s) => s.id !== excludeSlotId).map((s) => `${s.day}::${s.period}`));
  const teacherBusy = new Set(teacherSlots.filter((s) => s.id !== excludeSlotId).map((s) => `${s.day}::${s.period}`));
  const free = new Set<string>();
  for (const day of SCHEDULE_DAYS) {
    for (const period of SCHEDULE_PERIODS) {
      const key = `${day}::${period}`;
      if (sectionBusy.has(key) || teacherBusy.has(key)) continue;
      if (isTeacherUnavailable(constraints, teacherId, day, period)) continue;
      free.add(key);
    }
  }
  return free;
}

export default function ScheduleBuilderPage() {
  const [tab, setTab] = useState<Tab>("sections");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(() => {
    return Promise.all([
      fetch("/api/schedule-builder/teachers").then((r) => r.json()),
      fetch("/api/schedule-builder/subjects").then((r) => r.json()),
      fetch("/api/schedule-builder/sections").then((r) => r.json()),
      fetch("/api/schedule-builder/teacher-subjects").then((r) => r.json()),
      fetch("/api/schedule-builder/requirements").then((r) => r.json()),
      fetch("/api/schedule-builder/constraints").then((r) => r.json()),
    ])
      .then(([t, sub, sec, asg, req, con]) => {
        setTeachers(t.teachers ?? []);
        setSubjects(sub.subjects ?? []);
        setSections(sec.sections ?? []);
        setAssignments(asg.assignments ?? []);
        setRequirements(req.requirements ?? []);
        setConstraints(con.constraints ?? []);
        setError("");
      })
      .catch(() => setError("تعذّر تحميل البيانات"))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className={`flex flex-col gap-6 ${tab === "master" ? "" : "max-w-4xl"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">جدول مدرسي</h2>
          <p className="text-sm text-slate-500">بناء الجدول الأسبوعي: الشعب، المواد، ومن يدرّس أين</p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          رجوع
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "sections", label: "الشعب" },
            { key: "subjects", label: "المواد والمعلمين" },
            { key: "requirements", label: "المتطلبات" },
            { key: "constraints", label: "القيود" },
            { key: "grid", label: "بناء الجدول" },
            { key: "master", label: "الجدول العام" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              tab === t.key
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!loaded ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
          جارٍ التحميل...
        </div>
      ) : tab === "sections" ? (
        <SectionsTab sections={sections} setSections={setSections} setError={setError} />
      ) : tab === "subjects" ? (
        <SubjectsTab
          teachers={teachers}
          subjects={subjects}
          setSubjects={setSubjects}
          assignments={assignments}
          setAssignments={setAssignments}
          setError={setError}
        />
      ) : tab === "requirements" ? (
        <RequirementsTab
          sections={sections}
          subjects={subjects}
          teachers={teachers}
          assignments={assignments}
          requirements={requirements}
          setRequirements={setRequirements}
          setError={setError}
        />
      ) : tab === "constraints" ? (
        <ConstraintsTab
          teachers={teachers}
          constraints={constraints}
          setConstraints={setConstraints}
          setError={setError}
        />
      ) : tab === "grid" ? (
        <GridTab
          teachers={teachers}
          subjects={subjects}
          sections={sections}
          assignments={assignments}
          constraints={constraints}
          setError={setError}
        />
      ) : (
        <MasterGridTab
          teachers={teachers}
          subjects={subjects}
          sections={sections}
          assignments={assignments}
          constraints={constraints}
          setError={setError}
        />
      )}
    </div>
  );
}

function SectionsTab({
  sections,
  setSections,
  setError,
}: {
  sections: Section[];
  setSections: React.Dispatch<React.SetStateAction<Section[]>>;
  setError: (e: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/schedule-builder/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameAr: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSections((prev) => [...prev, data.section]);
      setNewName("");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الإضافة");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف هذه الشعبة؟ سيُحذف كل ما فيها بالجدول أيضًا.")) return;
    const res = await fetch(`/api/schedule-builder/sections/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "تعذّر الحذف");
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== id));
    setError("");
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="اسم الشعبة (مثال: 301)"
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="shrink-0 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
        >
          إضافة
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
          >
            {s.nameAr}
            <button type="button" onClick={() => handleDelete(s.id)} className="text-red-600 dark:text-red-400 hover:underline text-xs">
              حذف
            </button>
          </span>
        ))}
        {sections.length === 0 && <p className="text-sm text-slate-400">ما فيه شعب بعد -- أضف أول شعبة فوق</p>}
      </div>
    </div>
  );
}

function SubjectsTab({
  teachers,
  subjects,
  setSubjects,
  assignments,
  setAssignments,
  setError,
}: {
  teachers: Teacher[];
  subjects: Subject[];
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  assignments: Assignment[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  setError: (e: string) => void;
}) {
  const [newSubject, setNewSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  async function handleAddSubject() {
    if (!newSubject.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/schedule-builder/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameAr: newSubject.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubjects((prev) => [...prev, data.subject]);
      setNewSubject("");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الإضافة");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSubject(id: string) {
    if (!confirm("حذف هذه المادة؟")) return;
    const res = await fetch(`/api/schedule-builder/subjects/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "تعذّر الحذف");
      return;
    }
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    setAssignments((prev) => prev.filter((a) => a.subjectId !== id));
    setError("");
  }

  const teacherSubjectIds = useMemo(
    () => new Set(assignments.filter((a) => a.teacherId === selectedTeacherId).map((a) => a.subjectId)),
    [assignments, selectedTeacherId]
  );

  async function handleToggleTeacherSubject(subjectId: string) {
    if (!selectedTeacherId) return;
    const current = new Set(teacherSubjectIds);
    if (current.has(subjectId)) current.delete(subjectId);
    else current.add(subjectId);
    const nextIds = [...current];

    setAssignments((prev) => [
      ...prev.filter((a) => a.teacherId !== selectedTeacherId),
      ...nextIds.map((subjectId) => ({ teacherId: selectedTeacherId, subjectId })),
    ]);

    try {
      const res = await fetch("/api/schedule-builder/teacher-subjects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: selectedTeacherId, subjectIds: nextIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">المواد</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddSubject();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="اسم المادة (مثال: الرياضيات)"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
          <button
            type="submit"
            disabled={busy || !newSubject.trim()}
            className="shrink-0 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
          >
            إضافة
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-sm"
            >
              {s.nameAr}
              <button
                type="button"
                onClick={() => handleDeleteSubject(s.id)}
                className="text-red-600 dark:text-red-400 hover:underline text-xs"
              >
                حذف
              </button>
            </span>
          ))}
          {subjects.length === 0 && <p className="text-sm text-slate-400">ما فيه مواد بعد -- أضف أول مادة فوق</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">مواد كل معلم</h3>
        <select
          value={selectedTeacherId}
          onChange={(e) => setSelectedTeacherId(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        >
          <option value="">— اختر معلماً —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {selectedTeacherId && (
          <div className="flex flex-wrap gap-2 pt-1">
            {subjects.map((s) => {
              const active = teacherSubjectIds.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleToggleTeacherSubject(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                      : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {active ? "✓ " : ""}
                  {s.nameAr}
                </button>
              );
            })}
            {subjects.length === 0 && <p className="text-sm text-slate-400">أضف مواد أولاً</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const DAY_LABEL: Record<string, string> = {
  "": "كل الأيام",
};
const PERIOD_LABEL: Record<string, string> = {
  "": "كل الحصص",
};

function RequirementsTab({
  sections,
  subjects,
  teachers,
  assignments,
  requirements,
  setRequirements,
  setError,
}: {
  sections: Section[];
  subjects: Subject[];
  teachers: Teacher[];
  assignments: Assignment[];
  requirements: Requirement[];
  setRequirements: React.Dispatch<React.SetStateAction<Requirement[]>>;
  setError: (e: string) => void;
}) {
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [periodsPerWeek, setPeriodsPerWeek] = useState("5");
  const [busy, setBusy] = useState(false);

  const teachersForSubject = useMemo(
    () => teachers.filter((t) => assignments.some((a) => a.teacherId === t.id && a.subjectId === subjectId)),
    [teachers, assignments, subjectId]
  );

  const sectionRequirements = useMemo(
    () => requirements.filter((r) => r.sectionId === sectionId),
    [requirements, sectionId]
  );
  const totalPeriods = sectionRequirements.reduce((sum, r) => sum + r.periodsPerWeek, 0);

  async function handleAdd() {
    if (!sectionId || !subjectId || !teacherId || !periodsPerWeek) return;
    setBusy(true);
    try {
      const res = await fetch("/api/schedule-builder/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, subjectId, teacherId, periodsPerWeek: Number(periodsPerWeek) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequirements((prev) => [...prev.filter((r) => r.id !== data.requirement.id), data.requirement]);
      setSubjectId("");
      setTeacherId("");
      setPeriodsPerWeek("5");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/schedule-builder/requirements/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "تعذّر الحذف");
      return;
    }
    setRequirements((prev) => prev.filter((r) => r.id !== id));
    setError("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <select
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        >
          <option value="">— اختر شعبة —</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameAr}
            </option>
          ))}
        </select>

        {sectionId && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAdd();
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setTeacherId("");
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              >
                <option value="">— اختر مادة —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameAr}
                  </option>
                ))}
              </select>
              {subjectId && (
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                >
                  <option value="">— اختر معلماً —</option>
                  {teachersForSubject.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              {teacherId && (
                <input
                  type="number"
                  min={1}
                  max={35}
                  value={periodsPerWeek}
                  onChange={(e) => setPeriodsPerWeek(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  placeholder="حصص/أسبوع"
                />
              )}
              {teacherId && (
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
                >
                  حفظ
                </button>
              )}
            </form>
            {subjectId && teachersForSubject.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ما فيه معلم مسجّل لهذه المادة -- سجّله من تبويب &quot;المواد والمعلمين&quot;
              </p>
            )}

            <div className="flex flex-col gap-1 pt-2">
              {sectionRequirements.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm"
                >
                  <span>
                    {r.subjectName} -- {r.teacherName} -- {r.periodsPerWeek} حصة/أسبوع
                  </span>
                  <button type="button" onClick={() => handleDelete(r.id)} className="text-red-600 dark:text-red-400 hover:underline text-xs">
                    حذف
                  </button>
                </div>
              ))}
              {sectionRequirements.length === 0 && <p className="text-sm text-slate-400">ما فيه متطلبات لهذه الشعبة بعد</p>}
            </div>

            <p className={`text-xs ${totalPeriods > 35 ? "text-red-600 dark:text-red-400" : "text-slate-400"}`}>
              إجمالي الحصص المطلوبة لهذي الشعبة: {totalPeriods} / 35
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ConstraintsTab({
  teachers,
  constraints,
  setConstraints,
  setError,
}: {
  teachers: Teacher[];
  constraints: Constraint[];
  setConstraints: React.Dispatch<React.SetStateAction<Constraint[]>>;
  setError: (e: string) => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [day, setDay] = useState("");
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);

  const teacherConstraints = useMemo(() => constraints.filter((c) => c.teacherId === teacherId), [constraints, teacherId]);

  async function handleAdd() {
    if (!teacherId || (!day && !period)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/schedule-builder/constraints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, day: day || undefined, period: period || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConstraints((prev) => [...prev, data.constraint]);
      setDay("");
      setPeriod("");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/schedule-builder/constraints/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "تعذّر الحذف");
      return;
    }
    setConstraints((prev) => prev.filter((c) => c.id !== id));
    setError("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        >
          <option value="">— اختر معلماً —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {teacherId && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAdd();
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              >
                <option value="">كل الأيام</option>
                {SCHEDULE_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              >
                <option value="">كل الحصص</option>
                {SCHEDULE_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    الحصة {p}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy || (!day && !period)}
                className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
              >
                إضافة قيد
              </button>
            </form>
            {!day && !period && <p className="text-xs text-slate-400">حدد يومًا أو حصة (أو الاثنين) لتفعيل الإضافة</p>}

            <div className="flex flex-col gap-1 pt-2">
              {teacherConstraints.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm"
                >
                  <span>
                    {c.day ?? DAY_LABEL[""]}
                    {c.period ? ` -- الحصة ${c.period}` : ` -- ${PERIOD_LABEL[""]}`}
                  </span>
                  <button type="button" onClick={() => handleDelete(c.id)} className="text-red-600 dark:text-red-400 hover:underline text-xs">
                    حذف
                  </button>
                </div>
              ))}
              {teacherConstraints.length === 0 && <p className="text-sm text-slate-400">ما فيه قيود على هذا المعلم</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GridTab({
  teachers,
  subjects,
  sections,
  assignments,
  constraints,
  setError,
}: {
  teachers: Teacher[];
  subjects: Subject[];
  sections: Section[];
  assignments: Assignment[];
  constraints: Constraint[];
  setError: (e: string) => void;
}) {
  const [sectionId, setSectionId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(true);
  const [editingCell, setEditingCell] = useState<{ day: ScheduleDay; period: SchedulePeriod } | null>(null);
  const [pickTeacherId, setPickTeacherId] = useState("");
  const [pickSubjectId, setPickSubjectId] = useState("");
  const [printTeacherId, setPrintTeacherId] = useState("");
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [freeSlotKeys, setFreeSlotKeys] = useState<Set<string> | null>(null);
  const teacherSlotsCache = useRef<Map<string, Slot[]>>(new Map());
  const [conflictPopup, setConflictPopup] = useState<{
    message: string;
    slotId: string;
    day: ScheduleDay;
    period: SchedulePeriod;
    highlightKey: string | null;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    placedCount: number;
    unmetCount: number;
    unmet: { sectionName: string; subjectName: string; teacherName: string; missing: number }[];
  } | null>(null);

  const loadSlots = useCallback((secId: string) => {
    return fetch(`/api/schedule-builder/slots?sectionId=${secId}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoaded(true));
  }, []);

  useEffect(() => {
    if (!sectionId) return;
    loadSlots(sectionId);
  }, [sectionId, loadSlots]);

  const slotFor = useCallback(
    (day: ScheduleDay, period: SchedulePeriod) => slots.find((s) => s.day === day && s.period === period) ?? null,
    [slots]
  );

  const pickTeacherSubjects = useMemo(
    () => subjects.filter((s) => assignments.some((a) => a.teacherId === pickTeacherId && a.subjectId === s.id)),
    [subjects, assignments, pickTeacherId]
  );

  async function getTeacherSlots(teacherId: string): Promise<Slot[]> {
    const cached = teacherSlotsCache.current.get(teacherId);
    if (cached) return cached;
    const data = await fetch(`/api/schedule-builder/slots?teacherId=${teacherId}`).then((r) => r.json());
    const result: Slot[] = data.slots ?? [];
    teacherSlotsCache.current.set(teacherId, result);
    return result;
  }

  async function showFreeSlotsFor(slot: Slot) {
    const teacherSlots = await getTeacherSlots(slot.teacherId);
    setFreeSlotKeys(findFreeSlots(slots, teacherSlots, constraints, slot.teacherId, slot.id));
  }

  function openCell(day: ScheduleDay, period: SchedulePeriod) {
    const existing = slotFor(day, period);
    setEditingCell({ day, period });
    setPickTeacherId(existing?.teacherId ?? "");
    setPickSubjectId(existing?.subjectId ?? "");
  }

  async function handleSaveCell() {
    if (!editingCell || !pickTeacherId || !pickSubjectId) return;
    try {
      const res = await fetch("/api/schedule-builder/slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          day: editingCell.day,
          period: editingCell.period,
          teacherId: pickTeacherId,
          subjectId: pickSubjectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlots((prev) => [
        ...prev.filter((s) => !(s.day === editingCell.day && s.period === editingCell.period)),
        data.slot,
      ]);
      teacherSlotsCache.current.clear();
      setEditingCell(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    }
  }

  async function handleClearCell() {
    if (!editingCell) return;
    try {
      const res = await fetch("/api/schedule-builder/slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, day: editingCell.day, period: editingCell.period }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSlots((prev) => prev.filter((s) => !(s.day === editingCell.day && s.period === editingCell.period)));
      teacherSlotsCache.current.clear();
      setEditingCell(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحذف");
    }
  }

  async function handleMoveCell(slotId: string, destDay: ScheduleDay, destPeriod: SchedulePeriod, force = false) {
    const movingSlot = slots.find((s) => s.id === slotId);
    if (!force && movingSlot && movingSlot.day === destDay && movingSlot.period === destPeriod) return;
    try {
      const res = await fetch("/api/schedule-builder/slots/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, day: destDay, period: destPeriod, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.conflict) {
          const highlightKey = data.conflict.conflictSectionId === sectionId ? `${destDay}::${destPeriod}` : null;
          setConflictPopup({ message: data.error, slotId, day: destDay, period: destPeriod, highlightKey });
          if (highlightKey) {
            requestAnimationFrame(() => {
              document.querySelector(`[data-cell-key="${highlightKey}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
          }
          return;
        }
        throw new Error(data.error);
      }
      setSlots((prev) => {
        const next = prev.map((s) => (s.id === slotId ? data.slot : s));
        return data.removedConflict ? next.filter((s) => s.id !== data.removedConflict.conflictSlotId) : next;
      });
      teacherSlotsCache.current.clear();
      setConflictPopup(null);
      setFreeSlotKeys(null);
      setEditingCell(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر نقل الحصة");
    }
  }

  async function handleGenerate(clearFirst: boolean) {
    if (clearFirst && !confirm("هذا سيمسح الجدول الحالي بالكامل (كل الشعب) ويبنيه من جديد تلقائيًا -- متأكد؟")) return;
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch("/api/schedule-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearFirst }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGenerateResult(data);
      setError("");
      if (sectionId) await loadSlots(sectionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر توليد الجدول");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">توليد الجدول تلقائيًا</h3>
        <p className="text-xs text-slate-500">
          يبني الجدول لكل الشعب حسب المتطلبات والقيود المسجّلة، بدون تعارض بين المعلمين.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={generating}
            className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
          >
            {generating ? "جارٍ التوليد..." : "توليد المتبقي فقط"}
          </button>
          <button
            type="button"
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            مسح الجدول كامل وتوليده من جديد
          </button>
        </div>
        {generateResult && (
          <div className="text-sm pt-2">
            <p className="text-emerald-600 dark:text-emerald-400">تم وضع {generateResult.placedCount} حصة بنجاح.</p>
            {generateResult.unmetCount > 0 && (
              <div className="text-amber-600 dark:text-amber-400 pt-1">
                <p>{generateResult.unmetCount} حصة تعذّر وضعها (تعارض أوقات أو قيود):</p>
                <ul className="list-disc pr-5">
                  {generateResult.unmet.map((u, i) => (
                    <li key={i}>
                      {u.sectionName} -- {u.subjectName} -- {u.teacherName}: نقص {u.missing} حصة
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sectionId}
          onChange={(e) => {
            setSectionId(e.target.value);
            setSlotsLoaded(false);
            setEditingCell(null);
          }}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        >
          <option value="">— اختر شعبة —</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameAr}
            </option>
          ))}
        </select>
        {sectionId && (
          <a
            href={`/admin/schedule-builder/print-section?sectionId=${sectionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            طباعة جدول الشعبة
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={printTeacherId}
          onChange={(e) => setPrintTeacherId(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        >
          <option value="">— اختر معلماً لطباعة جدوله —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {printTeacherId && (
          <a
            href={`/admin/schedule-builder/print-teacher?teacherId=${printTeacherId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            طباعة جدول المعلم
          </a>
        )}
        <a
          href="/admin/schedule-builder/print-all"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          طباعة الجدول العام (كل المعلمين)
        </a>
      </div>

      {!sectionId ? (
        <p className="text-sm text-slate-400 text-center py-6">اختر شعبة لعرض جدولها</p>
      ) : !slotsLoaded ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
          جارٍ التحميل...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-sm text-center">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="p-2"></th>
                {SCHEDULE_PERIODS.map((p) => (
                  <th key={p} className="p-2 text-slate-600 dark:text-slate-300">
                    الحصة {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCHEDULE_DAYS.map((day) => (
                <tr key={day} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="p-2 font-medium text-slate-700 dark:text-slate-200">{day}</td>
                  {SCHEDULE_PERIODS.map((period) => {
                    const slot = slotFor(day, period);
                    const cellKey = `${day}::${period}`;
                    const isDragging = !!slot && draggingSlotId === slot.id;
                    const isDragOverTarget = dragOverKey === cellKey;
                    const isConflictHighlight = conflictPopup?.highlightKey === cellKey;
                    const isFreeSuggestion = !slot && freeSlotKeys?.has(cellKey);
                    return (
                      <td key={period} className="p-1">
                        <button
                          type="button"
                          data-cell-key={cellKey}
                          onClick={() => openCell(day, period)}
                          draggable={!!slot}
                          onDragStart={(e) => {
                            if (!slot) return;
                            e.dataTransfer.setData("text/plain", slot.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingSlotId(slot.id);
                            showFreeSlotsFor(slot);
                          }}
                          onDragEnd={() => {
                            setDraggingSlotId(null);
                            setDragOverKey(null);
                            setFreeSlotKeys(null);
                          }}
                          onDragEnter={() => setDragOverKey(cellKey)}
                          onDragLeave={() => setDragOverKey((prev) => (prev === cellKey ? null : prev))}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const slotId = e.dataTransfer.getData("text/plain");
                            setDraggingSlotId(null);
                            setDragOverKey(null);
                            setFreeSlotKeys(null);
                            if (!slotId) return;
                            handleMoveCell(slotId, day, period);
                          }}
                          className={`w-full rounded-lg border px-2 py-2 text-xs transition-colors ${
                            isConflictHighlight
                              ? "animate-pulse ring-4 ring-red-500"
                              : isDragOverTarget
                                ? "border-amber-400 bg-amber-400/20 ring-2 ring-amber-400"
                                : isFreeSuggestion
                                  ? "border-emerald-400 bg-emerald-400/20 ring-2 ring-emerald-400"
                                  : slot
                                    ? "cursor-grab border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/10 text-slate-800 dark:text-slate-100"
                                    : "border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          } ${isDragging ? "opacity-30" : ""}`}
                        >
                          {slot ? (
                            <>
                              <div className="font-medium">{slot.teacherName}</div>
                              <div className="text-slate-500">{slot.subjectName}</div>
                            </>
                          ) : (
                            "+"
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingCell && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">
            {editingCell.day} -- الحصة {editingCell.period}
          </h3>
          <select
            value={pickTeacherId}
            onChange={(e) => {
              setPickTeacherId(e.target.value);
              setPickSubjectId("");
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          >
            <option value="">— اختر معلماً —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {pickTeacherId && (
            <select
              value={pickSubjectId}
              onChange={(e) => setPickSubjectId(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            >
              <option value="">— اختر مادة —</option>
              {pickTeacherSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameAr}
                </option>
              ))}
            </select>
          )}
          {pickTeacherId && pickTeacherSubjects.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              هذا المعلم ما له مواد مسجّلة -- أضف له مادة من تبويب &quot;المواد والمعلمين&quot;
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveCell}
              disabled={!pickTeacherId || !pickSubjectId}
              className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
            >
              حفظ
            </button>
            {slotFor(editingCell.day, editingCell.period) && (
              <>
                <button
                  type="button"
                  onClick={handleClearCell}
                  className="rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  إفراغ الخانة
                </button>
                <button
                  type="button"
                  onClick={() => showFreeSlotsFor(slotFor(editingCell.day, editingCell.period)!)}
                  className="rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm px-4 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  وين أقدر أنقلها؟
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingCell(null);
                setFreeSlotKeys(null);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
          </div>
          {freeSlotKeys && (
            <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              {freeSlotKeys.size === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">ما فيه أي مكان فاضٍ لنقل هذي الحصة -- الأسبوع مليان لهذا المعلم أو الشعبة.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">الأماكن الفاضية (مضيئة بالأخضر بالجدول فوق) -- اضغط عشان تنقل مباشرة:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SCHEDULE_DAYS.flatMap((day) =>
                      SCHEDULE_PERIODS.filter((period) => freeSlotKeys.has(`${day}::${period}`)).map((period) => (
                        <button
                          key={`${day}-${period}`}
                          type="button"
                          onClick={() => handleMoveCell(slotFor(editingCell.day, editingCell.period)!.id, day, period)}
                          className="rounded-full border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        >
                          {day} -- {period}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {conflictPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConflictPopup(null)}
        >
          <div
            className="mx-4 flex max-w-sm flex-col gap-3 rounded-xl border border-red-200 bg-white p-5 dark:border-red-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-red-600 dark:text-red-400">يوجد تعارض</h3>
            <p className="text-sm text-slate-700 dark:text-slate-200">{conflictPopup.message}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleMoveCell(conflictPopup.slotId, conflictPopup.day, conflictPopup.period, true)}
                className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 transition-colors"
              >
                إزالة التعارض ووضع الحصة هنا
              </button>
              <button
                type="button"
                onClick={() => setConflictPopup(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Every teacher as its own row, every (day, period) as a column -- an overview of the whole
 *  school at once, matching the "الجدول العام" master-grid view. A filled cell can be dragged to
 *  another column in the SAME row to reschedule that teacher's lesson (their section/subject stay
 *  the same, only the time changes); dropping is refused with an alert if the destination is
 *  already taken. Dragging a cell onto a different teacher's row is rejected client-side, since a
 *  drag here can only move a lesson's time, not hand it to another teacher. */
function MasterGridTab({
  teachers,
  subjects,
  sections,
  assignments,
  constraints,
  setError,
}: {
  teachers: Teacher[];
  subjects: Subject[];
  sections: Section[];
  assignments: Assignment[];
  constraints: Constraint[];
  setError: (e: string) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingCell, setEditingCell] = useState<{ teacherId: string; day: ScheduleDay; period: SchedulePeriod } | null>(
    null
  );
  const [pickSectionId, setPickSectionId] = useState("");
  const [pickSubjectId, setPickSubjectId] = useState("");
  const [draggingSlot, setDraggingSlot] = useState<{ id: string; teacherId: string } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [freeSlotKeys, setFreeSlotKeys] = useState<Set<string> | null>(null);
  const [conflictPopup, setConflictPopup] = useState<{
    message: string;
    slotId: string;
    teacherId: string;
    day: ScheduleDay;
    period: SchedulePeriod;
    highlightKey: string | null;
  } | null>(null);

  const loadAllSlots = useCallback(() => {
    return fetch("/api/schedule-builder/slots?all=true")
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    loadAllSlots();
  }, [loadAllSlots]);

  const sortedTeachers = useMemo(() => [...teachers].sort((a, b) => a.name.localeCompare(b.name, "ar")), [teachers]);
  const sectionNameById = useMemo(() => new Map(sections.map((s) => [s.id, s.nameAr])), [sections]);
  const sectionColorById = useMemo(() => new Map(sections.map((s) => [s.id, sectionColor(s.sortOrder)])), [sections]);

  function scrollToCell(key: string) {
    requestAnimationFrame(() => {
      document.querySelector(`[data-cell-key="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
  }

  const slotFor = useCallback(
    (teacherId: string, day: ScheduleDay, period: SchedulePeriod) =>
      slots.find((s) => s.teacherId === teacherId && s.day === day && s.period === period) ?? null,
    [slots]
  );

  function showFreeSlotsFor(slot: Slot) {
    const sectionSlots = slots.filter((s) => s.sectionId === slot.sectionId);
    const teacherSlots = slots.filter((s) => s.teacherId === slot.teacherId);
    setFreeSlotKeys(findFreeSlots(sectionSlots, teacherSlots, constraints, slot.teacherId, slot.id));
  }

  const pickTeacherSubjects = useMemo(
    () =>
      editingCell
        ? subjects.filter((s) => assignments.some((a) => a.teacherId === editingCell.teacherId && a.subjectId === s.id))
        : [],
    [subjects, assignments, editingCell]
  );

  function openCell(teacherId: string, day: ScheduleDay, period: SchedulePeriod) {
    const existing = slotFor(teacherId, day, period);
    setEditingCell({ teacherId, day, period });
    setPickSectionId(existing?.sectionId ?? "");
    setPickSubjectId(existing?.subjectId ?? "");
  }

  async function handleSaveCell() {
    if (!editingCell || !pickSectionId || !pickSubjectId) return;
    try {
      const res = await fetch("/api/schedule-builder/slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: pickSectionId,
          day: editingCell.day,
          period: editingCell.period,
          teacherId: editingCell.teacherId,
          subjectId: pickSubjectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlots((prev) => [
        ...prev.filter(
          (s) =>
            !(s.teacherId === editingCell.teacherId && s.day === editingCell.day && s.period === editingCell.period) &&
            !(s.sectionId === pickSectionId && s.day === editingCell.day && s.period === editingCell.period)
        ),
        data.slot,
      ]);
      setEditingCell(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    }
  }

  async function handleClearCell() {
    if (!editingCell) return;
    const existing = slotFor(editingCell.teacherId, editingCell.day, editingCell.period);
    if (!existing) {
      setEditingCell(null);
      return;
    }
    try {
      const res = await fetch("/api/schedule-builder/slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: existing.sectionId, day: editingCell.day, period: editingCell.period }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSlots((prev) => prev.filter((s) => s.id !== existing.id));
      setEditingCell(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحذف");
    }
  }

  async function handleMoveCell(
    slotId: string,
    destTeacherId: string,
    destDay: ScheduleDay,
    destPeriod: SchedulePeriod,
    force = false
  ) {
    const movingSlot = slots.find((s) => s.id === slotId);
    if (movingSlot && movingSlot.teacherId !== destTeacherId) {
      setError("ما يمكن نقل حصة لمعلم آخر بالسحب -- هذا يغيّر مالك الحصة، عدّلها من الخانة نفسها بدل السحب");
      return;
    }
    if (!force && movingSlot && movingSlot.day === destDay && movingSlot.period === destPeriod) return;
    try {
      const res = await fetch("/api/schedule-builder/slots/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, day: destDay, period: destPeriod, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.conflict) {
          const highlightKey = data.conflict.conflictTeacherId
            ? `${data.conflict.conflictTeacherId}::${destDay}::${destPeriod}`
            : `${destTeacherId}::${destDay}::${destPeriod}`;
          setConflictPopup({ message: data.error, slotId, teacherId: destTeacherId, day: destDay, period: destPeriod, highlightKey });
          scrollToCell(highlightKey);
          return;
        }
        throw new Error(data.error);
      }
      setSlots((prev) => {
        const next = prev.map((s) => (s.id === slotId ? data.slot : s));
        return data.removedConflict ? next.filter((s) => s.id !== data.removedConflict.conflictSlotId) : next;
      });
      setConflictPopup(null);
      setFreeSlotKeys(null);
      setEditingCell(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر نقل الحصة");
    }
  }

  const freeSlotTeacherId = draggingSlot?.teacherId ?? editingCell?.teacherId ?? null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-500">
        كل معلم بصف مستقل -- اضغط خانة فاضية لتسجيل حصة، أو اسحب حصة موجودة لخانة ثانية بنفس صف المعلم لتغيير وقتها.
      </p>

      {!loaded ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
          جارٍ التحميل...
        </div>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full min-w-[1350px] text-[11px] text-center border-collapse">
            <thead>
              <tr className="h-8 border-b border-slate-200 dark:border-slate-800">
                <th className="sticky right-0 top-0 z-30 h-8 bg-white p-1 dark:bg-slate-900"></th>
                {SCHEDULE_DAYS.map((day) => (
                  <th
                    key={day}
                    colSpan={SCHEDULE_PERIODS.length}
                    className="sticky top-0 z-20 h-8 bg-white p-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {day}
                  </th>
                ))}
              </tr>
              <tr className="h-7 border-b border-slate-200 dark:border-slate-800">
                <th className="sticky right-0 top-8 z-30 h-7 bg-white p-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  المعلم
                </th>
                {SCHEDULE_DAYS.map((day) =>
                  SCHEDULE_PERIODS.map((period) => (
                    <th
                      key={`${day}-${period}`}
                      className="sticky top-8 z-20 h-7 bg-white p-1 text-slate-500 dark:bg-slate-900"
                    >
                      {period}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {sortedTeachers.map((teacher) => (
                <tr key={teacher.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="sticky right-0 z-10 bg-white p-1 font-medium text-slate-700 whitespace-nowrap dark:bg-slate-900 dark:text-slate-200">
                    {teacher.name}
                  </td>
                  {SCHEDULE_DAYS.map((day) =>
                    SCHEDULE_PERIODS.map((period) => {
                      const slot = slotFor(teacher.id, day, period);
                      const cellKey = `${teacher.id}::${day}::${period}`;
                      const isDragging = draggingSlot?.id === slot?.id && !!slot;
                      const isDragOverTarget = dragOverKey === cellKey && draggingSlot?.teacherId === teacher.id;
                      const isConflictHighlight = conflictPopup?.highlightKey === cellKey;
                      const isFreeSuggestion =
                        !slot && teacher.id === freeSlotTeacherId && freeSlotKeys?.has(`${day}::${period}`);
                      const bgColor = slot ? sectionColorById.get(slot.sectionId) : undefined;
                      return (
                        <td key={`${day}-${period}`} className="p-0.5">
                          <button
                            type="button"
                            data-cell-key={cellKey}
                            onClick={() => openCell(teacher.id, day, period)}
                            draggable={!!slot}
                            onDragStart={(e) => {
                              if (!slot) return;
                              e.dataTransfer.setData("text/plain", slot.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingSlot({ id: slot.id, teacherId: teacher.id });
                              showFreeSlotsFor(slot);
                            }}
                            onDragEnd={() => {
                              setDraggingSlot(null);
                              setDragOverKey(null);
                              setFreeSlotKeys(null);
                            }}
                            onDragEnter={() => {
                              if (draggingSlot?.teacherId === teacher.id) setDragOverKey(cellKey);
                            }}
                            onDragLeave={() => {
                              setDragOverKey((prev) => (prev === cellKey ? null : prev));
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const slotId = e.dataTransfer.getData("text/plain");
                              setDraggingSlot(null);
                              setDragOverKey(null);
                              setFreeSlotKeys(null);
                              if (!slotId) return;
                              handleMoveCell(slotId, teacher.id, day, period);
                            }}
                            style={bgColor ? { backgroundColor: bgColor, borderColor: bgColor } : undefined}
                            className={`w-full min-w-[36px] rounded border px-0.5 py-1.5 font-medium transition-colors ${
                              isConflictHighlight
                                ? "animate-pulse ring-4 ring-red-500"
                                : isDragOverTarget
                                  ? "border-amber-400 bg-amber-400/20 ring-2 ring-amber-400"
                                  : isFreeSuggestion
                                    ? "border-emerald-400 bg-emerald-400/20 ring-2 ring-emerald-400"
                                    : slot
                                      ? "cursor-grab text-slate-900"
                                      : "border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            } ${isDragging ? "opacity-30" : ""}`}
                          >
                            {slot ? sectionNameById.get(slot.sectionId) ?? "" : "+"}
                          </button>
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
              {sortedTeachers.length === 0 && (
                <tr>
                  <td colSpan={SCHEDULE_DAYS.length * SCHEDULE_PERIODS.length + 1} className="p-4 text-center text-sm text-slate-400">
                    ما فيه معلمين
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingCell && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">
            {teachers.find((t) => t.id === editingCell.teacherId)?.name} -- {editingCell.day} -- الحصة {editingCell.period}
          </h3>
          <select
            value={pickSectionId}
            onChange={(e) => setPickSectionId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          >
            <option value="">— اختر شعبة —</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
          <select
            value={pickSubjectId}
            onChange={(e) => setPickSubjectId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          >
            <option value="">— اختر مادة —</option>
            {pickTeacherSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
          {pickTeacherSubjects.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              هذا المعلم ما له مواد مسجّلة -- أضف له مادة من تبويب &quot;المواد والمعلمين&quot;
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveCell}
              disabled={!pickSectionId || !pickSubjectId}
              className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
            >
              حفظ
            </button>
            {slotFor(editingCell.teacherId, editingCell.day, editingCell.period) && (
              <>
                <button
                  type="button"
                  onClick={handleClearCell}
                  className="rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  إفراغ الخانة
                </button>
                <button
                  type="button"
                  onClick={() => showFreeSlotsFor(slotFor(editingCell.teacherId, editingCell.day, editingCell.period)!)}
                  className="rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm px-4 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  وين أقدر أنقلها؟
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingCell(null);
                setFreeSlotKeys(null);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
          </div>
          {freeSlotKeys && (
            <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              {freeSlotKeys.size === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">ما فيه أي مكان فاضٍ لنقل هذي الحصة -- الأسبوع مليان لهذا المعلم أو الشعبة.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">الأماكن الفاضية (مضيئة بالأخضر بالجدول فوق) -- اضغط عشان تنقل مباشرة:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SCHEDULE_DAYS.flatMap((day) =>
                      SCHEDULE_PERIODS.filter((period) => freeSlotKeys.has(`${day}::${period}`)).map((period) => (
                        <button
                          key={`${day}-${period}`}
                          type="button"
                          onClick={() =>
                            handleMoveCell(
                              slotFor(editingCell.teacherId, editingCell.day, editingCell.period)!.id,
                              editingCell.teacherId,
                              day,
                              period
                            )
                          }
                          className="rounded-full border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        >
                          {day} -- {period}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {conflictPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConflictPopup(null)}
        >
          <div
            className="mx-4 flex max-w-sm flex-col gap-3 rounded-xl border border-red-200 bg-white p-5 dark:border-red-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-red-600 dark:text-red-400">يوجد تعارض</h3>
            <p className="text-sm text-slate-700 dark:text-slate-200">{conflictPopup.message}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  handleMoveCell(conflictPopup.slotId, conflictPopup.teacherId, conflictPopup.day, conflictPopup.period, true)
                }
                className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 transition-colors"
              >
                إزالة التعارض ووضع الحصة هنا
              </button>
              <button
                type="button"
                onClick={() => setConflictPopup(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
