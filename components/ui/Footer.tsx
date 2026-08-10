export function Footer() {
  return (
    <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-center">
      <p className="text-xs text-slate-400">
        جميع الحقوق محفوظة © {new Date().getFullYear()} — تطوير Eng.Mohammed
      </p>
    </footer>
  );
}
