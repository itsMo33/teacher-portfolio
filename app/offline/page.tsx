export const metadata = { title: "لا يوجد اتصال" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="surface max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800">📡</div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">لا يوجد اتصال بالإنترنت</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">تأكد من اتصالك ثم أعد المحاولة. بياناتك محفوظة ولن يضيع منها شيء.</p>
        {/* a plain link on purpose: it must reload the page, not try a client-side navigation that fails offline */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-5 inline-block rounded-xl bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white">
          إعادة المحاولة
        </a>
      </div>
    </main>
  );
}
