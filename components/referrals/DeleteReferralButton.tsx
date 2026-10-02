"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteReferralButton({ referralId, studentName }: { referralId: string; studentName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm(`حذف تحويل الطالب "${studentName}" نهائيًا مع كل مرفقاته؟ لا يمكن التراجع.`)) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/student-referrals/${referralId}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "تعذّر الحذف");
      setBusy(false);
      return;
    }
    router.push("/admin/student-referrals");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
      >
        حذف التحويل
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
