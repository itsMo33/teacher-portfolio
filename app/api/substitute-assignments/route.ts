import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

function forbidTeachers(role: string | undefined) {
  return role === "teacher"
    ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
    : null;
}

/** Active rows by default (the current, still-editable week); ?all=1 returns every row ever
 *  recorded, active or archived, for historical totals. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = forbidTeachers(session.user.role);
  if (forbidden) return forbidden;

  const all = req.nextUrl.searchParams.get("all") === "1";

  let query = supabaseAdmin
    .from("substitute_assignments")
    .select("id, day, period, absent_teacher, section, substitute, rank, active, created_at")
    .order("created_at", { ascending: true });
  if (!all) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    assignments: (data ?? []).map((a) => ({
      id: a.id,
      day: a.day,
      period: a.period,
      absentTeacher: a.absent_teacher,
      section: a.section,
      substitute: a.substitute,
      rank: a.rank,
      timestamp: a.created_at,
    })),
  });
}

/** Assign a substitute for a slot. Any existing *active* row for the same (day, period,
 *  absentTeacher) is a same-week correction, not a real prior occurrence, so it's hard-deleted
 *  before inserting the new one -- it never counted as a historical substitution. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = forbidTeachers(session.user.role);
  if (forbidden) return forbidden;

  const { day, period, absentTeacher, section, substitute, rank } = await req.json();
  if (!day || !period || !absentTeacher || !section || !substitute || typeof rank !== "number") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  await supabaseAdmin
    .from("substitute_assignments")
    .delete()
    .eq("day", day)
    .eq("period", period)
    .eq("absent_teacher", absentTeacher)
    .eq("active", true);

  const { data, error } = await supabaseAdmin
    .from("substitute_assignments")
    .insert({ day, period, absent_teacher: absentTeacher, section, substitute, rank })
    .select("id, day, period, absent_teacher, section, substitute, rank, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    assignment: {
      id: data.id,
      day: data.day,
      period: data.period,
      absentTeacher: data.absent_teacher,
      section: data.section,
      substitute: data.substitute,
      rank: data.rank,
      timestamp: data.created_at,
    },
  });
}

/** Cancel a still-active assignment -- hard-deleted, since a cancelled assignment never happened
 *  and shouldn't count toward anyone's total. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = forbidTeachers(session.user.role);
  if (forbidden) return forbidden;

  const { day, period, absentTeacher } = await req.json();
  if (!day || !period || !absentTeacher) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("substitute_assignments")
    .delete()
    .eq("day", day)
    .eq("period", period)
    .eq("absent_teacher", absentTeacher)
    .eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
