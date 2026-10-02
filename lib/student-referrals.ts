import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import type { ReferralFileStage, ReferralStatus } from "./student-referral-constants";

export type ReferralActor = "teacher" | "agent" | "counselor" | "viewer";

/** Which part of the referral workflow an account plays. The وكيل شؤون الطلاب and الموجه الطلابي
 *  accounts already exist as agent-role accounts scoped to their إدارة المدرسة category, so that
 *  scope is what identifies them -- no extra flag needed. */
export function getReferralActor(user: { role: string; restrictedCategory?: string | null }): ReferralActor | null {
  if (user.role === "teacher") return "teacher";
  if (user.role === "agent" && user.restrictedCategory === "student_affairs_agent") return "agent";
  if (user.role === "agent" && user.restrictedCategory === "student_guidance") return "counselor";
  if (user.role === "manager" && !user.restrictedCategory) return "viewer";
  return null;
}

export interface StudentReferral {
  id: string;
  teacherId: string;
  teacherName: string;
  studentName: string;
  className: string;
  subject: string;
  reasons: string[];
  problemDescription: string | null;
  status: ReferralStatus;
  sentToAgentAt: string | null;
  agentProcedures: number[];
  agentNotes: string | null;
  sentToCounselorAt: string | null;
  counselorProcedures: number[];
  counselorExtraServices: string | null;
  counselorNotes: string | null;
  createdAt: string;
}

export interface ReferralFile {
  id: string;
  stage: ReferralFileStage;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
  signedUrl: string;
}

const REFERRAL_SELECT =
  "id, teacher_id, student_name, class_name, subject, reasons, problem_description, status, sent_to_agent_at, agent_procedures, agent_notes, sent_to_counselor_at, counselor_procedures, counselor_extra_services, counselor_notes, created_at, users(name)";

interface ReferralRow {
  id: string;
  teacher_id: string;
  student_name: string;
  class_name: string;
  subject: string;
  reasons: string[] | null;
  problem_description: string | null;
  status: ReferralStatus;
  sent_to_agent_at: string | null;
  agent_procedures: number[] | null;
  agent_notes: string | null;
  sent_to_counselor_at: string | null;
  counselor_procedures: number[] | null;
  counselor_extra_services: string | null;
  counselor_notes: string | null;
  created_at: string;
  users: { name: string } | { name: string }[] | null;
}

function toReferral(row: ReferralRow): StudentReferral {
  const teacher = Array.isArray(row.users) ? row.users[0] : row.users;
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: teacher?.name ?? "",
    studentName: row.student_name,
    className: row.class_name,
    subject: row.subject,
    reasons: row.reasons ?? [],
    problemDescription: row.problem_description,
    status: row.status,
    sentToAgentAt: row.sent_to_agent_at,
    agentProcedures: row.agent_procedures ?? [],
    agentNotes: row.agent_notes,
    sentToCounselorAt: row.sent_to_counselor_at,
    counselorProcedures: row.counselor_procedures ?? [],
    counselorExtraServices: row.counselor_extra_services,
    counselorNotes: row.counselor_notes,
    createdAt: row.created_at,
  };
}

export async function getReferral(id: string): Promise<StudentReferral | null> {
  const { data } = await supabaseAdmin.from("student_referrals").select(REFERRAL_SELECT).eq("id", id).maybeSingle();
  return data ? toReferral(data as unknown as ReferralRow) : null;
}

/** The referrals an account is allowed to see, newest first: a teacher sees their own, the agent
 *  everything that was sent to them (including what they already forwarded), the counselor only
 *  what has reached them, and a manager everything that was sent on from a draft. */
export async function listReferralsFor(actor: ReferralActor, userId: string): Promise<StudentReferral[]> {
  let query = supabaseAdmin.from("student_referrals").select(REFERRAL_SELECT).order("created_at", { ascending: false });
  if (actor === "teacher") query = query.eq("teacher_id", userId);
  else if (actor === "agent") query = query.in("status", ["with_agent", "with_counselor"]);
  else if (actor === "counselor") query = query.eq("status", "with_counselor");
  else query = query.neq("status", "draft");

  const { data } = await query;
  return (data ?? []).map((row) => toReferral(row as unknown as ReferralRow));
}

export async function getReferralFiles(referralId: string): Promise<ReferralFile[]> {
  const { data } = await supabaseAdmin
    .from("student_referral_files")
    .select("id, stage, file_path, file_name, mime_type, uploaded_at")
    .eq("referral_id", referralId)
    .order("uploaded_at", { ascending: true });

  return Promise.all(
    (data ?? []).map(async (f) => ({
      id: f.id,
      stage: f.stage as ReferralFileStage,
      file_name: f.file_name,
      mime_type: f.mime_type,
      uploaded_at: f.uploaded_at,
      signedUrl: await getSignedUrl(PORTFOLIO_BUCKET, f.file_path),
    }))
  );
}

/** A stage's form and attachments are editable only by its own role, and only while the referral
 *  is sitting with that role -- once forwarded, it becomes read-only for the sender. */
export function canEditStage(actor: ReferralActor, referral: StudentReferral, stage: ReferralFileStage): boolean {
  if (stage === "agent") return actor === "agent" && referral.status === "with_agent";
  return actor === "counselor" && referral.status === "with_counselor";
}

/** Whether this account may view a given referral at all (mirrors listReferralsFor). */
export function canView(actor: ReferralActor, userId: string, referral: StudentReferral): boolean {
  if (actor === "teacher") return referral.teacherId === userId;
  if (actor === "agent") return referral.status === "with_agent" || referral.status === "with_counselor";
  if (actor === "counselor") return referral.status === "with_counselor";
  return referral.status !== "draft";
}
