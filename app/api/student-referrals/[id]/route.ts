import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AGENT_PROCEDURES, COUNSELOR_PROCEDURES, REFERRAL_REASONS } from "@/lib/student-referral-constants";
import { canEditStage, getReferral, getReferralActor } from "@/lib/student-referrals";

function validProcedures(value: unknown, allowed: { n: number }[]): number[] | null {
  if (!Array.isArray(value)) return null;
  const numbers = value.map(Number);
  const allowedNumbers = new Set(allowed.map((p) => p.n));
  if (numbers.some((n) => !allowedNumbers.has(n))) return null;
  return [...new Set(numbers)].sort((a, b) => a - b);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = getReferralActor(session.user);
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const referral = await getReferral(id);
  if (!referral) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  let update: Record<string, unknown>;

  if (actor === "teacher") {
    if (referral.teacherId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (referral.status !== "draft") {
      return NextResponse.json({ error: "لا يمكن تعديل نموذج بعد إرساله" }, { status: 409 });
    }
    const { studentName, className, subject, reasons, problemDescription } = body;
    if (!studentName?.trim() || !className?.trim() || !subject?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const reasonList: string[] = Array.isArray(reasons) ? reasons : [];
    if (reasonList.some((r) => !(REFERRAL_REASONS as readonly string[]).includes(r))) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }
    update = {
      student_name: studentName.trim(),
      class_name: className.trim(),
      subject: subject.trim(),
      reasons: reasonList,
      problem_description: problemDescription?.trim() || null,
    };
  } else if (actor === "agent") {
    if (!canEditStage(actor, referral, "agent")) {
      return NextResponse.json({ error: "لا يمكن تعديل النموذج بعد تحويله" }, { status: 409 });
    }
    const procedures = validProcedures(body.procedures, AGENT_PROCEDURES);
    if (!procedures) return NextResponse.json({ error: "Invalid procedures" }, { status: 400 });
    update = { agent_procedures: procedures, agent_notes: body.notes?.trim() || null };
  } else if (actor === "counselor") {
    if (!canEditStage(actor, referral, "counselor")) {
      return NextResponse.json({ error: "لا يمكن تعديل هذا النموذج" }, { status: 409 });
    }
    const procedures = validProcedures(body.procedures, COUNSELOR_PROCEDURES);
    if (!procedures) return NextResponse.json({ error: "Invalid procedures" }, { status: 400 });
    update = {
      counselor_procedures: procedures,
      counselor_extra_services: body.extraServices?.trim() || null,
      counselor_notes: body.notes?.trim() || null,
    };
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("student_referrals")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** A teacher can discard a referral only while it is still an unsent draft. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getReferralActor(session.user) !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const referral = await getReferral(id);
  if (!referral || referral.teacherId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (referral.status !== "draft") {
    return NextResponse.json({ error: "لا يمكن حذف نموذج بعد إرساله" }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from("student_referrals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
