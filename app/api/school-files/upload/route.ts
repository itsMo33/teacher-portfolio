import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildSchoolFilePath, uploadFile, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { ACCEPTED_MIME_TYPES, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/portfolio-sections";
import { isValidSchoolManagementCategory } from "@/lib/school-files";
import { logActivity } from "@/lib/audit";

async function finalize(session: Session, category: string, filePath: string, fileName: string, mimeType: string) {
  const { data, error } = await supabaseAdmin
    .from("school_files")
    .insert({
      category,
      file_path: filePath,
      file_name: fileName,
      mime_type: mimeType || "application/octet-stream",
      uploaded_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "upload_school_file",
    details: `${category}: ${fileName}`,
  });

  return NextResponse.json({ file: data });
}

/**
 * Records a school-management file whose bytes were already uploaded directly to Supabase
 * Storage via a signed URL from /api/school-files/upload-url (used for large files, since Vercel
 * caps a serverless function's request body at 4.5MB -- well under the 10MB this app accepts).
 */
async function handleConfirm(req: NextRequest, session: Session) {
  const { category, filePath, fileName, mimeType } = await req.json();

  if (!category || !filePath || !fileName || !isValidSchoolManagementCategory(category)) {
    return NextResponse.json({ error: "Missing or invalid category, filePath or fileName" }, { status: 400 });
  }

  return finalize(session, category, filePath, fileName, mimeType);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isConfirm = (req.headers.get("content-type") ?? "").includes("application/json");
  if (isConfirm) {
    return handleConfirm(req, session);
  }

  const formData = await req.formData();
  const category = formData.get("category") as string | null;
  const file = formData.get("file") as File | null;

  if (!category || !file || !isValidSchoolManagementCategory(category)) {
    return NextResponse.json({ error: "Missing or invalid category/file" }, { status: 400 });
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = buildSchoolFilePath(category, file.name);

  await uploadFile(PORTFOLIO_BUCKET, path, buffer, file.type || "application/octet-stream");

  return finalize(session, category, path, file.name, file.type || "application/octet-stream");
}
