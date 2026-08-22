import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { createUser } from "@/lib/account";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, nationalId, subject } = await req.json();
  if (!name || !nationalId) {
    return NextResponse.json({ error: "Missing name or nationalId" }, { status: 400 });
  }

  try {
    const teacher = await createUser({ nationalId, name, role: "teacher", subject });
    await logActivity({
      actorId: session.user.id,
      actorName: session.user.name ?? "",
      action: "create_teacher",
      targetTeacherId: teacher.id,
      targetTeacherName: teacher.name,
    });
    return NextResponse.json({ teacher });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create teacher";
    const isDuplicate = message.includes("duplicate key") || message.includes("already exists");
    return NextResponse.json(
      { error: isDuplicate ? "رقم الهوية مستخدم مسبقًا" : message },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
