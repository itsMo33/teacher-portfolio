import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth/auth-options";
import { createUploadSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { getInquiryRole } from "@/lib/inquiries";

const MAX_PDF_BYTES = 30 * 1024 * 1024;

/** A signed upload URL for the inquiries PDF: it goes straight from the browser to storage (Vercel caps a
 *  function's request body at 4.5MB), and is then read back by /api/inquiries/parse. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getInquiryRole(session.user) !== "officer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fileName, size } = await req.json();
  if (typeof fileName !== "string" || !fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "الملف لازم يكون PDF" }, { status: 400 });
  }
  if (typeof size !== "number" || size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "حجم الملف كبير (الحد 30MB)" }, { status: 400 });
  }

  const path = `inquiries/uploads/${randomUUID()}.pdf`;
  try {
    const { signedUrl } = await createUploadSignedUrl(PORTFOLIO_BUCKET, path);
    return NextResponse.json({ path, signedUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create upload URL" }, { status: 500 });
  }
}
