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

  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Teachers cannot edit the schedule" }, { status: 403 });
  }

  const { teacherId } = await params;
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

  const { data: existing } = await supabaseAdmin
    .from("schedules")
    .select("id, file_path")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = buildSchedulePath(teacherId, file.name);
  await uploadFile(SCHEDULE_BUCKET, path, buffer, file.type || "application/octet-stream");

  if (existing) {
    await deleteFile(SCHEDULE_BUCKET, existing.file_path);
    const { error } = await supabaseAdmin
      .from("schedules")
      .update({
        file_path: path,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
        uploaded_by: session.user.id,
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("schedules").insert({
      teacher_id: teacherId,
      file_path: path,
      file_name: file.name,
      uploaded_by: session.user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
