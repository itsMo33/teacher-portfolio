import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  buildPortfolioPath,
  uploadFile,
  PORTFOLIO_BUCKET,
} from "@/lib/supabase/storage";
import {
  isValidCategory,
  getSection,
  ACCEPTED_MIME_TYPES,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/portfolio-sections";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const category = formData.get("category") as string | null;
  const subcategory = (formData.get("subcategory") as string | null) || null;
  const file = formData.get("file") as File | null;
  const teacherIdInput = formData.get("teacherId") as string | null;

  if (!category || !file) {
    return NextResponse.json({ error: "Missing category or file" }, { status: 400 });
  }

  if (!isValidCategory(category, subcategory)) {
    return NextResponse.json({ error: "Invalid category/subcategory" }, { status: 400 });
  }

  const section = getSection(category)!;
  if (!section.teacherWritable) {
    return NextResponse.json({ error: "This section is not teacher-writable" }, { status: 403 });
  }

  // Teachers can only upload to their own portfolio; admins are not expected to
  // upload here (schedule uploads go through /api/schedule instead).
  const teacherId = session.user.role === "teacher" ? session.user.id : teacherIdInput;
  if (!teacherId) {
    return NextResponse.json({ error: "Missing teacherId" }, { status: 400 });
  }
  if (session.user.role === "teacher" && teacherId !== session.user.id) {
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
  const path = buildPortfolioPath(teacherId, category, subcategory, file.name);

  await uploadFile(PORTFOLIO_BUCKET, path, buffer, file.type || "application/octet-stream");

  const { data, error } = await supabaseAdmin
    .from("attachments")
    .insert({
      teacher_id: teacherId,
      category,
      subcategory,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      uploaded_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attachment: data });
}
