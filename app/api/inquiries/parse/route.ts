import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { getInquiryRole, parseUploadedPdf } from "@/lib/inquiries";

export const maxDuration = 60;

/** Reads the uploaded PDF and proposes one item per teacher found in it. Nothing is created yet -- the uploader
 *  checks the matches first and then confirms with /api/inquiries/send. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const inquiryRole = getInquiryRole(session.user);
  if (inquiryRole !== "officer" && inquiryRole !== "reviewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { path } = await req.json();
  if (typeof path !== "string" || !path.startsWith("inquiries/uploads/") || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const { items, teachers, pageCount } = await parseUploadedPdf(path);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "ما قدرت أقرأ نصاً من الملف. إذا كان صوراً ممسوحة (مسح ضوئي) فيحتاج قراءة نصوص خاصة -- أرسل لي نموذجاً منه." },
        { status: 422 }
      );
    }
    return NextResponse.json({ items, teachers, pageCount });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "تعذّرت قراءة الملف" }, { status: 500 });
  }
}
