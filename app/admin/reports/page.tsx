export default function AdminReportsPage() {
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">تصدير تقرير الإنجاز</h2>
      <p className="text-sm text-slate-500 mb-4">
        يُنشئ التقرير ملف Excel يوضح لكل معلم أي الأقسام تم رفعها وأيها ناقصة، مع نسبة الإنجاز الكلية.
      </p>
      <a
        href="/api/report/export"
        className="inline-block rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 transition-colors"
      >
        تنزيل تقرير Excel
      </a>
    </div>
  );
}
