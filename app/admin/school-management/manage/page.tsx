"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Subsection {
  key: string;
  labelAr: string;
}

interface Category {
  key: string;
  label_ar: string;
  accent_color: string;
  subsections: Subsection[];
}

function randomKey(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

export default function ManageSchoolCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#2563eb");
  const [creating, setCreating] = useState(false);
  const [subsectionDrafts, setSubsectionDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/school-management-categories")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCategories(data.categories ?? []);
      })
      .catch(() => setError("تعذّر تحميل الأقسام"))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function patchCategory(key: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/school-management-categories/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "تعذّر حفظ التعديل");
      return null;
    }
    const { category } = await res.json();
    setCategories((prev) => prev.map((c) => (c.key === key ? category : c)));
    setError("");
    return category as Category;
  }

  async function handleRenameCategory(key: string, labelAr: string) {
    if (!labelAr.trim()) return;
    await patchCategory(key, { labelAr: labelAr.trim() });
  }

  async function handleRecolor(key: string, accentColor: string) {
    await patchCategory(key, { accentColor });
  }

  async function handleAddSubsection(cat: Category) {
    const label = (subsectionDrafts[cat.key] ?? "").trim();
    if (!label) return;
    const subsections = [...cat.subsections, { key: randomKey("sub"), labelAr: label }];
    const updated = await patchCategory(cat.key, { subsections });
    if (updated) setSubsectionDrafts((prev) => ({ ...prev, [cat.key]: "" }));
  }

  async function handleRenameSubsection(cat: Category, subKey: string, labelAr: string) {
    if (!labelAr.trim()) return;
    const subsections = cat.subsections.map((s) => (s.key === subKey ? { ...s, labelAr: labelAr.trim() } : s));
    await patchCategory(cat.key, { subsections });
  }

  async function handleRemoveSubsection(cat: Category, subKey: string) {
    if (!confirm("حذف هذا الفرع؟ الملفات المرفوعة فيه سابقًا تبقى محفوظة لكنها لن تظهر ضمن أي فرع.")) return;
    const subsections = cat.subsections.filter((s) => s.key !== subKey);
    await patchCategory(cat.key, { subsections });
  }

  async function handleDeleteCategory(cat: Category) {
    if (!confirm(`حذف قسم "${cat.label_ar}" نهائيًا؟`)) return;
    const res = await fetch(`/api/school-management-categories/${cat.key}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "تعذّر حذف القسم");
      return;
    }
    setCategories((prev) => prev.filter((c) => c.key !== cat.key));
    setError("");
  }

  async function handleCreateCategory() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/school-management-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelAr: newLabel.trim(), accentColor: newColor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "تعذّر إضافة القسم");
        return;
      }
      const { category } = await res.json();
      setCategories((prev) => [...prev, category]);
      setNewLabel("");
      setNewColor("#2563eb");
      setError("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">إدارة أقسام إدارة المدرسة</h2>
          <p className="text-sm text-slate-500">أضف أقسامًا جديدة، غيّر الأسماء والألوان، أو أضف/احذف فروعًا داخل كل قسم</p>
        </div>
        <Link
          href="/admin/school-management"
          className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          رجوع للملفات
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">إضافة قسم جديد</h3>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-9 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="اسم القسم"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
          <button
            type="button"
            onClick={handleCreateCategory}
            disabled={creating || !newLabel.trim()}
            className="shrink-0 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
          >
            {creating ? "جارٍ الإضافة..." : "إضافة"}
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
          جارٍ التحميل...
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {categories.map((cat) => (
            <div key={cat.key} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cat.accent_color}
                  onChange={(e) => handleRecolor(cat.key, e.target.value)}
                  className="h-9 w-9 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
                <input
                  type="text"
                  key={`${cat.key}-${cat.label_ar}`}
                  defaultValue={cat.label_ar}
                  onBlur={(e) => handleRenameCategory(cat.key, e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 font-bold text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="shrink-0 text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  حذف القسم
                </button>
              </div>

              <div className="flex flex-col gap-2 pr-3">
                {cat.subsections.map((sub) => (
                  <div key={sub.key} className="flex items-center gap-2">
                    <input
                      type="text"
                      key={`${sub.key}-${sub.labelAr}`}
                      defaultValue={sub.labelAr}
                      onBlur={(e) => handleRenameSubsection(cat, sub.key, e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSubsection(cat, sub.key)}
                      className="shrink-0 text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      حذف
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={subsectionDrafts[cat.key] ?? ""}
                    onChange={(e) => setSubsectionDrafts((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                    placeholder="اسم فرع جديد"
                    className="flex-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSubsection(cat)}
                    disabled={!(subsectionDrafts[cat.key] ?? "").trim()}
                    className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    إضافة فرع
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
