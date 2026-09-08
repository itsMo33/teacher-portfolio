import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildSchoolFilePath, uploadFile, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { ACCEPTED_MIME_TYPES, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/portfolio-sections";
import { isValidSchoolManagementSlot, getOwnedCategoryKeys } from "@/lib/school-files";
import { logActivity } from "@/lib/audit";

/** A category with a designated owner (restricted_category) can only be uploaded to by that
 *  owner -- everyone else, including full admins, gets a read-only view of it. */
async function canWriteToCategory(session: Session, category: string): Promise<boolean> {
  if (session.user.restrictedCategory) return category === session.user.restrictedCategory;
  const ownedKeys = await getOwnedCategoryKeys();
  return !ownedKeys.has(category);
}

async function finalize(
  session: Session,
  category: string,
  subcategory: string | null,
  filePath: string,
  fileName: string,
  mimeType: string
) {
  const { data, error } = await supabaseAdmin
    .from("school_files")
    .insert({
      category,
      subcategory,
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
    details: `${category}${subcategory ? ` - ${subcategory}` : ""}: ${fileName}`,
  });

  return NextResponse.json({ file: data });
}

/**
 * Records a school-management file whose bytes were already uploaded directly to Supabase
 * Storage via a signed URL from /api/school-files/upload-url (used for large files, since Vercel
 * caps a serverless function's request body at 4.5MB -- well under the 10MB this app accepts).
 */
async function handleConfirm(req: NextRequest, session: Session) {
  const { category, subcategory, filePath, fileName, mimeType } = await req.json();

  if (!category || !filePath || !fileName || !isValidSchoolManagementSlot(category, subcategory ?? null)) {
    return NextResponse.json({ error: "Missing or invalid category, subcategory, filePath or fileName" }, { status: 400 });
  }

  if (!(await canWriteToCategory(session, category))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return finalize(session, category, subcategory ?? null, filePath, fileName, mimeType);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "teacher" && !session.user.restrictedCategory) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isConfirm = (req.headers.get("content-type") ?? "").includes("application/json");
  if (isConfirm) {
    return handleConfirm(req, session);
  }

  const formData = await req.formData();
  const category = formData.get("category") as string | null;
  const subcategory = (formData.get("subcategory") as string | null) || null;
  const file = formData.get("file") as File | null;

  if (!category || !file || !isValidSchoolManagementSlot(category, subcategory)) {
    return NextResponse.json({ error: "Missing or invalid category/subcategory/file" }, { status: 400 });
  }

  if (!(await canWriteToCategory(session, category))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const path = buildSchoolFilePath(category, subcategory, file.name);

  await uploadFile(PORTFOLIO_BUCKET, path, buffer, file.type || "application/octet-stream");

  return finalize(session, category, subcategory, path, file.name, file.type || "application/octet-stream");
}
