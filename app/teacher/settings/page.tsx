import { ChangePasswordForm } from "@/components/ui/ChangePasswordForm";
import { PushToggle } from "@/components/ui/PushToggle";
import { auth } from "@/lib/auth/auth-options";
import { canUseApp } from "@/lib/app-access";

export default async function TeacherSettingsPage() {
  const session = await auth();
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">الإعدادات</h2>
      {canUseApp(session?.user) && (
        <div className="mb-4 max-w-xl">
          <PushToggle />
        </div>
      )}
      <ChangePasswordForm />
    </div>
  );
}
