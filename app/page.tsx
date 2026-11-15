import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "staff") {
    redirect("/teacher/portfolio/general_files");
  }

  if (session.user.role === "teacher") {
    redirect("/teacher");
  }

  redirect("/admin");
}
