import Image from "next/image";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[var(--background)]">
      <Image
        src="/athar-logo-full.png"
        alt="أثر"
        width={220}
        height={96}
        priority
        className="animate-logo-breathe h-auto w-40 sm:w-52"
      />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="animate-loading-bar-sweep h-full w-1/2 rounded-full bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-accent)]" />
      </div>
    </div>
  );
}
