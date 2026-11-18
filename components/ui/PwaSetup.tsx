"use client";

import { useEffect, useState } from "react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "athar-install-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Registers the service worker and offers to install the app: a button on Android and Chrome, the steps on an iPhone. */
export function PwaSetup() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true); // hidden until we know
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- these are browser facts, readable only after the page loads
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setDismissed(readDismissed());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || dismissed || (!installEvent && !ios)) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* private mode: it just shows again next time */
    }
  };

  return (
    <div className="no-print fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md md:bottom-4 md:left-4 md:right-auto md:mx-0">
      <div className="surface flex items-start gap-3 p-4 shadow-xl">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-50">ثبّت تطبيق أثر على جوالك</p>
          {installEvent ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">يفتح بضغطة من الشاشة الرئيسية مثل أي تطبيق.</p>
          ) : (
            <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
              اضغط زر المشاركة <span aria-hidden>⬆️</span> في سفاري، ثم اختر «إضافة إلى الشاشة الرئيسية».
            </p>
          )}
          {installEvent && (
            <button
              type="button"
              onClick={async () => {
                await installEvent.prompt();
                const { outcome } = await installEvent.userChoice;
                setInstallEvent(null);
                if (outcome === "accepted") close();
              }}
              className="mt-2 rounded-lg bg-[var(--brand-primary)] px-4 py-1.5 text-xs font-semibold text-white"
            >
              تثبيت
            </button>
          )}
        </div>
        <button type="button" onClick={close} aria-label="إغلاق" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
          ✕
        </button>
      </div>
    </div>
  );
}
