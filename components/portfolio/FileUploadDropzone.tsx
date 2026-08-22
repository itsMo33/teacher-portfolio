"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function FileUploadDropzone({
  uploadUrl,
  extraFields,
}: {
  uploadUrl: string;
  extraFields?: Record<string, string>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadOne(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    for (const [key, value] of Object.entries(extraFields ?? {})) {
      formData.append(key, value);
    }

    const res = await fetch(uploadUrl, { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.error ?? `فشل رفع الملف: ${file.name}`;
    }
    return null;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const err = await uploadOne(file);
      if (err) errors.push(err);
    }

    setUploading(false);
    if (errors.length > 0) setError(errors.join(" | "));
    router.refresh();
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
          dragging
            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 scale-[1.02]"
            : "border-slate-300 dark:border-slate-700 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/[0.03]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          {uploading && (
            <svg className="h-4 w-4 animate-spin text-[var(--brand-primary)]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {uploading
            ? "جارٍ الرفع..."
            : "اسحب ملفًا أو أكثر هنا أو اضغط للاختيار (PDF / Word / صورة، حتى 10MB لكل ملف)"}
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
