"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface PreviewItem {
  teacherId: string | null;
  teacherName: string | null;
  page: number;
  pageOnly: boolean;
  text: string;
  minutes: number | null;
}

interface TeacherOption {
  id: string;
  name: string;
}

const INPUT_CLASS =
  "rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]";

/** Upload the PDF, check which teacher each part was matched to, then send. Nothing reaches a teacher until the
 *  uploader confirms the matches here. */
export function InquiryUploader({ kind }: { kind: "delay" | "other" }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const isDelay = kind === "delay";

  async function handleFile(file: File) {
    setError("");
    setDone(null);
    setItems([]);
    setPath(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) return setError("الملف لازم يكون PDF");

    setBusy(true);
    try {
      setStep("جارٍ رفع الملف...");
      const urlRes = await fetch("/api/inquiries/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size }),
      });
      if (!urlRes.ok) throw new Error((await urlRes.json().catch(() => ({}))).error ?? "تعذّر رفع الملف");
      const { path: uploadedPath, signedUrl } = await urlRes.json();

      const putRes = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!putRes.ok) throw new Error("تعذّر رفع الملف");

      setStep("جارٍ قراءة الأسماء من الملف...");
      const parseRes = await fetch("/api/inquiries/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: uploadedPath }),
      });
      const data = await parseRes.json();
      if (!parseRes.ok) throw new Error(data.error ?? "تعذّرت قراءة الملف");

      setPath(uploadedPath);
      setItems(data.items);
      setTeachers(data.teachers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر رفع الملف");
    } finally {
      setBusy(false);
      setStep("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function update(index: number, patch: Partial<PreviewItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  const ready = items.filter((i) => i.teacherId);
  const missingMinutes = isDelay ? ready.filter((i) => i.minutes === null).length : 0;

  async function handleSend() {
    if (ready.length === 0) return setError("اختر معلماً واحداً على الأقل");
    if (!confirm(`إرسال ${ready.length} مسائلة للمعلمين؟`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/inquiries/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, path, items: ready }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر الإرسال");
      setDone(data.created);
      setItems([]);
      setPath(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الإرسال");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-slate-50">{isDelay ? "مسائلات تأخير (حضوري)" : "المسائلات الأخرى"}</h3>
        <p className="text-sm text-slate-500 mt-1">
          ارفع ملف PDF فيه المعلمين، وأقرأ منه كل معلم وأرسله لحسابه. تراجع التطابق قبل الإرسال.
        </p>
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="text-sm text-slate-600 dark:text-slate-300 file:ml-3 file:rounded-lg file:border-0 file:bg-[var(--brand-primary)] file:px-4 file:py-2 file:text-sm file:text-white"
        />
        {step && <p className="mt-2 text-xs text-slate-500">{step}</p>}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {done !== null && <p className="text-sm text-green-600 dark:text-green-400">تم إرسال {done} مسائلة للمعلمين.</p>}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            وُجد {items.length} بند في الملف. تأكد من اسم المعلم{isDelay ? " ومقدار التأخر" : ""} في كل بند، وغيّره إذا كان خطأ. البند بدون معلم ما ينرسل.
          </p>
          <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li
                key={`${item.page}-${i}`}
                className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${
                  item.teacherId ? "border-slate-200 dark:border-slate-800" : "border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">صفحة {item.page}</span>
                  <select
                    value={item.teacherId ?? ""}
                    onChange={(e) => {
                      const t = teachers.find((x) => x.id === e.target.value);
                      update(i, { teacherId: t?.id ?? null, teacherName: t?.name ?? null });
                    }}
                    className={`${INPUT_CLASS} min-w-[12rem]`}
                  >
                    <option value="">— بدون معلم (تخطي) —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {isDelay && (
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      دقائق التأخر
                      <input
                        type="number"
                        min={0}
                        max={600}
                        value={item.minutes ?? ""}
                        onChange={(e) => update(i, { minutes: e.target.value === "" ? null : Number(e.target.value) })}
                        className={`${INPUT_CLASS} w-20 text-center`}
                      />
                    </label>
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-slate-500">{item.text}</p>
              </li>
            ))}
          </ul>

          {missingMinutes > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {missingMinutes} بند بدون دقائق تأخر -- ينرسل لرائد بدون اقتراح، أو اكتب الدقائق.
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={handleSend}
              disabled={busy || ready.length === 0}
              className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
            >
              إرسال {ready.length} للمعلمين
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
