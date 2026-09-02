import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { buildSchedulePath, createUploadSignedUrl, SCHEDULE_BUCKET } from "@/lib/supabase/storage";
import { ACCEPTED_MIME_TYPES, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/portfolio-sections";

/**
 * Issues a signed upload URL for a large schedule file so the browser can upload the bytes
 * directly to Supabase Storage, bypassing this app's serverless functions (which Vercel caps
 * at a 4.5MB request body -- well under the 10MB files this app accepts).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teacherId } = await params;

  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Teachers cannot edit the schedule" }, { status: 403 });
  }

  const { fileName, mimeType, size } = await req.json();
  if (!fileName || typeof size !== "number") {
    return NextResponse.json({ error: "Missing fileName or size" }, { status: 400 });
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

  const path = buildSchedulePath(teacherId, fileName);

  try {
    const { signedUrl, token } = await createUploadSignedUrl(SCHEDULE_BUCKET, path);
    return NextResponse.json({ path, signedUrl, token });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create upload URL" }, { status: 500 });
  }
}
