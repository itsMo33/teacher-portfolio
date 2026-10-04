"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VIOLATIONS } from "@/lib/student-referral-constants";

const INPUT_CLASS =
  "rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]";

export interface ViolationFormValues {
  studentName: string;
  className: string;
  violations: string[];
  problemDescription: string;
}

/** The وكيل شؤون الطلاب's own form: a student violation filed without a teacher. Saving it puts the
 *  referral straight in his hands, where he fills his procedures and forwards it to a counselor. */
export function ViolationReferralForm({
  referralId,
  initial,
  classOptions,
}: {
  /** Set when editing an existing violation; omitted when filing a new one. */
  referralId?: string;
  initial: ViolationFormValues;
  classOptions: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<ViolationFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(v: string) {
    setForm((p) => ({ ...p, violations: p.violations.includes(v) ? p.violations.filter((x) => x !== v) : [...p.violations, v] }));
  }

  async function handleSave() {
    if (!form.studentName.trim() || !form.className) return setError("عبّي اسم الطالب واختر الصف");
    if (form.violations.length === 0) return setError("اختر مخالفة واحدة على الأقل");
    setBusy(true);
    setError("");
    try {
      const res = referralId
        ? await fetch(`/api/student-referrals/${referralId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ form }),
          })
        : await fetch("/api/student-referrals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/admin/student-referrals/${referralId ?? data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          value={form.studentName}
          onChange={(e) => setForm((p) => ({ ...p, studentName: e.target.value }))}
          placeholder="اسم الطالب"
          className={INPUT_CLASS}
        />
        <select value={form.className} onChange={(e) => setForm((p) => ({ ...p, className: e.target.value }))} className={INPUT_CLASS}>
          <option value="">— اختر الصف —</option>
          {classOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1.5">المخالفة (يمكن اختيار أكثر من واحدة)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
          {VIOLATIONS.map((v) => (
            <label key={v} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" className="mt-1" checked={form.violations.includes(v)} onChange={() => toggle(v)} />
              {v}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1.5">إيضاح (اختياري)</p>
        <textarea
          value={form.problemDescription}
          onChange={(e) => setForm((p) => ({ ...p, problemDescription: e.target.value }))}
          rows={3}
          className={`w-full ${INPUT_CLASS}`}
        />
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
        >
          {referralId ? "حفظ التعديل" : "حفظ والمتابعة للإجراءات"}
        </button>
      </div>
    </div>
  );
}
