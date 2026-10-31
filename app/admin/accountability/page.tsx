import { redirect } from "next/navigation";

// The old مسائلات page is now a tab of the merged مسائلات page.
export default function AdminAccountabilityPage() {
  redirect("/admin/inquiries?kind=files");
}
