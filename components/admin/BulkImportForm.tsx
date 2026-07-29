"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ImportResult {
  created: { name: string; nationalId: string }[];
  skipped: { row: { name: string; nationalId: string }; reason: string }[];
}

export function BulkImportForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/teachers/import", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? "فشل استيراد الملف");
      return;
    }

    setResult(data);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <div
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[var(--brand-primary)] p-6 text-center transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {uploading ? "جارٍ الاستيراد..." : "اضغط لاختيار ملف Excel أو CSV يحتوي على عمودين: الاسم ورقم الهوية"}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm text-green-600 mb-2">تم إنشاء {result.created.length} حساب معلم بنجاح.</p>
          {result.skipped.length > 0 && (
            <>
              <p className="text-sm text-amber-600 mb-1">تم تجاوز {result.skipped.length} سجل:</p>
              <ul className="text-xs text-slate-500 list-disc pr-5">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    {s.row.name} ({s.row.nationalId}) — {s.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
