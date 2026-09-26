"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ImpactMeasurementEntry {
  id: string;
  subject: string;
  studentName: string;
  className: string;
  maxScore: number;
  scoreBefore: number;
  scoreAfter: number;
  improvementLevel: string;
  teacherNotes: string | null;
  recommendations: string[];
  createdAt: string;
}

const IMPROVEMENT_LEVELS = ["كبير", "متوسط", "بسيط", "لم يتحسن"];
const RECOMMENDATIONS = ["تحقق الهدف", "يحتاج إلى متابعة", "يحتاج إلى خطة علاجية إضافية"];

interface FormState {
  subject: string;
  studentName: string;
  className: string;
  maxScore: string;
  scoreBefore: string;
  scoreAfter: string;
  improvementLevel: string;
  teacherNotes: string;
  recommendations: string[];
}

const BLANK_FORM: FormState = {
  subject: "",
  studentName: "",
  className: "",
  maxScore: "10",
  scoreBefore: "",
  scoreAfter: "",
  improvementLevel: "",
  teacherNotes: "",
  recommendations: [],
};

export function ImpactMeasurementSection({
  entries,
  readOnly,
}: {
  entries: ImpactMeasurementEntry[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function openNew() {
    setForm(BLANK_FORM);
    setError("");
    setEditingId("new");
  }

  function openEdit(entry: ImpactMeasurementEntry) {
    setForm({
      subject: entry.subject,
      studentName: entry.studentName,
      className: entry.className,
      maxScore: String(entry.maxScore),
      scoreBefore: String(entry.scoreBefore),
      scoreAfter: String(entry.scoreAfter),
      improvementLevel: entry.improvementLevel,
      teacherNotes: entry.teacherNotes ?? "",
      recommendations: entry.recommendations,
    });
    setError("");
    setEditingId(entry.id);
  }

  function toggleRecommendation(rec: string) {
    setForm((prev) => ({
      ...prev,
      recommendations: prev.recommendations.includes(rec)
        ? prev.recommendations.filter((r) => r !== rec)
        : [...prev.recommendations, rec],
    }));
  }

  async function handleSave() {
    if (!form.subject || !form.studentName || !form.className || !form.improvementLevel || form.scoreBefore === "" || form.scoreAfter === "") {
      setError("عبّي كل الحقول المطلوبة");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        subject: form.subject,
        studentName: form.studentName,
        className: form.className,
        maxScore: Number(form.maxScore) || 10,
        scoreBefore: Number(form.scoreBefore),
        scoreAfter: Number(form.scoreAfter),
        improvementLevel: form.improvementLevel,
        teacherNotes: form.teacherNotes,
        recommendations: form.recommendations,
      };
      const res =
        editingId === "new"
          ? await fetch("/api/impact-measurements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/impact-measurements/${editingId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف قياس الأثر هذا؟")) return;
    await fetch(`/api/impact-measurements/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && editingId === null && (
        <button
          type="button"
          onClick={openNew}
          className="self-start rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors"
        >
          + إضافة قياس أثر جديد
        </button>
      )}

      {editingId !== null && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h4 className="font-bold text-slate-800 dark:text-slate-100">
            {editingId === "new" ? "قياس أثر جديد" : "تعديل قياس الأثر"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="المادة"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
            <input
              type="text"
              value={form.studentName}
              onChange={(e) => setForm((p) => ({ ...p, studentName: e.target.value }))}
              placeholder="اسم الطالب"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
            <input
              type="text"
              value={form.className}
              onChange={(e) => setForm((p) => ({ ...p, className: e.target.value }))}
              placeholder="الصف"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 shrink-0">الدرجة من</label>
              <input
                type="number"
                min={1}
                value={form.maxScore}
                onChange={(e) => setForm((p) => ({ ...p, maxScore: e.target.value }))}
                className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 shrink-0">الدرجة قبل الخطة العلاجية</label>
              <input
                type="number"
                min={0}
                value={form.scoreBefore}
                onChange={(e) => setForm((p) => ({ ...p, scoreBefore: e.target.value }))}
                className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 shrink-0">الدرجة بعد الخطة العلاجية</label>
              <input
                type="number"
                min={0}
                value={form.scoreAfter}
                onChange={(e) => setForm((p) => ({ ...p, scoreAfter: e.target.value }))}
                className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1.5">مستوى التحسن</p>
            <div className="flex flex-wrap gap-2">
              {IMPROVEMENT_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, improvementLevel: level }))}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    form.improvementLevel === level
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                      : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1.5">ملاحظات المعلم</p>
            <textarea
              value={form.teacherNotes}
              onChange={(e) => setForm((p) => ({ ...p, teacherNotes: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1.5">التوصية</p>
            <div className="flex flex-col gap-1.5">
              {RECOMMENDATIONS.map((rec) => (
                <label key={rec} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.recommendations.includes(rec)}
                    onChange={() => toggleRecommendation(rec)}
                  />
                  {rec}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-col gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {entry.studentName} -- {entry.className} -- {entry.subject}
              </span>
              <span className="rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 text-xs">
                {entry.improvementLevel}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              الدرجة: {entry.scoreBefore}/{entry.maxScore} ← {entry.scoreAfter}/{entry.maxScore}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <a
                href={`/impact-measurements/${entry.id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--brand-primary)] hover:underline"
              >
                طباعة
              </a>
              {!readOnly && (
                <>
                  <button type="button" onClick={() => openEdit(entry)} className="text-slate-600 dark:text-slate-300 hover:underline">
                    تعديل
                  </button>
                  <button type="button" onClick={() => handleDelete(entry.id)} className="text-red-600 dark:text-red-400 hover:underline">
                    حذف
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-slate-400">ما فيه أي قياس أثر مسجّل بعد</p>}
      </div>
    </div>
  );
}
