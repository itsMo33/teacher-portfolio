import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { getTeachersWithCompletion } from "@/lib/teachers-data";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teachers = await getTeachersWithCompletion();
  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      national_id: t.national_id,
      subject: t.subject,
      completionPercent: t.completionPercent,
      hasSchedule: t.hasSchedule,
    })),
  });
}
