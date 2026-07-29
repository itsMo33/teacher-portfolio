import { AddTeacherForm } from "@/components/admin/AddTeacherForm";

export default function AddTeacherPage() {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">إضافة معلم</h2>
      <p className="text-sm text-slate-500 mb-4">
        كلمة المرور الافتراضية للمعلم الجديد هي نفس رقم هويته، ويمكنه تغييرها لاحقًا من الإعدادات.
      </p>
      <AddTeacherForm />
    </div>
  );
}
