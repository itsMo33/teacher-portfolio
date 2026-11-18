import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { countInquiries, listInquiries, toTeacherView } from "@/lib/inquiries";
import { InquirySummary } from "@/components/inquiries/InquirySummary";
import { TeacherInquiries } from "@/components/inquiries/TeacherInquiries";
import { getExemptDates } from "@/lib/inquiry-exempt";

/** The inquiries sent to an account that is not a teacher (a restricted agent, رائد, the manager): the same list and
 *  the same answering a teacher has. Teachers and staff accounts have it inside their own portal. */
export default async function MyInquiriesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "teacher" || session.user.role === "staff") redirect("/teacher/portfolio/accountability");

  const inquiries = (await listInquiries({ teacherId: session.user.id })).map(toTeacherView);
  const exemptDates = (await getExemptDates([{ id: session.user.id, name: session.user.name ?? "" }])).get(session.user.id) ?? [];
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">المسائلات</h2>
      <InquirySummary counts={countInquiries(inquiries)} />
      <TeacherInquiries inquiries={inquiries} exemptDates={exemptDates} />
    </div>
  );
}
