"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AddTeacherForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/teachers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nationalId, subject }),
    });

    setLoading(false);
    const data = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "حدث خطأ" });
      return;
    }

    setMessage({ type: "success", text: `تم إنشاء حساب ${data.teacher.name} بنجاح. كلمة المرور الافتراضية هي رقم الهوية.` });
    setName("");
    setNationalId("");
    setSubject("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">اسم المعلم</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">رقم الهوية</label>
        <input
          required
          inputMode="numeric"
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">المادة (اختياري)</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        />
      </div>

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[var(--brand-primary)] hover:opacity-90 disabled:opacity-60 text-white font-medium py-2.5"
      >
        {loading ? "جارٍ الإضافة..." : "إضافة المعلم"}
      </button>
    </form>
  );
}
