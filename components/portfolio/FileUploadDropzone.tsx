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

  async function upload(file: File) {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    for (const [key, value] of Object.entries(extraFields ?? {})) {
      formData.append(key, value);
    }

    const res = await fetch(uploadUrl, { method: "POST", body: formData });
    setUploading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "فشل رفع الملف");
      return;
    }

    router.refresh();
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) upload(file);
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
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
            : "border-slate-300 dark:border-slate-700 hover:border-blue-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.png"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {uploading ? "جارٍ الرفع..." : "اسحب الملف هنا أو اضغط للاختيار (PDF / Word / PNG، حتى 10MB)"}
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
