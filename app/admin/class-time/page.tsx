import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { TeacherPerformanceView } from "@/components/admin/TeacherPerformanceView";

/** The الالتزام بزمن الحصة tracker on its own, for accounts granted just that part of متابعة الأداء. */
export default async function ClassTimePage() {
  const session = await auth();
  if (!session?.user.canTrackClassTime) redirect("/admin");

  return <TeacherPerformanceView classTimeOnly backHref={session.user.role === "teacher" ? "/teacher" : "/admin"} />;
}
