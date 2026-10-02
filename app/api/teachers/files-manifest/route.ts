import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_BUCKET, SCHEDULE_BUCKET } from "@/lib/supabase/storage";
import { getSection } from "@/lib/portfolio-sections";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim() || "-";
}

/**
 * Lists every live file of every teacher (or one teacher with ?teacherId=) as
 * { zipPath, url } so the browser can download and zip them itself -- zipping on the server
 * would hit Vercel's response/time limits for a whole school's files.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Allowed: the وكيل شؤون المعلمين account (scoped to that category) and unrestricted admin-level
  // accounts (agent/manager with no category scope) -- the latter can already open every teacher's
  // files one by one, so a bulk download exposes nothing new. A demo account never gets a bulk export.
  const { role, restrictedCategory, demoViewOnly } = session.user;
  const isAdminLevel = role === "agent" || role === "manager";
  const allowed = isAdminLevel && !demoViewOnly && (!restrictedCategory || restrictedCategory === "teacher_affairs_agent");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const onlyTeacher = req.nextUrl.searchParams.get("teacherId");

  let teachersQuery = supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("role", "teacher")
    .is("deleted_at", null)
    .order("name");
  if (onlyTeacher) teachersQuery = teachersQuery.eq("id", onlyTeacher);

  const { data: teachers, error: tErr } = await teachersQuery;
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  const ids = (teachers ?? []).map((t) => t.id);
  if (ids.length === 0) return NextResponse.json({ files: [] });

  const [{ data: attachments, error: aErr }, { data: schedules, error: sErr }] = await Promise.all([
    supabaseAdmin
      .from("attachments")
      .select("teacher_id, category, subcategory, file_name, file_path")
      .in("teacher_id", ids)
      .is("deleted_at", null)
      .order("uploaded_at"),
    supabaseAdmin
      .from("schedules")
      .select("teacher_id, file_name, file_path")
      .in("teacher_id", ids)
      .is("deleted_at", null),
  ]);
  if (aErr || sErr) {
    return NextResponse.json({ error: (aErr ?? sErr)!.message }, { status: 500 });
  }

  const folderOf = new Map<string, string>();
  const used = new Set<string>();
  for (const t of teachers ?? []) {
    let folder = safeName(t.name);
    if (used.has(folder)) folder = `${folder} (${t.id.slice(0, 4)})`;
    used.add(folder);
    folderOf.set(t.id, folder);
  }

  type Item = { bucket: string; path: string; zipPath: string };
  const items: Item[] = [];
  const taken = new Set<string>();
  const add = (bucket: string, path: string, dir: string, fileName: string) => {
    let zipPath = `${dir}/${safeName(fileName)}`;
    if (taken.has(zipPath)) {
      const dot = fileName.lastIndexOf(".");
      const base = dot > 0 ? fileName.slice(0, dot) : fileName;
      const ext = dot > 0 ? fileName.slice(dot) : "";
      let n = 2;
      while (taken.has(`${dir}/${safeName(`${base} (${n})${ext}`)}`)) n++;
      zipPath = `${dir}/${safeName(`${base} (${n})${ext}`)}`;
    }
    taken.add(zipPath);
    items.push({ bucket, path, zipPath });
  };

  for (const s of schedules ?? []) {
    const folder = folderOf.get(s.teacher_id);
    if (folder) add(SCHEDULE_BUCKET, s.file_path, `${folder}/الجدول المدرسي`, s.file_name);
  }
  for (const a of attachments ?? []) {
    const folder = folderOf.get(a.teacher_id);
    if (!folder) continue;
    const section = getSection(a.category);
    const sectionLabel = section?.labelAr ?? a.category;
    const subLabel = a.subcategory
      ? (section?.subsections?.find((x) => x.key === a.subcategory)?.labelAr ?? a.subcategory)
      : null;
    const dir = [folder, safeName(sectionLabel), subLabel ? safeName(subLabel) : null]
      .filter(Boolean)
      .join("/");
    add(PORTFOLIO_BUCKET, a.file_path, dir, a.file_name);
  }

  const files: { zipPath: string; url: string }[] = [];
  for (const bucket of [PORTFOLIO_BUCKET, SCHEDULE_BUCKET]) {
    const group = items.filter((i) => i.bucket === bucket);
    for (let i = 0; i < group.length; i += 200) {
      const chunk = group.slice(i, i + 200);
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrls(
          chunk.map((c) => c.path),
          SIGNED_URL_TTL_SECONDS
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      data.forEach((d, idx) => {
        if (d.signedUrl) files.push({ zipPath: chunk[idx].zipPath, url: d.signedUrl });
      });
    }
  }

  return NextResponse.json({ files });
}
