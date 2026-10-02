"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REFERRAL_REASONS, type ReferralStatus } from "@/lib/student-referral-constants";
import { ReferralStatusBadge } from "./ReferralStatusBadge";

export interface TeacherReferralItem {
  id: string;
  studentName: string;
  className: string;
  subject: string;
  reasons: string[];
  problemDescription: string | null;
  status: ReferralStatus;
  createdAt: string;
}

interface FormState {
  studentName: string;
  className: string;
  subject: string;
  reasons: string[];
  problemDescription: string;
}

const BLANK_FORM: FormState = { studentName: "", className: "", subject: "", reasons: [], problemDescription: "" };

const INPUT_CLASS =
  "rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]";

export function TeacherReferralSection({
  referrals,
  teacherName,
  readOnly,
}: {
  referrals: TeacherReferralItem[];
  teacherName: string;
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

  function openEdit(r: TeacherReferralItem) {
    setForm({
      studentName: r.studentName,
      className: r.className,
      subject: r.subject,
      reasons: r.reasons,
      problemDescription: r.problemDescription ?? "",
    });
    setError("");
    setEditingId(r.id);
  }

  function toggleReason(reason: string) {
    setForm((prev) => ({
      ...prev,
      reasons: prev.reasons.includes(reason) ? prev.reasons.filter((r) => r !== reason) : [...prev.reasons, reason],
    }));
  }

  async function handleSave() {
    if (!form.studentName.trim() || !form.className.trim() || !form.subject.trim()) {
      setError("عبّي اسم الطالب والصف والمادة");
      return;
    }
    if (form.reasons.length === 0) {
      setError("اختر سبب التحويل");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res =
        editingId === "new"
          ? await fetch("/api/student-referrals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form),
            })
          : await fetch(`/api/student-referrals/${editingId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form),
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

  async function handleSend(r: TeacherReferralItem) {
    if (!confirm(`إرسال تحويل الطالب "${r.studentName}" لوكيل شؤون الطلاب؟ ما راح تقدر تعدّله بعد الإرسال.`)) return;
    const res = await fetch(`/api/student-referrals/${r.id}/send`, { method: "POST" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "تعذّر الإرسال");
    router.refresh();
  }

  async function handleDelete(r: TeacherReferralItem) {
    if (!confirm(`حذف مسودة تحويل الطالب "${r.studentName}"؟`)) return;
    const res = await fetch(`/api/student-referrals/${r.id}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "تعذّر الحذف");
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
          + تحويل طالب جديد
        </button>
      )}

      {editingId !== null && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h4 className="font-bold text-slate-800 dark:text-slate-100">
            {editingId === "new" ? "نموذج تحويل طالب لوكيل شؤون الطلاب" : "تعديل نموذج التحويل"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={form.studentName}
              onChange={(e) => setForm((p) => ({ ...p, studentName: e.target.value }))}
              placeholder="اسم الطالب"
              className={INPUT_CLASS}
            />
            <input
              type="text"
              value={form.className}
              onChange={(e) => setForm((p) => ({ ...p, className: e.target.value }))}
              placeholder="الصف"
              className={INPUT_CLASS}
            />
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="المادة"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1.5">سبب التحويل</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {REFERRAL_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={form.reasons.includes(reason)} onChange={() => toggleReason(reason)} />
                  {reason}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1.5">إيضاح المشكلة</p>
            <textarea
              value={form.problemDescription}
              onChange={(e) => setForm((p) => ({ ...p, problemDescription: e.target.value }))}
              rows={4}
              className={`w-full ${INPUT_CLASS}`}
            />
          </div>

          <p className="text-xs text-slate-500">اسم المعلم: {teacherName}</p>

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

      {editingId === null && error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-2">
        {referrals.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {r.studentName} -- {r.className} -- {r.subject}
              </span>
              <ReferralStatusBadge status={r.status} />
            </div>
            <p className="text-xs text-slate-500">
              {r.reasons.join("، ")} -- {new Date(r.createdAt).toLocaleDateString("ar-SA")}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <a
                href={`/student-referrals/${r.id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--brand-primary)] hover:underline"
              >
                طباعة
              </a>
              {!readOnly && r.status === "draft" && (
                <>
                  <button type="button" onClick={() => handleSend(r)} className="font-medium text-[var(--brand-primary)] hover:underline">
                    إرسال لوكيل شؤون الطلاب
                  </button>
                  <button type="button" onClick={() => openEdit(r)} className="text-slate-600 dark:text-slate-300 hover:underline">
                    تعديل
                  </button>
                  <button type="button" onClick={() => handleDelete(r)} className="text-red-600 dark:text-red-400 hover:underline">
                    حذف
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {referrals.length === 0 && <p className="text-sm text-slate-400">ما فيه أي تحويلات بعد</p>}
      </div>
    </div>
  );
}
