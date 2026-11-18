"use client";

import { useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 3;

function today(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shift(day: string, days: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function show(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("ar-SA", { timeZone: "UTC", day: "numeric", month: "long" });
}

interface WeekInquiry {
  id: string;
  teacherName: string;
  kind: string;
}

/** Prints the whole week's inquiries in one go: every inquiry sent that week, each as its filled form followed by the
 *  files attached to it. The forms are built one by one on the server and joined into one PDF here in the browser (so a
 *  big week never runs into a server time limit); the PDF opens for printing or saving. */
export function WeeklyPrintButton({ kind }: { kind: string }) {
  const [day, setDay] = useState(today);
  const [status, setStatus] = useState<"all" | "done" | "open">("all");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; count: number; skipped: string[]; range: string } | null>(null);

  async function build() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setProgress("جارٍ تحضير قائمة مسائلات الأسبوع...");
      const listRes = await fetch(`/api/inquiries/week?week=${day}&kind=${kind}&status=${status}`);
      if (!listRes.ok) throw new Error("تعذّر تحميل مسائلات الأسبوع");
      const { weekStart, weekEnd, inquiries } = (await listRes.json()) as { weekStart: string; weekEnd: string; inquiries: WeekInquiry[] };
      if (inquiries.length === 0) throw new Error(`ما فيه مسائلات${status === "done" ? " منتهية" : status === "open" ? " غير منتهية" : ""} أُرسلت في هذا الأسبوع (${show(weekStart)} إلى ${show(weekEnd)})`);

      const { PDFDocument } = await import("pdf-lib");
      const merged = await PDFDocument.create();
      const parts: (Uint8Array | null)[] = new Array(inquiries.length).fill(null);
      const skipped: string[] = [];
      let done = 0;
      let next = 0;

      // a few forms at a time, kept in order
      const worker = async () => {
        while (next < inquiries.length) {
          const index = next++;
          const item = inquiries[index];
          try {
            const res = await fetch(`/api/inquiries/${item.id}/form`);
            if (res.ok && (res.headers.get("content-type") ?? "").includes("pdf")) parts[index] = new Uint8Array(await res.arrayBuffer());
            else skipped.push(item.teacherName);
          } catch {
            skipped.push(item.teacherName);
          }
          done++;
          setProgress(`جارٍ تجهيز المسائلات ${done} من ${inquiries.length}...`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, inquiries.length) }, worker));

      let count = 0;
      for (const bytes of parts) {
        if (!bytes) continue;
        const src = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
        count++;
      }
      if (count === 0) throw new Error("ما تجهّز أي نموذج للطباعة");

      setProgress("جارٍ تجميع الملف...");
      const saved = await merged.save();
      const url = URL.createObjectURL(new Blob([saved as BlobPart], { type: "application/pdf" }));
      setResult({ url, count, skipped, range: `${show(weekStart)} إلى ${show(weekEnd)}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تجهيز الطباعة");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">طباعة مسائلات الأسبوع كاملة (مع المرفقات)</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setDay((d) => shift(d, -7))} disabled={busy} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-slate-600 dark:text-slate-300 disabled:opacity-50">
          الأسبوع السابق
        </button>
        <input
          type="date"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          disabled={busy}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-slate-900 dark:text-slate-50"
        />
        <button type="button" onClick={() => setDay((d) => shift(d, 7))} disabled={busy} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-slate-600 dark:text-slate-300 disabled:opacity-50">
          الأسبوع التالي
        </button>
        <button type="button" onClick={build} disabled={busy} className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white px-4 py-1.5 disabled:opacity-50">
          {busy ? "جارٍ التجهيز..." : "تجهيز طباعة الأسبوع"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm" role="radiogroup" aria-label="حالة المسائلات">
        {(
          [
            ["all", "كل المسائلات"],
            ["done", "اللي تم الانتهاء منها"],
            ["open", "اللي لم يتم الانتهاء منها"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
              status === key
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <input type="radio" name="weekly-status" value={key} checked={status === key} onChange={() => setStatus(key)} disabled={busy} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">يشمل كل المسائلات اللي أُرسلت في الأسبوع الذي يقع فيه التاريخ المختار{kind !== "all" ? " (من هذا النوع فقط)" : ""}، كل واحدة بنموذجها ومرفقاتها.</p>
      {progress && <p className="text-xs text-slate-500">{progress}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {result && (
        <div className="flex flex-col gap-1 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
          <p>
            جاهز: {result.count} مسائلة{status === "done" ? " منتهية" : status === "open" ? " غير منتهية" : ""} للأسبوع {result.range}.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              فتح الملف للطباعة
            </a>
            <a href={result.url} download={`مسائلات-الأسبوع-${day}.pdf`} className="underline">
              حفظ PDF
            </a>
          </div>
          {result.skipped.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">بدون نموذج (ما دخلت الملف): {result.skipped.join("، ")}</p>}
        </div>
      )}
    </div>
  );
}
