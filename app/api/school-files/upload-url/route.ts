import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { buildSchoolFilePath, createUploadSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { ACCEPTED_MIME_TYPES, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/portfolio-sections";
import { isValidSchoolManagementCategory } from "@/lib/school-files";

/**
 * Issues a signed upload URL for a large school-management file so the browser can upload the
 * bytes directly to Supabase Storage, bypassing this app's serverless functions (which Vercel
 * caps at a 4.5MB request body -- well under the 10MB files this app accepts).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { category, fileName, mimeType, size } = await req.json();

  if (!category || !fileName || typeof size !== "number" || !isValidSchoolManagementCategory(category)) {
    return NextResponse.json({ error: "Missing or invalid category, fileName or size" }, { status: 400 });
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

  const path = buildSchoolFilePath(category, fileName);

  try {
    const { signedUrl, token } = await createUploadSignedUrl(PORTFOLIO_BUCKET, path);
    return NextResponse.json({ path, signedUrl, token });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create upload URL" }, { status: 500 });
  }
}
