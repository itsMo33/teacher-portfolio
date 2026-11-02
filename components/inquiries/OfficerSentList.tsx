"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SentBatch {
  batchId: string;
  createdAt: string;
  items: { id: string; teacherName: string }[];
}

function when(iso: string) {
  return new Date(iso).toLocaleString("ar-SA", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
}

/** What the uploading account has sent, one upload at a time, with a delete button for each inquiry and for a whole
 *  upload -- so a test or a wrong file can be taken back. */
export function OfficerSentList({ batches }: { batches: SentBatch[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove(url: string, question: string) {
    if (!confirm(question)) return;
    setBusy(true);
    setError("");
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "تعذّر الحذف");
    else router.refresh();
    setBusy(false);
  }

  if (batches.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-400">
        ما أرسلت شي من هذا النوع.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold text-slate-800 dark:text-slate-100">اللي أرسلته</h3>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {batches.map((b) => (
        <section key={b.batchId} className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">
              {when(b.createdAt)} -- {b.items.length} مسائلة
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                remove(
                  `/api/inquiries/batch/${b.batchId}`,
                  `حذف كل المسائلات (${b.items.length}) من هذا الرفع؟ تختفي من حسابات المعلمين أيضاً ولا يمكن التراجع.`
                )
              }
              className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1 text-xs text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              حذف الدفعة كلها
            </button>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {b.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-1">
                <span className="text-slate-800 dark:text-slate-100">{i.teacherName}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(`/api/inquiries/${i.id}`, `حذف مسائلة ${i.teacherName}؟`)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
