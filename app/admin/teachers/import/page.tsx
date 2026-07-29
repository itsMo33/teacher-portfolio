import { BulkImportForm } from "@/components/admin/BulkImportForm";

export default function ImportTeachersPage() {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">استيراد معلمين من ملف</h2>
      <p className="text-sm text-slate-500 mb-4">
        ارفع ملف Excel أو CSV بعمودين: اسم المعلم ورقم الهوية. سيتم إنشاء حساب لكل معلم بكلمة مرور
        افتراضية تساوي رقم هويته، مع تجاوز أي رقم هوية موجود مسبقًا.
      </p>
      <BulkImportForm />
    </div>
  );
}
