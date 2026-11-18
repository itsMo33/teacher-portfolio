"use client";

import { useEffect, useState } from "react";

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "need-install" | "denied" | "off" | "on";

/** Turns notifications on or off for this device. On an iPhone they work only once the app is on the home screen. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "need-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "") });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) {
        await sub.unsubscribe();
        setError((await res.json().catch(() => ({}))).error ?? "تعذّر تفعيل الإشعارات");
        return;
      }
      setState("on");
    } catch {
      setError("تعذّر تفعيل الإشعارات على هذا الجهاز");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;
  if (compact && (state === "on" || state === "denied" || state === "need-install")) return null;

  return (
    <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-50">الإشعارات على هذا الجهاز</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {state === "on" && "مفعّلة: يصلك تنبيه عند وصول مسائلة أو صدور قرارها أو قرب انتهاء مهلتك."}
          {state === "off" && "فعّلها ليصلك تنبيه عند وصول مسائلة أو صدور قرارها أو قرب انتهاء مهلتك."}
          {state === "denied" && "الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح ثم أعد المحاولة."}
          {state === "need-install" && "على الآيفون ثبّت التطبيق أولًا: زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»، وافتحه من الأيقونة."}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {state === "off" && (
        <button type="button" disabled={busy} onClick={enable} className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "..." : "تفعيل"}
        </button>
      )}
      {state === "on" && (
        <button type="button" disabled={busy} onClick={disable} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          {busy ? "..." : "إيقاف"}
        </button>
      )}
    </div>
  );
}
