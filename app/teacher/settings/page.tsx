import { ChangePasswordForm } from "@/components/ui/ChangePasswordForm";
import { PushToggle } from "@/components/ui/PushToggle";

export default function TeacherSettingsPage() {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">الإعدادات</h2>
      <div className="mb-4 max-w-xl">
        <PushToggle />
      </div>
      <ChangePasswordForm />
    </div>
  );
}
