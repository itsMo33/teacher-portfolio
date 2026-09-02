import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  buildSchedulePath,
  uploadFile,
  deleteFile,
  getSignedUrl,
  SCHEDULE_BUCKET,
} from "@/lib/supabase/storage";
import { ACCEPTED_MIME_TYPES, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/portfolio-sections";
import { logActivity } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teacherId } = await params;
  const isOwner = session.user.role === "teacher" && session.user.id === teacherId;
  const isAdmin = session.user.role === "agent" || session.user.role === "manager";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: schedule, error } = await supabaseAdmin
    .from("schedules")
    .select("id, file_name, file_path, uploaded_at")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!schedule) {
    return NextResponse.json({ schedule: null });
  }

  const signedUrl = await getSignedUrl(SCHEDULE_BUCKET, schedule.file_path);
  return NextResponse.json({ schedule: { ...schedule, signedUrl } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teacherId } = await params;

  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Teachers cannot edit the schedule" }, { status: 403 });
  }

  // Large files are uploaded directly to Supabase Storage from the browser (see
  // ./upload-url) to dodge Vercel's 4.5MB serverless request-body cap; the client then calls
  // back here with JSON to just record the schedule, skipping the file bytes.
  const isConfirm = (req.headers.get("content-type") ?? "").includes("application/json");

  let path: string;
  let fileName: string;

  if (isConfirm) {
    const body = await req.json();
    if (!body.filePath || !body.fileName) {
      return NextResponse.json({ error: "Missing filePath or fileName" }, { status: 400 });
    }
    path = body.filePath;
    fileName = body.fileName;
  } else {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
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
    path = buildSchedulePath(teacherId, file.name);
    await uploadFile(SCHEDULE_BUCKET, path, buffer, file.type || "application/octet-stream");
    fileName = file.name;
  }

  const { data: existing } = await supabaseAdmin
    .from("schedules")
    .select("id, file_path")
    .eq("teacher_id", teacherId)
    .maybeSingle(); // intentionally not filtering deleted_at: a teacher can only ever have one schedule row (unique constraint), so re-uploading always reuses/revives it

  if (existing) {
    await deleteFile(SCHEDULE_BUCKET, existing.file_path);
    const { error } = await supabaseAdmin
      .from("schedules")
      .update({
        file_path: path,
        file_name: fileName,
        uploaded_at: new Date().toISOString(),
        uploaded_by: session.user.id,
        viewed_at: null,
        deleted_at: null,
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("schedules").insert({
      teacher_id: teacherId,
      file_path: path,
      file_name: fileName,
      uploaded_by: session.user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: teacher } = await supabaseAdmin.from("users").select("name").eq("id", teacherId).maybeSingle();
  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "upload_schedule",
    targetTeacherId: teacherId,
    targetTeacherName: teacher?.name,
    details: fileName,
  });

  return NextResponse.json({ success: true });
}
