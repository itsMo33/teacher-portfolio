import { ChangePasswordForm } from "@/components/ui/ChangePasswordForm";

export default function AdminSettingsPage() {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">الإعدادات</h2>
      <ChangePasswordForm />
    </div>
  );
}
