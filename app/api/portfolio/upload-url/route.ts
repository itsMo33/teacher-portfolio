import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { buildPortfolioPath, createUploadSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { isValidCategory, getSection, ACCEPTED_MIME_TYPES, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/portfolio-sections";

/**
 * Issues a signed upload URL for a large portfolio file so the browser can upload the bytes
 * directly to Supabase Storage, bypassing this app's serverless functions (which Vercel caps
 * at a 4.5MB request body -- well under the 10MB files this app accepts).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category, subcategory, teacherId: teacherIdInput, fileName, mimeType, size } = await req.json();

  if (!category || !fileName || typeof size !== "number") {
    return NextResponse.json({ error: "Missing category, fileName or size" }, { status: 400 });
  }

  if (!isValidCategory(category, subcategory ?? null)) {
    return NextResponse.json({ error: "Invalid category/subcategory" }, { status: 400 });
  }

  if (category === "schedule") {
    return NextResponse.json({ error: "Use /api/schedule for the school schedule" }, { status: 400 });
  }

  const section = getSection(category)!;

  if (session.user.role === "teacher" && !section.teacherWritable) {
    return NextResponse.json({ error: "This section is not teacher-writable" }, { status: 403 });
  }

  const teacherId = session.user.role === "teacher" ? session.user.id : teacherIdInput;
  if (!teacherId) {
    return NextResponse.json({ error: "Missing teacherId" }, { status: 400 });
  }
  if (session.user.role === "teacher" && teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const path = buildPortfolioPath(teacherId, category, subcategory ?? null, fileName);

  try {
    const { signedUrl, token } = await createUploadSignedUrl(PORTFOLIO_BUCKET, path);
    return NextResponse.json({ path, signedUrl, token });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create upload URL" }, { status: 500 });
  }
}
