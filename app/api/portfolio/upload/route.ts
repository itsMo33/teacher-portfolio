import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildPortfolioPath, uploadFile, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import {
  isValidCategory,
  getSection,
  ACCEPTED_MIME_TYPES,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/portfolio-sections";
import { logActivity } from "@/lib/audit";

/** Shared category/ownership checks for both the direct-upload and confirm-only paths. */
function resolveTeacherIdOrError(
  session: Session,
  category: string,
  subcategory: string | null,
  teacherIdInput: string | null
): { teacherId: string } | { error: NextResponse } {
  if (!isValidCategory(category, subcategory)) {
    return { error: NextResponse.json({ error: "Invalid category/subcategory" }, { status: 400 }) };
  }
  if (category === "schedule") {
    return { error: NextResponse.json({ error: "Use /api/schedule for the school schedule" }, { status: 400 }) };
  }

  const section = getSection(category)!;
  if (session.user.role === "teacher" && !section.teacherWritable) {
    return { error: NextResponse.json({ error: "This section is not teacher-writable" }, { status: 403 }) };
  }

  const teacherId = session.user.role === "teacher" ? session.user.id : teacherIdInput;
  if (!teacherId) {
    return { error: NextResponse.json({ error: "Missing teacherId" }, { status: 400 }) };
  }
  if (session.user.role === "teacher" && teacherId !== session.user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { teacherId };
}

async function finalizeAttachment(
  session: Session,
  params: { teacherId: string; category: string; subcategory: string | null; filePath: string; fileName: string; mimeType: string }
) {
  const { teacherId, category, subcategory, filePath, fileName, mimeType } = params;
  const section = getSection(category)!;

  const { data, error } = await supabaseAdmin
    .from("attachments")
    .insert({
      teacher_id: teacherId,
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

  let targetTeacherName: string | undefined =
    session.user.role === "teacher" ? session.user.name ?? undefined : undefined;
  if (!targetTeacherName) {
    const { data: teacher } = await supabaseAdmin.from("users").select("name").eq("id", teacherId).maybeSingle();
    targetTeacherName = teacher?.name ?? undefined;
  }

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "upload",
    targetTeacherId: teacherId,
    targetTeacherName,
    details: `${section.labelAr}${data.subcategory ? ` - ${data.subcategory}` : ""}: ${fileName}`,
  });

  return NextResponse.json({ attachment: data });
}

/**
 * Records an attachment whose bytes were already uploaded directly to Supabase Storage via a
 * signed URL from /api/portfolio/upload-url (used for large files, since Vercel caps a
 * serverless function's request body at 4.5MB -- well under the 10MB this app accepts).
 */
async function handleConfirm(req: NextRequest, session: Session) {
  const { category, subcategory, teacherId: teacherIdInput, filePath, fileName, mimeType } = await req.json();

  if (!category || !filePath || !fileName) {
    return NextResponse.json({ error: "Missing category, filePath or fileName" }, { status: 400 });
  }

  const resolved = resolveTeacherIdOrError(session, category, subcategory ?? null, teacherIdInput ?? null);
  if ("error" in resolved) return resolved.error;

  return finalizeAttachment(session, {
    teacherId: resolved.teacherId,
    category,
    subcategory: subcategory ?? null,
    filePath,
    fileName,
    mimeType,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Large files are uploaded directly to Supabase Storage from the browser (see
  // /api/portfolio/upload-url) to dodge Vercel's 4.5MB serverless request-body cap; the client
  // then calls back here with JSON to just record the attachment, skipping the file bytes.
  const isConfirm = (req.headers.get("content-type") ?? "").includes("application/json");
  if (isConfirm) {
    return handleConfirm(req, session);
  }

  const formData = await req.formData();
  const category = formData.get("category") as string | null;
  const subcategory = (formData.get("subcategory") as string | null) || null;
  const file = formData.get("file") as File | null;
  const teacherIdInput = formData.get("teacherId") as string | null;

  if (!category || !file) {
    return NextResponse.json({ error: "Missing category or file" }, { status: 400 });
  }

  const resolved = resolveTeacherIdOrError(session, category, subcategory, teacherIdInput);
  if ("error" in resolved) return resolved.error;
  const { teacherId } = resolved;

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
  const path = buildPortfolioPath(teacherId, category, subcategory, file.name);

  await uploadFile(PORTFOLIO_BUCKET, path, buffer, file.type || "application/octet-stream");

  return finalizeAttachment(session, {
    teacherId,
    category,
    subcategory,
    filePath: path,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
  });
}
