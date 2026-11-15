import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { countInquiries, getInquiryRole, listInquiries, toTeacherView } from "@/lib/inquiries";
import { InquirySummary } from "@/components/inquiries/InquirySummary";
import { TeacherInquiries } from "@/components/inquiries/TeacherInquiries";

/** The inquiries sent to an account that is not a teacher but still answers them (the lab technician, whose
 *  account is scoped to its own category): the same list and the same answering a teacher has. */
export default async function MyInquiriesPage() {
  const session = await auth();
  if (!session || getInquiryRole(session.user) !== "teacher" || session.user.role === "teacher") redirect("/admin");

  const inquiries = (await listInquiries({ teacherId: session.user.id })).map(toTeacherView);
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">المسائلات</h2>
      <InquirySummary counts={countInquiries(inquiries)} />
      <TeacherInquiries inquiries={inquiries} />
    </div>
  );
}
