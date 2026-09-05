import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

interface DashboardCard {
  href: string;
  label: string;
  description: string;
  accentColor: string;
}

const DASHBOARD_CARDS: DashboardCard[] = [
  { href: "/admin/teachers", label: "قائمة المعلمين", description: "استعراض جميع المعلمين ونسب إنجازهم", accentColor: "#2563eb" },
  { href: "/admin/uploads", label: "رفع ملفات للمعلمين", description: "رفع ملفات إدارية نيابة عن المعلمين", accentColor: "#0891b2" },
  { href: "/admin/substitute-schedule", label: "جدول الانتظار", description: "إسناد المعلمين المنتظرين لتغطية الحصص", accentColor: "#0d9488" },
  { href: "/admin/teachers/new", label: "إضافة معلم", description: "إنشاء حساب معلم جديد", accentColor: "#059669" },
  { href: "/admin/teachers/import", label: "استيراد معلمين", description: "استيراد عدة معلمين دفعة واحدة", accentColor: "#65a30d" },
  { href: "/admin/statistics", label: "الإحصائيات", description: "نسب رفع الملفات لكل قسم بين المعلمين", accentColor: "#d97706" },
  { href: "/admin/reports", label: "تصدير تقرير", description: "تصدير تقرير إنجاز شامل بصيغة إكسل", accentColor: "#ea580c" },
  { href: "/admin/school-management", label: "إدارة المدرسة", description: "ملفات مدير المدرسة والوكلاء والموجه الطلابي", accentColor: "#7c3aed" },
  { href: "/admin/activity-log", label: "سجل النشاط", description: "سجل كل العمليات التي تمت في النظام", accentColor: "#c026d3" },
  { href: "/admin/trash", label: "سلة المحذوفات", description: "استعادة أو حذف الحسابات والملفات المحذوفة نهائيًا", accentColor: "#dc2626" },
  { href: "/admin/settings", label: "الإعدادات", description: "إعدادات الحساب", accentColor: "#64748b" },
];

export default async function AdminDashboard() {
  const { count: teacherCount } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "teacher")
    .is("deleted_at", null);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">لوحة تحكم الإدارة</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DASHBOARD_CARDS.map((card, index) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              borderInlineStartColor: card.accentColor,
              borderInlineStartWidth: 4,
              animationDelay: `${index * 45}ms`,
            }}
            className="animate-fade-in-up group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125"
                  style={{ backgroundColor: card.accentColor }}
                />
                {card.label}
              </h3>
              {card.href === "/admin/teachers" && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium"
                  style={{ backgroundColor: `${card.accentColor}1a`, color: card.accentColor }}
                >
                  {teacherCount ?? 0} معلم
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
