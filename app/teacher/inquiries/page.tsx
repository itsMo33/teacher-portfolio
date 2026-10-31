import { redirect } from "next/navigation";

// The inquiries now live inside the teacher's مسائلات section.
export default function TeacherInquiriesPage() {
  redirect("/teacher/portfolio/accountability");
}
