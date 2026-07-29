"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      nationalId,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!result || result.error) {
      setError("رقم الهوية أو كلمة المرور غير صحيحة");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 text-center mb-1">
          بوابة إنجاز المعلمين
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
          سجّل الدخول برقم الهوية وكلمة المرور
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nationalId" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              رقم الهوية
            </label>
            <input
              id="nationalId"
              type="text"
              inputMode="numeric"
              required
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="١٠xxxxxxxx"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 transition-colors"
          >
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
