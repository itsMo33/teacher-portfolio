"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ReviewFileItem {
  id: string;
  kind: "attachment" | "schedule";
  sectionLabel: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  signedUrl: string;
  reviewStatus: "accepted" | "needs_revision" | null;
  reviewNote: string | null;
}

const STATUS_LABELS = { accepted: "مقبول", needs_revision: "يحتاج تعديل" } as const;

function FilePreview({ file }: { file: ReviewFileItem }) {
  if (file.mimeType.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={file.signedUrl} alt={file.fileName} className="max-h-[32rem] max-w-full rounded-lg border border-slate-200 dark:border-slate-700 object-contain" />;
  }
  if (file.mimeType === "application/pdf") {
    return <iframe src={file.signedUrl} title={file.fileName} className="h-[36rem] w-full rounded-lg border border-slate-200 dark:border-slate-700" />;
  }
  return (
    <p className="text-sm text-slate-500">
      ما تتوفر معاينة لهذا النوع من الملفات (Word وغيره) --{" "}
      <a href={file.signedUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-primary)] hover:underline">
        حمّل الملف
      </a>
    </p>
  );
}

function FileRow({ file }: { file: ReviewFileItem }) {
  const router = useRouter();
  const [previewing, setPreviewing] = useState(false);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState(file.reviewNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setVerdict(status: "accepted" | "needs_revision" | null, verdictNote = "") {
    setBusy(true);
    setError("");
    const res = await fetch("/api/weekly-review/files", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId: file.id, status, note: verdictNote }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "تعذّر الحفظ");
    } else {
      setReturning(false);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800 dark:text-slate-100 break-words">{file.fileName}</p>
          <p className="text-xs text-slate-500">
            {file.sectionLabel} -- {new Date(file.uploadedAt).toLocaleDateString("ar-SA")}
          </p>
        </div>
        {file.reviewStatus && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${
              file.reviewStatus === "accepted"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {STATUS_LABELS[file.reviewStatus]}
          </span>
        )}
      </div>

      {file.reviewStatus === "needs_revision" && file.reviewNote && (
        <p className="text-xs text-amber-700 dark:text-amber-300">ملاحظتك للمعلم: {file.reviewNote}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" onClick={() => setPreviewing((v) => !v)} className="text-[var(--brand-primary)] hover:underline">
          {previewing ? "إخفاء المعاينة" : "معاينة"}
        </button>
        <a href={file.signedUrl} target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:underline">
          تحميل
        </a>
        {file.kind === "attachment" && (
          <>
            <button
              type="button"
              disabled={busy || file.reviewStatus === "accepted"}
              onClick={() => setVerdict("accepted")}
              className="rounded-full border border-green-300 dark:border-green-800 px-2.5 py-0.5 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
            >
              ✓ مقبول
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setReturning((v) => !v)}
              className="rounded-full border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
            >
              ↩ يحتاج تعديل
            </button>
            {file.reviewStatus && (
              <button type="button" disabled={busy} onClick={() => setVerdict(null)} className="text-slate-400 hover:underline disabled:opacity-50">
                إلغاء القرار
              </button>
            )}
          </>
        )}
      </div>

      {returning && (
        <div className="flex flex-col gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="شنو المطلوب تعديله؟ (يوصل للمعلم مع الملف)"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setVerdict("needs_revision", note)}
              className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 disabled:opacity-50"
            >
              إرجاع للمعلم
            </button>
            <button type="button" onClick={() => setReturning(false)} className="text-xs text-slate-500 hover:underline">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {previewing && <FilePreview file={file} />}
    </li>
  );
}

export function ReviewTeacherCard({
  teacherId,
  name,
  subject,
  files,
}: {
  teacherId: string;
  name: string;
  subject: string | null;
  files: ReviewFileItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const undecided = files.filter((f) => f.kind === "attachment" && !f.reviewStatus).length;

  async function markReviewed() {
    if (undecided > 0 && !confirm(`فيه ${undecided} ملف بدون قرار (مقبول / يحتاج تعديل). تأكيد "تمت المراجعة" وإخفاء ملفات ${name}؟`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/weekly-review/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "تعذّر الحفظ");
    else router.refresh();
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-50">{name}</h3>
          <p className="text-xs text-slate-500">
            {subject ? `${subject} -- ` : ""}
            {files.length} ملف جديد
          </p>
        </div>
        <button
          type="button"
          onClick={markReviewed}
          disabled={busy}
          className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
        >
          تمت المراجعة
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <ul className="flex flex-col gap-2">
        {files.map((f) => (
          <FileRow key={f.id} file={f} />
        ))}
      </ul>
    </section>
  );
}
