"use client";

import { useState, type FormEvent } from "react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setLoading(false);
    const data = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "حدث خطأ" });
      return;
    }

    setMessage({ type: "success", text: "تم تغيير كلمة المرور بنجاح" });
    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          كلمة المرور الحالية
        </label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        />
        <p className="text-xs text-slate-400">
          إذا لم تغيّرها من قبل، فهي نفس رقم هويتك.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          كلمة المرور الجديدة
        </label>
        <input
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
        {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور الجديدة"}
      </button>
    </form>
  );
}
