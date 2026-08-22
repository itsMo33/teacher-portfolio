"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { SCHOOL_NAME } from "@/lib/school";
import { Footer } from "@/components/ui/Footer";

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
    <div className="relative flex flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Image
        src="/leaders.jpg"
        alt="خادم الحرمين الشريفين الملك سلمان وولي العهد الأمير محمد بن سلمان"
        fill
        priority
        className="pointer-events-none object-cover opacity-15 dark:opacity-10"
      />
      <div className="relative z-10 h-2 w-full shrink-0 bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-accent)]" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="animate-fade-in-scale w-full max-w-sm rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg p-6 sm:p-8">
        <div className="flex items-center justify-center gap-5 sm:gap-6 mb-4">
          <Image src="/moe-logo.png" alt="شعار وزارة التعليم" width={90} height={51} className="h-9 sm:h-10 w-auto object-contain transition-transform duration-300 hover:scale-110" />
          <Image src="/vision2030-logo.png" alt="رؤية 2030" width={90} height={90} className="h-11 sm:h-12 w-auto object-contain transition-transform duration-300 hover:scale-110" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 text-center mb-1">
          بوابة إنجاز المعلمين
        </h1>
        <p className="text-sm font-medium text-[var(--brand-primary)] text-center mb-1">{SCHOOL_NAME}</p>
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
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-slate-50 transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
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
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-slate-50 transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>

          {error && (
            <p className="animate-fade-in-up text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] disabled:opacity-60 text-white font-medium py-2.5 transition-all duration-150 hover:shadow-md active:scale-[0.98]"
          >
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>
      </div>
      </div>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
