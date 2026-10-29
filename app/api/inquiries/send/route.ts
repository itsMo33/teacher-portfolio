import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createInquiries, getInquiryRole, type SendItem } from "@/lib/inquiries";
import { logActivity } from "@/lib/audit";

export const maxDuration = 60;

/** Creates the inquiries the uploader confirmed and puts each one in its teacher's account. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getInquiryRole(session.user) !== "officer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { kind, path, items } = await req.json();
  if (kind !== "delay" && kind !== "other") return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  if (typeof path !== "string" || !path.startsWith("inquiries/uploads/") || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "ما فيه معلمين للإرسال" }, { status: 400 });

  const clean: SendItem[] = [];
  const { data: teachers } = await supabaseAdmin.from("users").select("id").eq("role", "teacher").is("deleted_at", null);
  const teacherIds = new Set((teachers ?? []).map((t) => t.id as string));
  for (const i of items) {
    if (typeof i?.teacherId !== "string" || !teacherIds.has(i.teacherId)) continue;
    const minutes = i.minutes === null || i.minutes === "" || i.minutes === undefined ? null : Number(i.minutes);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 600)) {
      return NextResponse.json({ error: "عدد الدقائق غير صحيح" }, { status: 400 });
    }
    clean.push({
      teacherId: i.teacherId,
      page: Number(i.page) || 1,
      pageOnly: !!i.pageOnly,
      text: String(i.text ?? "").slice(0, 1500),
      minutes,
    });
  }
  if (clean.length === 0) return NextResponse.json({ error: "ما فيه معلمين صالحين للإرسال" }, { status: 400 });

  try {
    const { created } = await createInquiries({ kind, sourcePath: path, uploadedBy: session.user.id, items: clean });
    await logActivity({
      actorId: session.user.id,
      actorName: session.user.name ?? "",
      action: "send_inquiries",
      details: `${kind === "delay" ? "مسائلات تأخير" : "مسائلات أخرى"}: ${created} معلم`,
    });
    return NextResponse.json({ created });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "تعذّر الإرسال" }, { status: 500 });
  }
}
