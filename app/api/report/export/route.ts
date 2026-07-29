import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { buildCompletionWorkbook } from "@/lib/report/build-completion-workbook";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teachers = await getTeachersWithCompletion();
  const workbook = buildCompletionWorkbook(teachers);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="teacher-completion-report.xlsx"`,
    },
  });
}
