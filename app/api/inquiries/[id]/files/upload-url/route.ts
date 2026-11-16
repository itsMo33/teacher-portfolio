import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { getInquiry, isRecipientOf } from "@/lib/inquiries";
import { buildInquiryFilePath } from "@/lib/inquiry-files";
import { createUploadSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/portfolio-sections";

/** A signed link so the browser can send the file straight to storage (Vercel caps a request body at 4.5MB). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const inquiry = await getInquiry(id);
  if (!inquiry || !isRecipientOf(session.user.id, inquiry)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inquiry.decidedAt) return NextResponse.json({ error: "تم البت في المسائلة ولا يمكن إضافة مرفقات" }, { status: 409 });

  const { fileName, mimeType, size } = await req.json();
  if (typeof fileName !== "string" || typeof size !== "number") return NextResponse.json({ error: "Missing fileName or size" }, { status: 400 });
  const ext = "." + (fileName.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPTED_MIME_TYPES.includes(mimeType) && !ACCEPTED_EXTENSIONS.includes(ext)) return NextResponse.json({ error: "نوع الملف غير مدعوم (PDF، صورة، Word)" }, { status: 400 });
  if (size > MAX_FILE_SIZE_BYTES) return NextResponse.json({ error: "الملف أكبر من 10MB" }, { status: 400 });

  const path = buildInquiryFilePath(id, fileName);
  try {
    const { signedUrl } = await createUploadSignedUrl(PORTFOLIO_BUCKET, path);
    return NextResponse.json({ path, signedUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "تعذّر الرفع" }, { status: 500 });
  }
}
