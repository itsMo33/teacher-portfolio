import { auth } from "@/lib/auth/auth-options";
import { AppShell, type NavItem } from "@/components/ui/AppShell";

const navItems: NavItem[] = [
  { href: "/admin", label: "قائمة المعلمين" },
  { href: "/admin/reports", label: "تصدير تقرير" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <AppShell title="بوابة الإدارة" userName={session?.user?.name ?? ""} navItems={navItems}>
      {children}
    </AppShell>
  );
}
