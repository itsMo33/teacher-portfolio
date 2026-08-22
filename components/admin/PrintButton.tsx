"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm font-medium px-4 py-2 transition-colors"
    >
      طباعة / حفظ PDF
    </button>
  );
}
