"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";
import { SchoolFileList, type SchoolFileItem } from "@/components/admin/SchoolFileList";

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]";

/** One stage's form (وكيل شؤون الطلاب or الموجه الطلابي): a numbered procedure checklist mirroring
 *  the paper table, a notes box, and the "الإجراءات" attachments. Read-only once the referral has
 *  moved on (or for anyone but the stage's own role). */
export function ReferralStageForm({
  kind,
  referralId,
  title,
  notesLabel,
  procedures,
  initialSelected,
  initialNotes,
  initialExtraServices,
  editable,
  files,
}: {
  kind: "agent" | "counselor";
  referralId: string;
  title: string;
  notesLabel: string;
  procedures: { n: number; text: string }[];
  initialSelected: number[];
  initialNotes: string;
  initialExtraServices?: string;
  editable: boolean;
  files: SchoolFileItem[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>(initialSelected);
  const [notes, setNotes] = useState(initialNotes);
  const [extraServices, setExtraServices] = useState(initialExtraServices ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function toggle(n: number) {
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function save(): Promise<boolean> {
    const body =
      kind === "agent" ? { procedures: selected, notes } : { procedures: selected, extraServices, notes };
    const res = await fetch(`/api/student-referrals/${referralId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMessage({ text: (await res.json().catch(() => ({}))).error ?? "تعذّر الحفظ", ok: false });
      return false;
    }
    return true;
  }

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    if (await save()) setMessage({ text: "تم الحفظ", ok: true });
    setBusy(false);
  }

  async function handleForward() {
    if (!confirm("تحويل النموذج للموجه الطلابي؟ ما راح تقدر تعدّل عليه بعد التحويل.")) return;
    setBusy(true);
    setMessage(null);
    if (await save()) {
      const res = await fetch(`/api/student-referrals/${referralId}/send`, { method: "POST" });
      if (!res.ok) {
        setMessage({ text: (await res.json().catch(() => ({}))).error ?? "تعذّر التحويل", ok: false });
      } else {
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {procedures.map((p) => (
          <label key={p.n} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={selected.includes(p.n)}
              disabled={!editable}
              onChange={() => toggle(p.n)}
              className="mt-1"
            />
            <span>
              <span className="text-slate-400">{p.n}.</span> {p.text}
            </span>
          </label>
        ))}
      </div>

      {kind === "counselor" && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">خدمات إضافية من الموجه الطلابي</p>
          <textarea
            value={extraServices}
            onChange={(e) => setExtraServices(e.target.value)}
            disabled={!editable}
            rows={2}
            className={INPUT_CLASS}
          />
        </div>
      )}

      <div>
        <p className="text-xs text-slate-500 mb-1.5">{notesLabel}</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} rows={3} className={INPUT_CLASS} />
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">الإجراءات (ملفات أو صور مرفقة)</h4>
        {editable && <FileUploadDropzone uploadUrl="/api/student-referrals/files" extraFields={{ referralId }} />}
        <SchoolFileList
          files={files}
          canDelete={editable}
          deleteUrl="/api/student-referrals/files/delete"
          confirmDelete
        />
      </div>

      {message && (
        <p className={`text-xs ${message.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
          >
            حفظ
          </button>
          {kind === "agent" && (
            <button
              type="button"
              onClick={handleForward}
              disabled={busy}
              className="rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] text-sm px-4 py-2 hover:bg-[var(--brand-primary)]/10 transition-colors disabled:opacity-50"
            >
              حفظ وتحويل للموجه الطلابي
            </button>
          )}
        </div>
      )}
    </section>
  );
}
