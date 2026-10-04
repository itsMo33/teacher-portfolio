import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AGENT_PROCEDURES, COUNSELOR_PROCEDURES, REFERRAL_REASONS, VIOLATIONS } from "@/lib/student-referral-constants";
import { PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { canEditStage, canView, getReferral, isAgentFiled, getReferralActor, getRoutedClasses } from "@/lib/student-referrals";

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
    if (!(await getRoutedClasses()).includes(className.trim())) {
      return NextResponse.json({ error: "اختر الصف من القائمة" }, { status: 400 });
    }
    update = {
      student_name: studentName.trim(),
      class_name: className.trim(),
      subject: subject.trim(),
      reasons: reasonList,
      problem_description: problemDescription?.trim() || null,
    };
  } else if (actor === "agent") {
    if (!canEditStage(actor, session.user.id, referral, "agent")) {
      return NextResponse.json({ error: "لا يمكن تعديل النموذج بعد تحويله" }, { status: 409 });
    }
    if (body.form) {
      // editing the violation form itself -- only for referrals the وكيل filed
      if (!isAgentFiled(referral)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { studentName, className, violations, problemDescription } = body.form;
      const list: string[] = Array.isArray(violations) ? violations : [];
      if (!studentName?.trim() || !className?.trim() || list.length === 0) {
        return NextResponse.json({ error: "عبّي اسم الطالب واختر الصف والمخالفة" }, { status: 400 });
      }
      if (list.some((v) => !(VIOLATIONS as readonly string[]).includes(v))) {
        return NextResponse.json({ error: "Invalid violation" }, { status: 400 });
      }
      if (!(await getRoutedClasses()).includes(className.trim())) {
        return NextResponse.json({ error: "اختر الصف من القائمة" }, { status: 400 });
      }
      const { error: formError } = await supabaseAdmin
        .from("student_referrals")
        .update({
          student_name: studentName.trim(),
          class_name: className.trim(),
          reasons: list,
          problem_description: problemDescription?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (formError) return NextResponse.json({ error: formError.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    const procedures = validProcedures(body.procedures, AGENT_PROCEDURES);
    if (!procedures) return NextResponse.json({ error: "Invalid procedures" }, { status: 400 });
    update = { agent_procedures: procedures, agent_notes: body.notes?.trim() || null };
  } else if (actor === "counselor") {
    if (!canEditStage(actor, session.user.id, referral, "counselor")) {
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

/** A teacher can discard only their own unsent draft. Once a referral has been sent, the staff who
 *  hold it (وكيل شؤون الطلاب, الموجه الطلابي) and the manager can delete it -- e.g. a test or
 *  mistaken referral -- along with its attachments. This is permanent. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = getReferralActor(session.user);
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const referral = await getReferral(id);
  if (!referral || !canView(actor, session.user.id, referral)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (actor === "teacher" && referral.status !== "draft") {
    return NextResponse.json({ error: "لا يمكن حذف نموذج بعد إرساله" }, { status: 409 });
  }

  const { data: files } = await supabaseAdmin.from("student_referral_files").select("file_path").eq("referral_id", id);

  // Attachment rows go with the referral (cascade); remove their stored objects too.
  const { error } = await supabaseAdmin.from("student_referrals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (files && files.length > 0) {
    await supabaseAdmin.storage.from(PORTFOLIO_BUCKET).remove(files.map((f) => f.file_path)).catch(() => {});
  }
  return NextResponse.json({ success: true });
}
