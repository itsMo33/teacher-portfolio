import Link from "next/link";
import { auth } from "@/lib/auth/auth-options";
import { listInquiries, toTeacherView } from "@/lib/inquiries";
import { TeacherInquiries } from "@/components/inquiries/TeacherInquiries";

export default async function TeacherInquiriesPage() {
  const session = await auth();
  const inquiries = (await listInquiries({ teacherId: session!.user.id })).map(toTeacherView);

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div>
        <Link href="/teacher" className="text-sm text-[var(--brand-primary)] hover:underline">
          ← لوحة التحكم
        </Link>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">المسائلات</h2>
        <p className="text-sm text-slate-500 mt-1">افتح المسائلة واكتب تبريرك. تظهر لك النتيجة هنا بعد ما تعتمدها الإدارة.</p>
      </div>
      <TeacherInquiries inquiries={inquiries} />
    </div>
  );
}
